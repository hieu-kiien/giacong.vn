import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const workflowUrl = new URL("../../../.github/workflows/cloudflare-staging-news-media-acceptance-once.yml", import.meta.url);

test("G2 News media acceptance runs only after successful staging deep QA and records durable evidence", async () => {
  const workflow = await readFile(workflowUrl, "utf8");

  assert.match(workflow, /Cloudflare staging deep QA/);
  assert.match(workflow, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /admin-staging\.kienhieu\.id\.vn/);
  assert.match(workflow, /node scripts\/staging-news-media-operator-qa\.mjs/);
  assert.match(workflow, /issues:\s*write/);
  assert.match(workflow, /TRACKING_ISSUE:\s*"70"/);
  assert.match(workflow, /cloudflare-staging-news-media-acceptance-once\.yml/);
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
