import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./qa-admin-staging.mjs", import.meta.url), "utf8");

test("admin staging QA is authenticated, bounded and read-only", () => {
  assert.match(source, /QA_ADMIN_BASE_URL/);
  assert.match(source, /QA_ADMIN_STORAGE_STATE/);
  assert.match(source, /QA_ADMIN_ROLE_STATES/);
  assert.match(source, /storageState/);
  assert.match(source, /supportedRoles = \[/);
  assert.match(source, /roleNavigationRoutes/);
  assert.match(source, /JSON\.parse/);
  assert.match(source, /const adminRoutes = \[/);
  assert.match(source, /heading\.waitFor\(\{ state: "visible", timeout: 15_000 \}\)/);
  assert.match(source, /page\.on\("console"/);
  assert.match(source, /page\.on\("pageerror"/);
  assert.match(source, /\["error", "warning"\]\.includes\(message\.type\(\)\)/);
  assert.doesNotMatch(source, /(?:page|locator)\.(?:click|fill|type|press)\(/);
  assert.doesNotMatch(source, /method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/i);
});
