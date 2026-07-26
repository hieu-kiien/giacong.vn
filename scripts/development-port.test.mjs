import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
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

test("runs focused contact and catalog tests before lint in the standard check contract", async () => {
  const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  assert.equal(
    packageJson.scripts.check,
    "npm run test:contact && npm run test:catalog && npm run test:catalog-purchase-ui && npm run lint && npm run typecheck && npm run build",
  );
});

test("uses Webpack for builds inside a Git worktree", async () => {
  const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  assert.equal(packageJson.scripts.build, "next build --webpack");
});

test("resolves the Next binary through the package so QA harnesses run in a worktree", async () => {
  const scripts = (await readdir(new URL("scripts/", root)))
    .filter((name) => name.startsWith("verify-") && name.endsWith(".mjs"));
  assert.ok(scripts.length >= 5, "expected the verify-* QA harnesses to be present");

  for (const name of scripts) {
    const source = await readFile(new URL(`scripts/${name}`, root), "utf8");
    if (!source.includes("spawn(")) continue;
    assert.doesNotMatch(
      source,
      /["']node_modules\/next\/dist\/bin\/next["']/,
      `${name} must not spawn Next through a cwd-relative node_modules path`,
    );
    assert.match(
      source,
      /nextBinPath/,
      `${name} must spawn Next through the resolved nextBinPath`,
    );
  }
});

test("resolves the Next CLI to a real absolute path", async () => {
  const { nextBinPath } = await import("./next-bin.mjs");
  assert.ok(nextBinPath.endsWith("next"), "nextBinPath must point at the Next CLI entry point");
  await readFile(nextBinPath, "utf8");
});
