import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const runnerPath = new URL("./qa-admin-stress-staging.mjs", import.meta.url);
const helperPath = new URL("./qa-admin-stress-helpers.mjs", import.meta.url);
const packagePath = new URL("../package.json", import.meta.url);

test("admin stress runner is bounded, authenticated and read-only", async () => {
  const source = await readFile(runnerPath, "utf8");
  const helperSource = await readFile(helperPath, "utf8");
  assert.match(source, /QA_ADMIN_STORAGE_STATE/);
  assert.match(source, /parsedBaseUrl\.protocol\s*!==\s*"https:"/);
  assert.match(source, /admin-staging\.kienhieu\.id\.vn/);
  assert.match(source, /MAX_CONCURRENCY\s*=\s*4/);
  assert.match(source, /boundedInteger\("QA_ADMIN_STRESS_CONCURRENCY", DEFAULT_CONCURRENCY, MAX_CONCURRENCY\)/);
  assert.match(source, /newContext\(\{\s*storageState/);
  assert.match(helperSource, /POST.*PUT.*PATCH.*DELETE/s);
  assert.match(helperSource, /cdn-cgi\/rum/);
  assert.match(source, /Worker exceeded resource limits/);
  assert.match(source, /ADMIN STRESS/);
});

test("package exposes the controlled staging stress command", async () => {
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  assert.equal(packageJson.scripts["qa:admin-stress"], "node scripts/qa-admin-stress-staging.mjs");
  assert.match(packageJson.scripts["test:admin"], /qa-admin-stress-contract\.test\.mjs/);
});
