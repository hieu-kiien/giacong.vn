import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const source = await readFile(new URL("./qa-admin-staging.mjs", import.meta.url), "utf8");
const runnerPath = fileURLToPath(new URL("./qa-admin-staging.mjs", import.meta.url));

function runRunner(overrides = {}) {
  const env = { ...process.env };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--no-warnings", runnerPath], {
      cwd: process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

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

test("role map supports only the full administrator and no ambiguous role override", () => {
  assert.match(source, /const supportedRoles = \["owner"\]/);
  assert.match(source, /const completeRoleStatePaths = supportedRoles\.map\(\(role\) => parsed\[role\]\)/);
  assert.match(source, /new Set\(completeRoleStatePaths\)\.size !== completeRoleStatePaths\.length/);
  assert.match(source, /QA_ADMIN_EXPECTED_ROLE cannot be used with QA_ADMIN_ROLE_STATES/);
  assert.match(source, /supportedRoles\.includes\(expectedRole\)/);
});

test("role matrix reports every role-by-route navigation expectation", () => {
  assert.match(source, /const expectedNavigationRoutes = roleNavigationRoutes\[operator\.role\]/);
  assert.match(source, /for \(const route of adminRoutes\)/);
  assert.match(source, /expectedNavigationRoutes\.includes\(route\.path\)/);
  assert.match(source, /actualNavigationRoutes\.includes\(route\.path\)/);
  assert.match(source, /sidebar visibility/);
});

test("runner fails closed before browser launch when no storage state is supplied", async () => {
  const result = await runRunner({
    QA_ADMIN_STORAGE_STATE: undefined,
    QA_ADMIN_ROLE_STATES: undefined,
    QA_ADMIN_EXPECTED_ROLE: undefined,
  });

  assert.equal(result.code, 2, result.stderr);
  assert.match(result.stderr, /ADMIN QA BLOCKED: set QA_ADMIN_STORAGE_STATE/);
  assert.doesNotMatch(result.stdout, /ADMIN STAGING QA (?:PASSED|FAILED)/);
});

test("runner fails closed when a role map includes retired roles", async () => {
  const directory = await mkdtemp(join(tmpdir(), "qa-admin-staging-"));
  try {
    const mapPath = join(directory, "role-states.json");
    const sharedStatePath = join(directory, "shared.storage.json");
    await writeFile(mapPath, JSON.stringify({
      owner: sharedStatePath,
      content_manager: sharedStatePath,
      catalog_manager: join(directory, "catalog.storage.json"),
      sales_manager: join(directory, "sales.storage.json"),
      viewer: join(directory, "viewer.storage.json"),
    }));

    const result = await runRunner({
      QA_ADMIN_STORAGE_STATE: undefined,
      QA_ADMIN_ROLE_STATES: mapPath,
      QA_ADMIN_EXPECTED_ROLE: undefined,
    });

    assert.equal(result.code, 2, result.stderr);
    assert.match(result.stderr, /ADMIN QA BLOCKED: role-state map must contain exactly owner/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
