import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const workflowUrl = new URL("../../../.github/workflows/cloudflare-staging-deep-qa.yml", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("Next emits the baseline security response headers without framework disclosure", async () => {
  const config = await source("next.config.ts");

  assert.match(config, /poweredByHeader:\s*false/);
  assert.match(config, /Strict-Transport-Security/);
  assert.match(config, /max-age=31536000; includeSubDomains/);
  assert.match(config, /X-Content-Type-Options/);
  assert.match(config, /nosniff/);
  assert.match(config, /X-Frame-Options/);
  assert.match(config, /DENY/);
  assert.match(config, /Referrer-Policy/);
  assert.match(config, /strict-origin-when-cross-origin/);
  assert.match(config, /Permissions-Policy/);
  assert.match(config, /camera=\(\), microphone=\(\), geolocation=\(\), payment=\(\), usb=\(\)/);
  assert.match(config, /X-DNS-Prefetch-Control/);
  assert.match(config, /source:\s*"\/:path\*"/);
});

test("post-deploy staging QA verifies the security headers through Cloudflare Access", async () => {
  const [workflow, runtime] = await Promise.all([
    readFile(workflowUrl, "utf8"),
    source("scripts/staging-security-qa.mjs"),
  ]);

  assert.match(workflow, /Verify baseline security headers/);
  assert.match(workflow, /node scripts\/staging-security-qa\.mjs/);
  assert.match(runtime, /CLOUDFLARE_ACCESS_CLIENT_ID/);
  assert.match(runtime, /CLOUDFLARE_ACCESS_CLIENT_SECRET/);
  assert.match(runtime, /strict-transport-security/);
  assert.match(runtime, /x-content-type-options/);
  assert.match(runtime, /x-frame-options/);
  assert.match(runtime, /referrer-policy/);
  assert.match(runtime, /permissions-policy/);
  assert.match(runtime, /x-powered-by/);
});
