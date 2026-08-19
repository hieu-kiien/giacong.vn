import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const workflowUrl = new URL("../../../.github/workflows/cloudflare-staging-news-media-acceptance-once.yml", import.meta.url);

test("G2 News media acceptance runs only after successful staging deep QA and records durable evidence", async () => {
  const workflow = await readFile(workflowUrl, "utf8");

  assert.match(workflow, /Cloudflare staging deep QA/);
  assert.match(workflow, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /cloudflare-staging-news-media-acceptance-once\.yml/);
  assert.match(workflow, /ACCESS_SERVICE_AUTH_DOMAIN: staging\.kienhieu\.id\.vn[\s\S]*?ACCESS_SERVICE_AUTH_REQUIRED: "false"/);
  assert.match(workflow, /ACCESS_SERVICE_AUTH_DOMAIN: admin-staging\.kienhieu\.id\.vn[\s\S]*?ACCESS_SERVICE_AUTH_REQUIRED: "true"/);
  assert.match(workflow, /node scripts\/staging-news-media-operator-qa\.mjs/);
  assert.match(workflow, /issues:\s*write/);
  assert.match(workflow, /TRACKING_ISSUE:\s*"70"/);
  assert.match(workflow, /Record failed G2 operator acceptance evidence/);
  assert.match(workflow, /steps\.gate\.outputs\.should_run == 'true' && failure\(\)/);
  assert.match(workflow, /G2 News media operator acceptance failure evidence/);
  assert.match(workflow, /G2 remains OPEN/);
});

test("G2 proves the protected admin mutation boundary before creating staging data and emits only safe response diagnostics", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  const preflight = "Verify protected admin mutation boundary";
  const operator = "Run Access-authenticated News media operator acceptance";

  assert.ok(workflow.includes(preflight));
  assert.ok(workflow.includes(operator));
  assert.ok(workflow.indexOf(preflight) < workflow.indexOf(operator));
  assert.match(workflow, /--request POST/);
  assert.match(workflow, /\$\{ADMIN_STAGING_ORIGIN\}\/api\/admin\/news/);
  assert.match(workflow, /--data '\{\}'/);
  assert.match(workflow, /\[\[ "\$status" != "422" \]\]/);
  assert.match(workflow, /VALIDATION_ERROR/);
  assert.match(workflow, /G2_ADMIN_MUTATION_PREFLIGHT_DIAGNOSTIC/);
  assert.match(workflow, /cf-mitigated:/i);
  assert.match(workflow, /cf-ray:/i);
  assert.match(workflow, /content-type:/i);
  assert.match(workflow, /server:/i);
  assert.match(workflow, /cut -c1-500/);
  assert.doesNotMatch(workflow, /bodySnippet.*CLOUDFLARE_ACCESS_CLIENT_SECRET/);
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
