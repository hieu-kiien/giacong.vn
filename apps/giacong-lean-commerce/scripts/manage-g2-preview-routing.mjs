import assert from "node:assert/strict";
import { appendFile } from "node:fs/promises";

const action = process.argv[2]?.trim();
assert.ok(action === "open" || action === "restore", "usage: manage-g2-preview-routing.mjs <open|restore>");

const apiToken = requiredEnv("CLOUDFLARE_API_TOKEN");
const accountId = requiredEnv("CLOUDFLARE_ACCOUNT_ID");
const scriptName = process.env.STAGING_WORKER_NAME?.trim() || "giacong-vn-staging";
assert.match(scriptName, /^[a-z0-9-]{1,63}$/i, "invalid staging Worker name");

if (action === "open") {
  const current = await cloudflare(`/accounts/${accountId}/workers/scripts/${scriptName}/subdomain`);
  const previousEnabled = current.result?.enabled === true;
  const previousPreviews = current.result?.previews_enabled === true;

  await writeGithubEnv({
    G2_PREVIEW_PREVIOUS_ENABLED: previousEnabled ? "1" : "0",
    G2_PREVIEW_PREVIOUS_PREVIEWS: previousPreviews ? "1" : "0",
  });

  await cloudflare(`/accounts/${accountId}/workers/scripts/${scriptName}/subdomain`, {
    body: JSON.stringify({ enabled: previousEnabled, previews_enabled: true }),
    method: "POST",
  });

  const verified = await cloudflare(`/accounts/${accountId}/workers/scripts/${scriptName}/subdomain`);
  assert.equal(verified.result?.enabled === true, previousEnabled, "Enabling preview routing must not change the root workers.dev route state.");
  assert.equal(verified.result?.previews_enabled, true, "Preview routing must be enabled before the G2 preview version is uploaded.");
  console.log(`Temporarily enabled Worker preview URLs for ${scriptName} while preserving workers.dev enabled=${previousEnabled}.`);
} else {
  const previousEnabled = parseBooleanEnv("G2_PREVIEW_PREVIOUS_ENABLED");
  const previousPreviews = parseBooleanEnv("G2_PREVIEW_PREVIOUS_PREVIEWS");
  if (previousEnabled === null || previousPreviews === null) {
    console.log("No G2 preview-routing prior state was recorded; nothing to restore.");
    process.exit(0);
  }

  await cloudflare(`/accounts/${accountId}/workers/scripts/${scriptName}/subdomain`, {
    body: JSON.stringify({ enabled: previousEnabled, previews_enabled: previousPreviews }),
    method: "POST",
  });

  const verified = await cloudflare(`/accounts/${accountId}/workers/scripts/${scriptName}/subdomain`);
  assert.equal(verified.result?.enabled === true, previousEnabled, "Restored workers.dev state does not match the recorded value.");
  assert.equal(verified.result?.previews_enabled === true, previousPreviews, "Restored preview URL state does not match the recorded value.");
  console.log(`Restored Worker subdomain state for ${scriptName}: enabled=${previousEnabled}, previews=${previousPreviews}.`);
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
    throw new Error(`Cloudflare API ${init.method ?? "GET"} ${pathname} failed with HTTP ${response.status}${messages ? `: ${messages}` : ""}.`);
  }
  return body;
}
