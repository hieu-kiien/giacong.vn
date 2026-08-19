import assert from "node:assert/strict";
import { appendFile } from "node:fs/promises";

const apiToken = requiredEnv("CLOUDFLARE_API_TOKEN");
const accountId = requiredEnv("CLOUDFLARE_ACCOUNT_ID");
const serviceClientId = requiredEnv("CLOUDFLARE_ACCESS_CLIENT_ID");
const workerName = process.env.STAGING_WORKER_NAME?.trim() || "giacong-vn-staging";
const previewAlias = process.env.G2_PREVIEW_ALIAS?.trim() || "g2-admin";
const applicationName = process.env.G2_PREVIEW_ACCESS_APPLICATION_NAME?.trim() || "Giacong staging G2 preview Admin";
const policyName = process.env.G2_PREVIEW_ACCESS_POLICY_NAME?.trim() || "GitHub G2 preview Service Auth";

assert.match(workerName, /^[a-z0-9-]{1,63}$/i, "STAGING_WORKER_NAME is invalid.");
assert.match(previewAlias, /^[a-z][a-z0-9-]*$/, "G2_PREVIEW_ALIAS is invalid.");
assert.ok(`${previewAlias}-${workerName}`.length <= 63, "Preview alias plus Worker name exceeds the workers.dev DNS label limit.");

const [workerResponse, subdomainResponse, applicationsResponse, serviceTokensResponse] = await Promise.all([
  cloudflare(`/accounts/${accountId}/workers/workers/${encodeURIComponent(workerName)}`),
  cloudflare(`/accounts/${accountId}/workers/subdomain`),
  cloudflare(`/accounts/${accountId}/access/apps?per_page=100`),
  cloudflare(`/accounts/${accountId}/access/service_tokens?per_page=1000`),
]);

const workerId = workerResponse.result?.id?.trim() ?? "";
assert.match(workerId, /^[0-9a-f]{32}$/i, "Cloudflare Worker immutable id is unavailable.");
assert.equal(workerResponse.result?.name, workerName, "Cloudflare Worker lookup resolved an unexpected Worker.");

const accountSubdomain = subdomainResponse.result?.subdomain?.trim() ?? "";
assert.match(accountSubdomain, /^[a-z0-9-]{1,63}$/i, "Cloudflare account workers.dev subdomain is unavailable.");
const hostname = `${previewAlias}-${workerName}.${accountSubdomain}.workers.dev`;
const origin = `https://${hostname}`;

let exactApps = findPreviewApps(applicationsResponse.result ?? [], workerId);
assert.ok(exactApps.length <= 1, `Expected at most one Access application for preview Worker ${workerName}, found ${exactApps.length}.`);

if (exactApps.length === 0) {
  const created = await cloudflare(`/accounts/${accountId}/access/apps`, {
    method: "POST",
    body: JSON.stringify({
      app_launcher_visible: false,
      destinations: [{ type: "preview_worker", worker_id: workerId }],
      name: applicationName,
      service_auth_401_redirect: true,
      session_duration: "1h",
      type: "self_hosted",
    }),
  });
  assert.equal(created.result?.type, "self_hosted", "Created preview Access application must be self_hosted.");
  assert.ok(
    Array.isArray(created.result?.destinations)
      && created.result.destinations.some((destination) => destination?.type === "preview_worker" && destination?.worker_id === workerId),
    "Created Access application did not target exactly the staging Worker previews.",
  );
  console.log(`Created Access application '${applicationName}' for preview deployments of ${workerName}.`);

  const refreshed = await cloudflare(`/accounts/${accountId}/access/apps?per_page=100`);
  exactApps = findPreviewApps(refreshed.result ?? [], workerId);
}

assert.equal(exactApps.length, 1, `Expected exactly one Access application for preview Worker ${workerName}.`);
const app = exactApps[0];
assert.ok(app?.id, "Preview Access application must expose an id.");
assert.match(app?.aud ?? "", /^[0-9a-f]{64}$/i, "Preview Access application must expose a valid AUD tag.");

const matchingTokens = (serviceTokensResponse.result ?? []).filter((token) => token?.client_id === serviceClientId);
assert.equal(matchingTokens.length, 1, `Expected exactly one Access service token matching CLOUDFLARE_ACCESS_CLIENT_ID, found ${matchingTokens.length}.`);
const serviceToken = matchingTokens[0];
assert.ok(serviceToken?.id, "Staging Access service token must expose an id.");

const policies = await cloudflare(`/accounts/${accountId}/access/apps/${app.id}/policies?per_page=100`);
const hasMatchingServiceAuth = (policies.result ?? []).some((policy) => {
  if (policy?.decision !== "non_identity") return false;
  return Array.isArray(policy.include) && policy.include.some((rule) =>
    rule?.service_token?.token_id === serviceToken.id || rule?.any_valid_service_token,
  );
});

if (!hasMatchingServiceAuth) {
  const created = await cloudflare(`/accounts/${accountId}/access/apps/${app.id}/policies`, {
    method: "POST",
    body: JSON.stringify({
      name: policyName,
      decision: "non_identity",
      include: [{ service_token: { token_id: serviceToken.id } }],
    }),
  });
  assert.equal(created.result?.decision, "non_identity", "Created preview Access policy must be Service Auth/non_identity.");
  console.log(`Created Access Service Auth policy '${policyName}' for staging Worker previews.`);
} else {
  console.log(`Access Service Auth already configured for preview deployments of ${workerName}.`);
}

await writeGithubOutput("aud", app.aud);
await writeGithubOutput("hostname", hostname);
await writeGithubOutput("origin", origin);
await writeGithubOutput("worker_id", workerId);
console.log(`Prepared protected G2 preview origin ${origin}.`);

function findPreviewApps(applications, targetWorkerId) {
  return applications.filter((application) =>
    application?.type === "self_hosted"
    && Array.isArray(application?.destinations)
    && application.destinations.some((destination) =>
      destination?.type === "preview_worker" && destination?.worker_id === targetWorkerId,
    ),
  );
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function writeGithubOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT?.trim();
  if (!outputPath) return;
  await appendFile(outputPath, `${name}=${value}\n`, "utf8");
}

async function cloudflare(pathname, init = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(20000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success !== true) {
    const messages = [
      ...(Array.isArray(body?.errors) ? body.errors : []),
      ...(Array.isArray(body?.messages) ? body.messages : []),
    ].map((item) => item?.message).filter(Boolean).join(" | ");
    throw new Error(`Cloudflare API ${init.method ?? "GET"} ${pathname} failed with HTTP ${response.status}${messages ? `: ${messages}` : ""}.`);
  }
  return body;
}
