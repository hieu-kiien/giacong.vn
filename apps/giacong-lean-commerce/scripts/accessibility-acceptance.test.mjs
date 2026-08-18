import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const workflowUrl = new URL("../../../.github/workflows/cloudflare-staging-deep-qa.yml", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("staging accessibility QA covers public semantic and keyboard acceptance", async () => {
  const runtime = await source("scripts/staging-accessibility-qa.mjs");

  assert.match(runtime, /CLOUDFLARE_ACCESS_CLIENT_ID/);
  assert.match(runtime, /CLOUDFLARE_ACCESS_CLIENT_SECRET/);
  assert.match(runtime, /document\.documentElement\.lang/);
  assert.match(runtime, /document\.title/);
  assert.match(runtime, /main, \[role='main'\]/);
  assert.match(runtime, /img:not\(\[alt\]\)/);
  assert.match(runtime, /input, select, textarea/);
  assert.match(runtime, /duplicateIds/);
  assert.match(runtime, /namelessButtons/);
  assert.match(runtime, /namelessLinks/);
  assert.match(runtime, /page\.keyboard\.press\("Tab"\)/);
  assert.match(runtime, /:focus-visible/);
  assert.match(runtime, /outlineVisible \|\| shadowVisible/);
});

test("post-deploy deep QA runs accessibility after Chromium installation and before broader browser QA", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  const install = "npx playwright install --with-deps chromium";
  const accessibility = "node scripts/staging-accessibility-qa.mjs";
  const deepQa = "node scripts/staging-deep-qa.mjs";

  assert.ok(workflow.includes(install), "Chromium must be installed before accessibility QA");
  assert.ok(workflow.includes(accessibility), "staging accessibility QA must run post-deploy");
  assert.ok(workflow.includes(deepQa), "existing staging browser QA must remain enabled");
  assert.ok(workflow.indexOf(install) < workflow.indexOf(accessibility));
  assert.ok(workflow.indexOf(accessibility) < workflow.indexOf(deepQa));
});
