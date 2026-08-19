import assert from "node:assert/strict";
import { appendFile } from "node:fs/promises";
import {
  classifyAccessApplications,
  formatRelatedAccessApps,
} from "./access-application-targets.mjs";

const apiToken = requiredEnv("CLOUDFLARE_API_TOKEN");
const accountId = requiredEnv("CLOUDFLARE_ACCOUNT_ID");
const targetDomain = process.env.ACCESS_SERVICE_AUTH_DOMAIN?.trim() || "staging.kienhieu.id.vn";
const policyName = process.env.ACCESS_SERVICE_AUTH_POLICY_NAME?.trim() || `GitHub Service Auth ${targetDomain}`;
const accessAppRequired = process.env.ACCESS_SERVICE_AUTH_REQUIRED?.trim().toLowerCase() === "true";
const createAppIfMissing = process.env.ACCESS_APPLICATION_CREATE_IF_MISSING?.trim().toLowerCase() === "true";
const appName = process.env.ACCESS_APPLICATION_NAME?.trim() || `Giacong staging ${targetDomain}`;

assert.match(targetDomain, /^[a-z0-9.-]+$/i, "ACCESS_SERVICE_AUTH_DOMAIN is invalid.");
assert.ok(appName.length >= 1 && appName.length <= 350, "ACCESS_APPLICATION_NAME is invalid.");

let applications = await cloudflareApi(`/accounts/${accountId}/access/apps?per_page=100`);
let classified = classifyAccessApplications(applications.result ?? [], targetDomain);
refuseBroadScope(classified.relatedApps);

if (classified.exactApps.length === 0 && !accessAppRequired) {
  console.log(`No Access application exists for ${targetDomain}; Service Auth bootstrap is not required for this target.`);
  process.exit(0);
}

if (classified.exactApps.length === 0 && accessAppRequired && createAppIfMissing) {
  const created = await cloudflareApi(`/accounts/${accountId}/access/apps`, {
    method: "POST",
    body: JSON.stringify({
      app_launcher_visible: false,
      destinations: [{ type: "public", uri: `https://${targetDomain}/*` }],
      domain: targetDomain,
      name: appName,
      service_auth_401_redirect: true,
      session_duration: "8h",
      type: "self_hosted",
    }),
  });
  assert.equal(created.result?.type, "self_hosted", "Created Access application must be self_hosted.");
  console.log(`Created exact staging Access application '${appName}' for ${targetDomain}.`);

  applications = await cloudflareApi(`/accounts/${accountId}/access/apps?per_page=100`);
  classified = classifyAccessApplications(applications.result ?? [], targetDomain);
  refuseBroadScope(classified.relatedApps);
}

assert.equal(
  classified.exactApps.length,
  1,
  `Expected exactly one Access application scoped exclusively to ${targetDomain}, found ${classified.exactApps.length}.`,
);
const app = classified.exactApps[0];
assert.ok(app?.id, "Target Access application must expose an id.");
assert.match(app?.aud ?? "", /^[0-9a-f]{64}$/i, "Target Access application must expose a valid AUD tag.");
await writeGithubOutput("aud", app.aud);

const serviceClientId = requiredEnv("CLOUDFLARE_ACCESS_CLIENT_ID");
const serviceTokens = await cloudflareApi(`/accounts/${accountId}/access/service_tokens?per_page=1000`);
const matchingTokens = (serviceTokens.result ?? []).filter((token) => token?.client_id === serviceClientId);
assert.equal(
  matchingTokens.length,
  1,
  `Expected exactly one Access service token matching CLOUDFLARE_ACCESS_CLIENT_ID, found ${matchingTokens.length}.`,
);
const serviceToken = matchingTokens[0];
assert.ok(serviceToken?.id, "Staging Access service token must expose an id.");

const policies = await cloudflareApi(`/accounts/${accountId}/access/apps/${app.id}/policies?per_page=100`);
const hasMatchingServiceAuth = (policies.result ?? []).some((policy) => {
  if (policy?.decision !== "non_identity") return false;
  return Array.isArray(policy.include) && policy.include.some((rule) =>
    rule?.service_token?.token_id === serviceToken.id || rule?.any_valid_service_token,
  );
});

if (hasMatchingServiceAuth) {
  console.log(`Access Service Auth already configured for ${targetDomain}.`);
  process.exit(0);
}

const created = await cloudflareApi(`/accounts/${accountId}/access/apps/${app.id}/policies`, {
  method: "POST",
  body: JSON.stringify({
    name: policyName,
    decision: "non_identity",
    include: [{ service_token: { token_id: serviceToken.id } }],
  }),
});

assert.equal(created.success, true, "Cloudflare did not confirm Access policy creation.");
assert.equal(created.result?.decision, "non_identity", "Created policy must be Service Auth/non_identity.");
console.log(`Created Access Service Auth policy '${policyName}' for ${targetDomain}.`);

function refuseBroadScope(relatedApps) {
  if (relatedApps.length === 0) return;
  throw new Error(
    `ACCESS_APP_SCOPE_TOO_BROAD: Access application configuration covers ${targetDomain} but is not scoped exclusively `
    + `to that whole hostname. Refusing to add an application-level Service Auth policy. ${formatRelatedAccessApps(relatedApps)}`,
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

async function cloudflareApi(pathname, init = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
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
    throw new Error(
      `Cloudflare API ${init.method ?? "GET"} ${pathname} failed with HTTP ${response.status}${messages ? `: ${messages}` : ""}. `
      + "The API token may need Access: Apps and Policies Read/Write plus Access: Service Tokens Read permissions.",
    );
  }
  return body;
}
