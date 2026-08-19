import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const workflowUrl = new URL("../../../.github/workflows/cloudflare-staging-news-media-acceptance-once.yml", import.meta.url);
const previewAccessUrl = new URL("scripts/prepare-g2-preview-access.mjs", root);
const previewConfigUrl = new URL("scripts/prepare-g2-preview-wrangler.mjs", root);

test("G2 News media acceptance runs only after successful staging deep QA and records durable evidence", async () => {
  const workflow = await readFile(workflowUrl, "utf8");

  assert.match(workflow, /Cloudflare staging deep QA/);
  assert.match(workflow, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /cloudflare-staging-news-media-acceptance-once\.yml/);
  assert.match(workflow, /node scripts\/staging-news-media-operator-qa\.mjs/);
  assert.match(workflow, /issues:\s*write/);
  assert.match(workflow, /TRACKING_ISSUE:\s*"70"/);
  assert.match(workflow, /Record failed G2 operator acceptance evidence/);
  assert.match(workflow, /steps\.gate\.outputs\.should_run == 'true' && failure\(\)/);
  assert.match(workflow, /G2 News media operator acceptance failure evidence/);
  assert.match(workflow, /G2 remains OPEN/);
});

test("G2 uses an Access-protected Worker preview for admin mutation without changing active staging traffic", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  const previewAccess = await readFile(previewAccessUrl, "utf8");
  const previewConfig = await readFile(previewConfigUrl, "utf8");

  assert.match(workflow, /node scripts\/prepare-g2-preview-access\.mjs/);
  assert.match(workflow, /node scripts\/prepare-g2-preview-wrangler\.mjs/);
  assert.match(workflow, /opennextjs-cloudflare build --env=staging --config=\.wrangler-g2-preview\.json/);
  assert.match(workflow, /opennextjs-cloudflare upload --env=staging --config=\.wrangler-g2-preview\.json[\s\S]*preview-alias[\s\S]*g2-admin/);
  assert.match(workflow, /ADMIN_STAGING_ORIGIN:\s*\$\{\{ steps\.preview_access\.outputs\.origin \}\}/);
  assert.match(workflow, /ACTIVE_STAGING_VERSION/);
  assert.match(workflow, /Verify active staging traffic remained unchanged/);
  assert.doesNotMatch(workflow, /--request POST[\s\S]*\$\{ADMIN_STAGING_ORIGIN\}\/api\/admin\/news[\s\S]*--data '\{\}'/);

  assert.match(previewAccess, /workers\/workers\/\$\{encodeURIComponent\(workerName\)\}/);
  assert.match(previewAccess, /type:\s*"preview_worker"/);
  assert.match(previewAccess, /worker_id:\s*workerId/);
  assert.match(previewAccess, /decision:\s*"non_identity"/);
  assert.match(previewAccess, /service_token/);
  assert.match(previewAccess, /g2-admin/);
  assert.match(previewAccess, /workers\/subdomain/);

  assert.match(previewConfig, /preview_urls\s*=\s*true|preview_urls\s*:\s*true/);
  assert.match(previewConfig, /workers_dev\s*=\s*false|workers_dev\s*:\s*false/);
  assert.match(previewConfig, /ADMIN_HOSTNAME/);
  assert.match(previewConfig, /ADMIN_HOSTNAMES/);
  assert.match(previewConfig, /POLICY_AUD/);
  assert.match(previewConfig, /Production POLICY_AUD/);
});

test("G2 operator runtime exercises persisted thumbnail protection, replacement and D1/R2 post-conditions", async () => {
  const runtime = await readFile(new URL("scripts/staging-news-media-operator-qa.mjs", root), "utf8");

  assert.match(runtime, /service:\$\{accessClientId\}/);
  assert.match(runtime, /INSERT INTO admin_members/);
  assert.match(runtime, /MEDIA_IN_USE/);
  assert.match(runtime, /thumbnailUrl:\s*firstAsset\.publicUrl/);
  assert.match(runtime, /thumbnailUrl:\s*secondAsset\.publicUrl/);
  assert.match(runtime, /oldAssetR2HttpStatus:\s*404/);
  assert.match(runtime, /replacementR2HttpStatus:\s*200/);
  assert.match(runtime, /DELETE FROM admin_members/);
  assert.match(runtime, /articleArchived/);
});
