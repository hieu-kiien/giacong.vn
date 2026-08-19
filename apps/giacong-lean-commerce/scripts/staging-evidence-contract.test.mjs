import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ciWorkflowUrl = new URL("../../../.github/workflows/ci-cloudflare.yml", import.meta.url);
const deepQaWorkflowUrl = new URL("../../../.github/workflows/cloudflare-staging-deep-qa.yml", import.meta.url);

test("master staging deployment records a durable issue #70 breadcrumb with commit, run, and active Worker version", async () => {
  const workflow = await readFile(ciWorkflowUrl, "utf8");

  assert.match(
    workflow,
    /staging-deploy:[\s\S]*?permissions:\s*\n\s+contents: read\s*\n\s+issues: write/,
  );
  assert.match(workflow, /name: Record master staging deployment evidence/);
  assert.match(workflow, /if: github\.ref == 'refs\/heads\/master'/);
  assert.match(workflow, /TRACKING_ISSUE: "70"/);
  assert.match(workflow, /source CI run id: \$\{GITHUB_RUN_ID\}/);
  assert.match(workflow, /master SHA: \$\{GITHUB_SHA\}/);
  assert.match(workflow, /active staging Worker version: \$\{version_id\}/);
  assert.match(workflow, /\.versions[\s\S]*select\(\.percentage == 100\)/);
  assert.match(workflow, /issues\/\$\{TRACKING_ISSUE\}\/comments/);
});

test("failed master staging gate records an explicit non-acceptance breadcrumb", async () => {
  const workflow = await readFile(ciWorkflowUrl, "utf8");

  assert.match(workflow, /staging-gate-failure-evidence:/);
  assert.match(workflow, /always\(\)/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/master'/);
  assert.match(workflow, /needs\.quality\.result != 'success'/);
  assert.match(workflow, /needs\.staging-deploy\.result != 'success'/);
  assert.match(workflow, /QUALITY_RESULT: \$\{\{ needs\.quality\.result \}\}/);
  assert.match(workflow, /STAGING_DEPLOY_RESULT: \$\{\{ needs\.staging-deploy\.result \}\}/);
  assert.match(workflow, /G1 staging gate failure evidence/);
  assert.match(workflow, /G1 remains OPEN/);
  assert.match(workflow, /does not authorize production mutation/);
});

test("successful post-deploy QA records the same source CI run only after the free-tier direct route is restored", async () => {
  const workflow = await readFile(deepQaWorkflowUrl, "utf8");
  const edgeQa = "node scripts/staging-edge-protection-qa.mjs";
  const openDirectQa = "node scripts/manage-staging-direct-qa.mjs open";
  const newsQa = "node scripts/staging-news-qa.mjs";
  const restoreDirectQa = "node scripts/manage-staging-direct-qa.mjs restore";
  const evidenceStep = "name: Record successful master staging QA evidence";

  assert.match(
    workflow,
    /qa:[\s\S]*?permissions:\s*\n\s+contents: read\s*\n\s+issues: write/,
  );
  for (const marker of [edgeQa, openDirectQa, newsQa, restoreDirectQa, evidenceStep]) {
    assert.ok(workflow.includes(marker), `missing G1 workflow marker: ${marker}`);
  }
  assert.ok(workflow.indexOf(edgeQa) < workflow.indexOf(openDirectQa));
  assert.ok(workflow.indexOf(openDirectQa) < workflow.indexOf(newsQa));
  assert.ok(workflow.indexOf(newsQa) < workflow.indexOf(restoreDirectQa));
  assert.ok(workflow.indexOf(restoreDirectQa) < workflow.indexOf(evidenceStep));
  assert.match(workflow, /name: Restore persistent workers\.dev state\s*\n\s+if: always\(\)/);
  assert.match(workflow, /if: success\(\) && github\.event_name == 'workflow_run'/);
  assert.match(workflow, /TRACKING_ISSUE: "70"/);
  assert.match(workflow, /SOURCE_CI_RUN_ID: \$\{\{ github\.event\.workflow_run\.id \}\}/);
  assert.match(workflow, /SOURCE_SHA: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
  assert.match(workflow, /custom staging edge boundary: PASS/);
  assert.match(workflow, /temporary guarded workers\.dev application QA: PASS and restored/);
  assert.match(workflow, /baseline application security headers: PASS/);
  assert.match(workflow, /accessibility semantics\/keyboard focus: PASS/);
  assert.match(workflow, /performance lab anti-regression budgets: PASS/);
  assert.match(workflow, /staging public\/runtime deep QA: PASS/);
  assert.match(workflow, /News staging regression QA: PASS/);
  assert.match(workflow, /issues\/\$\{TRACKING_ISSUE\}\/comments/);
});

test("failed post-deploy QA records non-acceptance only after cleanup is attempted", async () => {
  const workflow = await readFile(deepQaWorkflowUrl, "utf8");
  const restoreDirectQa = "node scripts/manage-staging-direct-qa.mjs restore";
  const failureStep = "name: Record failed master staging QA evidence";

  assert.ok(workflow.includes(failureStep));
  assert.ok(workflow.indexOf(restoreDirectQa) < workflow.indexOf(failureStep));
  assert.match(workflow, /if: failure\(\) && github\.event_name == 'workflow_run'/);
  assert.match(workflow, /working-directory: \./);
  assert.match(workflow, /G1 staging deep-QA failure evidence/);
  assert.match(workflow, /SOURCE_CI_RUN_ID: \$\{\{ github\.event\.workflow_run\.id \}\}/);
  assert.match(workflow, /SOURCE_SHA: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
  assert.match(workflow, /attempted to restore the temporary direct workers\.dev state/);
  assert.match(workflow, /G1 remains OPEN/);
  assert.match(workflow, /breadcrumb is not acceptance evidence/);
});
