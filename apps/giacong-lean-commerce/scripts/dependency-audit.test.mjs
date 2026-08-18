import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const workflowUrl = new URL("../../../.github/workflows/ci-cloudflare.yml", import.meta.url);

test("production dependency audit excludes dev tooling and blocks high-or-critical advisories", async () => {
  const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  assert.equal(packageJson.scripts["audit:prod"], "npm audit --omit=dev --audit-level=high");
});

test("CI audits production dependencies before running the application quality suite", async () => {
  const workflow = await readFile(workflowUrl, "utf8");
  const install = "run: npm ci";
  const audit = "run: npm run audit:prod";
  const checks = "run: npm run check";

  assert.match(workflow, /name: Audit production dependencies/);
  assert.ok(workflow.includes(install));
  assert.ok(workflow.includes(audit));
  assert.ok(workflow.includes(checks));
  assert.ok(workflow.indexOf(install) < workflow.indexOf(audit));
  assert.ok(workflow.indexOf(audit) < workflow.indexOf(checks));
});
