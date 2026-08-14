import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("keeps catalog and media credentials out of local environment variables", async () => {
  const environment = await readFile(new URL(".env.example", root), "utf8");

  assert.doesNotMatch(environment, /BAGISTO_API_URL|BAGISTO_PROXY_ORIGIN|BAGISTO_API_TIMEOUT_MS/);
  assert.match(environment, /GIACONG_VN_CATALOG/);
  assert.match(environment, /GIACONG_VN_PRODUCT_MEDIA/);
});

test("allows the local IP hostname used by the product demo", async () => {
  const nextConfig = await readFile(new URL("next.config.ts", root), "utf8");

  assert.match(nextConfig, /allowedDevOrigins:\s*\[[^\]]*"127\.0\.0\.1"/);
});

test("Cloudflare bindings replace the former Bagisto proxy boundary", async () => {
  const [nextConfig, wrangler, catalog] = await Promise.all([
    readFile(new URL("next.config.ts", root), "utf8"),
    readFile(new URL("wrangler.jsonc", root), "utf8"),
    readFile(new URL("src/lib/cloudflare-catalog.ts", root), "utf8"),
  ]);

  assert.match(nextConfig, /initOpenNextCloudflareForDev\(\)/);
  assert.doesNotMatch(nextConfig, /BAGISTO_PROXY_ORIGIN|\/themes\/admin|\/storage\/:path/);
  assert.match(wrangler, /"binding":\s*"GIACONG_VN_CATALOG"/);
  assert.match(wrangler, /"binding":\s*"GIACONG_VN_PRODUCT_MEDIA"/);
  assert.match(catalog, /getCloudflareContext/);
  assert.match(catalog, /GIACONG_VN_CATALOG/);
});

test("runs focused contact, catalog, and service tests before lint in the standard check contract", async () => {
  const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  assert.equal(
    packageJson.scripts.check,
    "npm run test:contact && npm run test:catalog && npm run test:catalog-purchase-ui && npm run test:service"
      + " && npm run test:commerce && npm run test:header"
      + " && npm run test:listing && npm run test:detail"
      + " && npm run lint && npm run typecheck && npm run build",
  );
});

test("the visible preview launcher is portable and reads its tracked preview port", async () => {
  const [environment, launcher] = await Promise.all([
    readFile(new URL(".env.example", root), "utf8"),
    readFile(new URL("scripts/start-visible-preview.ps1", root), "utf8"),
  ]);

  assert.match(environment, /COMMERCE_PREVIEW_PORT=4310/);
  assert.match(launcher, /\$env:COMMERCE_PREVIEW_PORT/);
  assert.match(launcher, /\$PSScriptRoot/);
  assert.match(launcher, /\$env:TEMP/);
  assert.doesNotMatch(launcher, /C:\\Users\\/i);
  assert.doesNotMatch(launcher, /19999|(?:^|\D)(?:3000|8000|8001)(?:\D|$)/);
});

test("uses Webpack for builds inside a Git worktree", async () => {
  const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  assert.equal(packageJson.scripts.build, "next build --webpack");
});

test("resolves the Next binary through the package so QA harnesses run in a worktree", async () => {
  const scripts = (await readdir(new URL("scripts/", root)))
    .filter((name) => name.startsWith("verify-") && name.endsWith(".mjs"));
  assert.ok(scripts.length >= 4, "expected the storefront verify-* QA harnesses to be present");

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
