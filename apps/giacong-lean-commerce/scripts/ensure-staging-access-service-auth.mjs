import assert from "node:assert/strict";

const apiToken = requiredEnv("CLOUDFLARE_API_TOKEN");
const accountId = requiredEnv("CLOUDFLARE_ACCOUNT_ID");
const serviceClientId = requiredEnv("CLOUDFLARE_ACCESS_CLIENT_ID");
const stagingDomain = "staging.kienhieu.id.vn";
const policyName = "GitHub staging deep QA";

const applications = await cloudflareApi(`/accounts/${accountId}/access/apps?per_page=100`);
const stagingApps = (applications.result ?? []).filter((app) => app?.domain === stagingDomain);
assert.equal(
  stagingApps.length,
  1,
  `Expected exactly one Access application for ${stagingDomain}, found ${stagingApps.length}.`,
);
const app = stagingApps[0];
assert.ok(app?.id, "Staging Access application must expose an id.");

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
  console.log(`Access Service Auth already configured for ${stagingDomain}.`);
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
console.log(`Created Access Service Auth policy '${policyName}' for ${stagingDomain}.`);

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
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
