import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [workflow, patchScript] = await Promise.all([
  readFile(new URL("../../../.github/workflows/cloudflare-admin-auth-staging-release-once.yml", import.meta.url), "utf8"),
  readFile(new URL("./patch-opennext-r2-preflight.mjs", import.meta.url), "utf8"),
]);

test("staging release verifies the R2 cache bucket before applying the guarded OpenNext workaround", () => {
  assert.match(workflow, /CACHE_BUCKET:\s*giacong-vn-next-cache-staging/);
  assert.match(workflow, /wrangler r2 bucket info "\$CACHE_BUCKET" --env=staging --json/);
  assert.match(workflow, /node scripts\/patch-opennext-r2-preflight\.mjs/);
  assert.match(workflow, /EXPECTED_APP_BASE_SHA:\s*3e66904c600e2b97794bb806fd9beaa26ee940ec/);
});

test("OpenNext R2 preflight workaround fails closed and preserves actual R2 population errors", () => {
  assert.match(patchScript, /EXPECTED_VERSION = "1\.20\.5"/);
  assert.match(patchScript, /Failed to check whether bucket exists: Connection error\./);
  assert.match(patchScript, /OpenNext R2 provision guard changed; refusing to patch an unknown CLI build/);
  assert.match(patchScript, /continuing to the R2 Worker population path/);
  assert.match(patchScript, /throw new Error\(`Failed to provision remote R2 bucket/);
});