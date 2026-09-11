import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeSource = await readFile(
  new URL("../src/app/(storefront)/[...slug]/page.tsx", import.meta.url),
  "utf8",
);
const packageManifest = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

test("captured routes read page data through the Cloudflare static assets binding", () => {
  assert.doesNotMatch(routeSource, /node:fs|process\.cwd\(\)/);
  assert.match(routeSource, /getCloudflareContext/);
  assert.match(routeSource, /ASSETS/);
  assert.match(routeSource, /\.fetch\(/);
});

test("legacy captured routes receive the published navigation used by managed storefront pages", async () => {
  const capturedPageSource = await readFile(
    new URL("../src/components/CapturedPage.tsx", import.meta.url),
    "utf8",
  );

  assert.match(routeSource, /getPublishedSiteNavigation/);
  assert.match(routeSource, /<CapturedPage[\s\S]*navigation=\{navigation\}/);
  assert.match(capturedPageSource, /applyNavigationToMarkup/);
  assert.match(capturedPageSource, /applyFooterNavigationToMarkup/);
});

test("capture JSON is prepared as a generated public asset before runtime", async () => {
  const prepareScript = await readFile(
    new URL("../scripts/prepare-captured-assets.mjs", import.meta.url),
    "utf8",
  );

  assert.match(prepareScript, /src[\\/]data[\\/]pages/);
  assert.match(prepareScript, /public[\\/]captured-pages/);
  assert.match(packageManifest.scripts?.["prepare:captured-assets"] ?? "", /prepare-captured-assets/);
  assert.match(packageManifest.scripts?.predev ?? "", /prepare:captured-assets/);
  assert.match(packageManifest.scripts?.prebuild ?? "", /prepare:captured-assets/);
  assert.match(packageManifest.scripts?.["precf:build"] ?? "", /prepare:captured-assets/);
  assert.match(packageManifest.scripts?.["precf:build:staging"] ?? "", /prepare:captured-assets/);
});
