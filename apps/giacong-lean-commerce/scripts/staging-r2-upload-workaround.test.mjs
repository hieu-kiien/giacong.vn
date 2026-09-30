import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [workflow, packageJson, patchScript] = await Promise.all([
  readFile(new URL("../../../.github/workflows/cloudflare-staging-upload-once.yml", import.meta.url), "utf8").then((value) => value.replace(/\r\n/g, "\n")),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("./patch-opennext-r2-preflight.mjs", import.meta.url), "utf8"),
]);

test("staging verifies the real R2 bucket and patches OpenNext before one upload", () => {
  const verifyIndex = workflow.indexOf("name: Verify staging R2 cache bucket access");
  const installIndex = workflow.indexOf("run: npm ci");
  const patchIndex = workflow.indexOf("node scripts/patch-opennext-r2-preflight.mjs");
  const uploadIndex = workflow.indexOf("run: npm run cf:upload:staging");

  assert.ok(verifyIndex >= 0, "staging R2 bucket must be verified with Wrangler");
  assert.match(workflow, /r2 bucket info giacong-vn-next-cache-staging --json/);
  assert.ok(installIndex > verifyIndex, "dependencies install after remote bucket verification");
  assert.ok(patchIndex > installIndex, "guarded patch runs after installing the pinned adapter");
  assert.ok(uploadIndex > patchIndex, "OpenNext patch runs before uploading");
  assert.equal((workflow.match(/npm run cf:upload:staging/g) ?? []).length, 1, "upload runs once");
  assert.doesNotMatch(workflow, /for attempt in|retrying in|sleep \$\{delay\}/);
  assert.match(workflow, /wrangler deployments status --env=staging --json/g);
  assert.match(workflow, /wrangler versions list --env=staging --json/);

  const scripts = JSON.parse(packageJson).scripts;
  assert.match(scripts["test:ci-workflows"], /staging-r2-upload-workaround\.test\.mjs/);
});

test("the workaround bypasses only the known preflight error and fails closed", () => {
  assert.match(patchScript, /EXPECTED_VERSION = "1\.20\.5"/);
  assert.match(patchScript, /ACCEPTED_ERROR = "Failed to check whether bucket exists: Connection error\."/);
  assert.match(patchScript, /Unsupported @opennextjs\/cloudflare version/);
  assert.match(patchScript, /OpenNext R2 provision guard changed; refusing to patch an unknown CLI build/);
  assert.match(patchScript, /if \(result\.error === /);
  assert.match(patchScript, /continuing to the R2 Worker population path/);
  assert.match(patchScript, /throw new Error\(`Failed to provision remote R2 bucket/);
});
