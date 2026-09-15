import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const appRoot = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, appRoot), "utf8");

const galleryData = await read("src/data/demo-product-gallery.ts");
const imageData = await read("src/data/demo-product-images.ts");
const formatVndSource = await read("src/lib/format-vnd.ts");
const globalStyles = await read("src/app/globals.css");
const capturedMarkupSource = await read("src/lib/captured-markup.ts");
const homeSource = await read("src/components/site/CapturedHomePage.tsx");

const packshots = [
  "public/images/products/demo-dried-fruit-pouches.webp",
  "public/images/products/demo-fruit-drinks.webp",
  "public/images/products/demo-powder-pouches.webp",
  "public/images/products/demo-sauce-bottles.webp",
];

test("mobile catalog fallback imagery uses compressed WebP packshots", async () => {
  assert.doesNotMatch(galleryData, /images\/products\/demo-[^"']+\.png/);
  assert.doesNotMatch(imageData, /images\/products\/demo-[^"']+\.png/);
  assert.match(galleryData, /images\/products\/demo-[^"']+\.webp/);
  assert.match(imageData, /images\/products\/demo-[^"']+\.webp/);

  const sizes = await Promise.all(packshots.map(async (path) => (await stat(new URL(path, appRoot))).size));
  sizes.forEach((size) => assert.ok(size < 250_000, `expected ${size} bytes to stay below 250 KB`));
});

test("currency formatting reuses one Intl formatter during catalog renders", () => {
  assert.match(formatVndSource, /const VND_FORMATTER = new Intl\.NumberFormat\(/);
  assert.doesNotMatch(formatVndSource, /function formatVnd\(value: number\)[\s\S]*new Intl\.NumberFormat\(/);
});

test("page reveal layers are released after a block settles", () => {
  assert.match(
    globalStyles,
    /\.page-reveal-ready\.page-reveal-motion \[data-page-reveal\]:not\(\[data-page-revealed="true"\]\)/,
  );
});

test("captured content images defer below-fold loading without deferring chrome", () => {
  assert.match(capturedMarkupSource, /function addCapturedImageLoadingHints\(/);
  assert.match(capturedMarkupSource, /loading="lazy"/);
  assert.match(capturedMarkupSource, /fetchpriority/);
  assert.match(capturedMarkupSource, /header_logo\|header-logo\|header-logo-dark/);
});

test("homepage hero prioritizes one image and defers the remaining gallery tiles", () => {
  assert.match(homeSource, /fetchpriority=\"\$\{index === 0 \? \"high\" : \"low\"\}\"/);
  assert.match(homeSource, /loading=\"\$\{index === 0 \? \"eager\" : \"lazy\"\}\"/);
});
