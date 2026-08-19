import assert from "node:assert/strict";
import { appendFile } from "node:fs/promises";

const action = process.argv[2]?.trim();
assert.ok(action === "open" || action === "restore", "usage: manage-staging-direct-qa.mjs <open|restore>");

const apiToken = requiredEnv("CLOUDFLARE_API_TOKEN");
const accountId = requiredEnv("CLOUDFLARE_ACCOUNT_ID");
const scriptName = process.env.STAGING_WORKER_NAME?.trim() || "giacong-vn-staging";
assert.match(scriptName, /^[a-z0-9-]{1,63}$/i, "invalid staging Worker name");

if (action === "open") {
  const [accountSubdomainResponse, currentRouteResponse] = await Promise.all([
    cloudflare(`/accounts/${accountId}/workers/subdomain`),
    cloudflare(`/accounts/${accountId}/workers/scripts/${scriptName}/subdomain`),
  ]);

  const accountSubdomain = accountSubdomainResponse.result?.subdomain?.trim() ?? "";
  assert.match(accountSubdomain, /^[a-z0-9-]{1,63}$/i, "Cloudflare account workers.dev subdomain is unavailable");

  const previousEnabled = currentRouteResponse.result?.enabled === true;
  const previousPreviews = currentRouteResponse.result?.previews_enabled === true;
  await writeGithubEnv({
    STAGING_DIRECT_QA_PREVIOUS_ENABLED: previousEnabled ? "1" : "0",
    STAGING_DIRECT_QA_PREVIOUS_PREVIEWS: previousPreviews ? "1" : "0",
  });

  await cloudflare(`/accounts/${accountId}/workers/scripts/${scriptName}/subdomain`, {
    body: JSON.stringify({ enabled: true, previews_enabled: false }),
    method: "POST",
  });

  const origin = `https://${scriptName}.${accountSubdomain}.workers.dev`;
  await writeGithubEnv({
    STAGING_DIRECT_QA: "1",
    STAGING_ORIGIN: origin,
  });
  console.log(`Temporary free-tier direct QA route enabled for ${scriptName}.`);
  console.log(`Direct QA origin: ${origin}`);
} else {
  const previousEnabled = parseBooleanEnv("STAGING_DIRECT_QA_PREVIOUS_ENABLED");
  const previousPreviews = parseBooleanEnv("STAGING_DIRECT_QA_PREVIOUS_PREVIEWS");
  if (previousEnabled === null || previousPreviews === null) {
    console.log("No direct-QA prior state was recorded; nothing to restore.");
    process.exit(0);
  }

  await cloudflare(`/accounts/${accountId}/workers/scripts/${scriptName}/subdomain`, {
    body: JSON.stringify({ enabled: previousEnabled, previews_enabled: previousPreviews }),
    method: "POST",
  });
  console.log(`Restored workers.dev route for ${scriptName}: enabled=${previousEnabled}, previews=${previousPreviews}.`);
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function parseBooleanEnv(name) {
  const value = process.env[name]?.trim();
  if (value === "1") return true;
  if (value === "0") return false;
  return null;
}

async function writeGithubEnv(values) {
  const githubEnv = requiredEnv("GITHUB_ENV");
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`).join("\n");
  await appendFile(githubEnv, `${lines}\n`, "utf8");
}

async function cloudflare(pathname, init = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    signal: AbortSignal.timeout(20000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.success !== true) {
    const messages = [
      ...(Array.isArray(body?.errors) ? body.errors : []),
      ...(Array.isArray(body?.messages) ? body.messages : []),
    ].map((item) => item?.message).filter(Boolean).join(" | ");
    throw new Error(`Cloudflare API ${pathname} failed with HTTP ${response.status}${messages ? `: ${messages}` : ""}`);
  }
  return body;
}
