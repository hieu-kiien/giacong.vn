import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ciUrl = new URL("../../../.github/workflows/ci-cloudflare.yml", import.meta.url);
const deepQaUrl = new URL("../../../.github/workflows/cloudflare-staging-deep-qa.yml", import.meta.url);

test("pull requests package OpenNext for staging without deploying remote state", async () => {
  const workflow = await readFile(ciUrl, "utf8");

  assert.match(workflow, /cloudflare-package:/);
  assert.match(workflow, /if: github\.event_name == 'pull_request'/);
  assert.match(workflow, /npm run cf:build:staging/);
  assert.match(workflow, /wrangler@4\.115\.0 deploy --env=staging --dry-run/);
});

test("validated master applies D1 migrations before deploying the same staging build", async () => {
  const workflow = await readFile(ciUrl, "utf8");
  const migration = "d1 migrations apply GIACONG_VN_CATALOG --env=staging --remote";
  const deploy = "opennextjs-cloudflare deploy --env=staging";

  assert.match(workflow, /staging-deploy:/);
  assert.match(workflow, /if: github\.event_name != 'pull_request'/);
  assert.ok(workflow.includes(migration), "staging deploy must apply pending D1 migrations");
  assert.ok(workflow.includes(deploy), "staging deploy must publish the already built OpenNext package");
  assert.ok(workflow.indexOf(migration) < workflow.indexOf(deploy), "D1 migrations must complete before Worker deployment");
  assert.doesNotMatch(workflow, /Staging remains unchanged/);
});

test("deep QA waits for successful staging deployment and checks out the deployed commit", async () => {
  const workflow = await readFile(deepQaUrl, "utf8");

  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /CI and Cloudflare staging gate/);
  assert.match(workflow, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /github\.event\.workflow_run\.head_sha/);
  assert.doesNotMatch(workflow, /\n  push:/);
  assert.match(workflow, /https:\/\/staging\.kienhieu\.id\.vn/);
  assert.doesNotMatch(workflow, /workers\.dev/);
});
