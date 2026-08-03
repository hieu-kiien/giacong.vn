import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("uses the reserved Bagisto development port instead of stale port 8000", async () => {
  const [environment, bagistoApi] = await Promise.all([
    readFile(new URL(".env.example", root), "utf8"),
    readFile(new URL("src/lib/bagisto-api.ts", root), "utf8"),
  ]);

  assert.match(environment, /BAGISTO_API_URL=http:\/\/127\.0\.0\.1:18001/);
  assert.match(bagistoApi, /DEVELOPMENT_DEFAULT_ORIGIN = "http:\/\/127\.0\.0\.1:18001"/);
  assert.doesNotMatch(environment + bagistoApi, /127\.0\.0\.1:8000/);
});

test("allows the local IP hostname used by the product demo", async () => {
  const nextConfig = await readFile(new URL("next.config.ts", root), "utf8");

  assert.match(nextConfig, /allowedDevOrigins:\s*\[[^\]]*"127\.0\.0\.1"/);
});

test("does not retain a personal LAN address in development origins", async () => {
  const nextConfig = await readFile(new URL("next.config.ts", root), "utf8");

  assert.doesNotMatch(nextConfig, /192\.168\.\d{1,3}\.\d{1,3}/);
});

test("uses the full frontend quality gate in CI", async () => {
  const workflow = await readFile(new URL(".github/workflows/ci.yml", root), "utf8");

  assert.match(workflow, /run:\s*npm run check/);
});

test("runs the Bagisto style and B2B checks in CI", async () => {
  const workflow = await readFile(new URL(".github/workflows/ci.yml", root), "utf8");

  assert.match(workflow, /^\s*bagisto:/m);
  assert.match(workflow, /working-directory:\s*bagisto/);
  assert.match(workflow, /composer install --no-interaction --prefer-dist --no-progress/);
  assert.match(workflow, /vendor\/bin\/pint --test/);
  assert.match(workflow, /composer test:b2b/);
});

test("binds the production storefront only to localhost", async () => {
  const productionCompose = await readFile(new URL("docker-compose.production.yml", root), "utf8");

  assert.match(productionCompose, /image:\s*giacong-lean-commerce:latest/);
  assert.match(productionCompose, /127\.0\.0\.1:\$\{PORT:-3000\}:3000/);
  assert.doesNotMatch(productionCompose, /\bdev:/);
});

test("one public hostname can proxy the native Bagisto admin and its assets", async () => {
  const [environment, nextConfig, masterPlan] = await Promise.all([
    readFile(new URL(".env.example", root), "utf8"),
    readFile(new URL("next.config.ts", root), "utf8"),
    readFile(new URL("docs/COMMERCE_PLATFORM_MASTER_PLAN.md", root), "utf8"),
  ]);

  assert.match(environment, /BAGISTO_PROXY_ORIGIN=http:\/\/127\.0\.0\.1:18001/);
  assert.match(nextConfig, /process\.env\.BAGISTO_PROXY_ORIGIN/);
  assert.match(nextConfig, /source:\s*"\/admin\/:path\*"/);
  assert.match(nextConfig, /source:\s*"\/themes\/admin\/:path\*"/);
  assert.match(nextConfig, /source:\s*"\/storage\/:path\*"/);
  assert.match(nextConfig, /source:\s*"\/cache\/:path\*"/);
  assert.doesNotMatch(nextConfig, /localhost:4317/, "the deployment config must remain hostname-agnostic");
  assert.match(masterPlan, /Next\.js là origin công khai/);
  assert.match(masterPlan, /proxy tới Bagisto nội bộ/);
  assert.doesNotMatch(environment + nextConfig, /(?:127\.0\.0\.1:|localhost:)8081/);
});

test("uses a health check available in the production Node runtime", async () => {
  const [productionCompose, healthRoute] = await Promise.all([
    readFile(new URL("docker-compose.production.yml", root), "utf8"),
    readFile(new URL("src/app/api/health/route.ts", root), "utf8"),
  ]);

  assert.match(productionCompose, /node -e/);
  assert.match(productionCompose, /\/api\/health/);
  assert.doesNotMatch(productionCompose, /\bwget\b/);
  assert.match(healthRoute, /export function GET/);
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

test("uses Turbopack by default and keeps Webpack as an explicit escape hatch", async () => {
  const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  assert.equal(packageJson.scripts.build, "next build");
  assert.equal(packageJson.scripts["build:webpack"], "next build --webpack");
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
