import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const workflowUrl = new URL("../../../.github/workflows/cloudflare-staging-deep-qa.yml", import.meta.url);

test("staging performance QA uses existing Playwright with mobile-like lab conditions and explicit poor-boundary budgets", async () => {
  const runtime = await readFile(new URL("scripts/staging-performance-qa.mjs", root), "utf8");

  assert.match(runtime, /CLOUDFLARE_ACCESS_CLIENT_ID/);
  assert.match(runtime, /CLOUDFLARE_ACCESS_CLIENT_SECRET/);
  assert.match(runtime, /lcpMs:\s*4000/);
  assert.match(runtime, /STAGING_PERF_LCP_BUDGET_MS/);
  assert.match(runtime, /cls:\s*0\.25/);
  assert.match(runtime, /ttfbMs:\s*2500/);
  assert.match(runtime, /domContentLoadedMs:\s*8000/);
  assert.match(runtime, /largest-contentful-paint/);
  assert.match(runtime, /layout-shift/);
  assert.match(runtime, /Network\.emulateNetworkConditions/);
  assert.match(runtime, /Emulation\.setCPUThrottlingRate/);
  assert.match(runtime, /connectionType:\s*"cellular4g"/);
  assert.match(runtime, /poor-boundary/);
  assert.match(runtime, /Field p75 RUM\/CrUX remains a separate launch gate/);
});

test("self-hosted staging QA declares its calibrated LCP budget in the workflow", async () => {
  const workflow = await readFile(workflowUrl, "utf8");

  assert.match(workflow, /STAGING_PERF_LCP_BUDGET_MS:\s*[\"']?5000/);
});

test("post-deploy deep QA runs performance after browser accessibility and before the broader browser suite", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  const accessibility = "node scripts/staging-accessibility-qa.mjs";
  const performance = "node scripts/staging-performance-qa.mjs";
  const deepQa = "node scripts/staging-deep-qa.mjs";

  assert.ok(workflow.includes(accessibility));
  assert.ok(workflow.includes(performance));
  assert.ok(workflow.includes(deepQa));
  assert.ok(workflow.indexOf(accessibility) < workflow.indexOf(performance));
  assert.ok(workflow.indexOf(performance) < workflow.indexOf(deepQa));
});
