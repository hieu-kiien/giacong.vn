import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("uses the reserved Bagisto development port instead of stale port 8000", async () => {
  const [environment, bagistoApi, adminBff] = await Promise.all([
    readFile(new URL(".env.example", root), "utf8"),
    readFile(new URL("src/lib/bagisto-api.ts", root), "utf8"),
    readFile(new URL("src/lib/admin-bff.ts", root), "utf8"),
  ]);

  assert.match(environment, /BAGISTO_API_URL=http:\/\/127\.0\.0\.1:18001/);
  assert.match(bagistoApi, /DEVELOPMENT_DEFAULT_ORIGIN = "http:\/\/127\.0\.0\.1:18001"/);
  assert.match(adminBff, /DEFAULT_BASE = "http:\/\/127\.0\.0\.1:18001\/api\/b2b\/admin\/v1"/);
  assert.doesNotMatch(environment + bagistoApi + adminBff, /127\.0\.0\.1:8000/);
});

test("runs focused contact tests before lint in the standard check contract", async () => {
  const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  assert.equal(
    packageJson.scripts.check,
    "npm run test:contact && npm run lint && npm run typecheck && npm run build",
  );
});
