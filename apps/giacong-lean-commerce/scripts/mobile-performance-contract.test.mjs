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
const capturedStylesheet = await read("public/styles/giacong-sections.css");

const packshots = [
  "public/images/products/demo-dried-fruit-pouches.webp",
  "public/images/products/demo-fruit-drinks.webp",
  "public/images/products/demo-powder-pouches.webp",
  "public/images/products/demo-sauce-bottles.webp",
];

const homepageOptimizedAssets = [
  ["public/images/home-hero/hero-1.avif", 80_000],
  ["public/images/home-hero/hero-2.avif", 80_000],
  ["public/images/home-hero/hero-3.avif", 80_000],
  ["public/images/home-hero/hero-4.avif", 80_000],
  ["public/images/home-captured/img-b.webp", 300_000],
  ["public/images/home-captured/banner-gia-cong.webp", 180_000],
  ["public/images/home-captured/img-sp-1.webp", 180_000],
  ["public/images/home-captured/IMG.webp", 140_000],
  ["public/images/home-captured/menu-logo.webp", 140_000],
  ["public/images/home-captured/header-logo.webp", 80_000],
  ["public/images/home-captured/book-open.svg", 20_000],
  ["public/images/home-captured/bg-tin-tuc.webp", 180_000],
  ["public/images/home-captured/Group-205.webp", 180_000],
  ["public/images/home-captured/quote.webp", 20_000],
  ["public/images/home-captured/check-circle.svg", 20_000],
  ["public/images/home-captured/form-bg.webp", 100_000],
  ["public/images/home-captured/thumbcn-1200x676-9.webp", 250_000],
  ["public/images/home-captured/call.webp", 20_000],
  ["public/images/home-captured/mail.webp", 20_000],
  ["public/images/home-captured/zalo.webp", 20_000],
  ["public/images/home-captured/messenger.webp", 20_000],
  ["public/images/home-captured/footer-logo-300.webp", 80_000],
  ["public/images/home-captured/footer-logo.webp", 140_000],
  ["public/images/home-captured/service-email.svg", 20_000],
  ["public/images/home-captured/service-money.svg", 20_000],
  ["public/images/home-captured/service-like.svg", 20_000],
  ["public/images/home-captured/service-mobile.svg", 20_000],
  ["public/images/home-captured/service-certificate.svg", 20_000],
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

test("homepage critical media uses local modern formats", async () => {
  assert.match(homeSource, /<picture>/);
  assert.match(homeSource, /type=\"image\/avif\"/);
  assert.match(homeSource, /type=\"image\/webp\"/);
  assert.match(homeSource, /home-captured\/img-b\.webp/);
  assert.match(homeSource, /home-captured\/banner-gia-cong\.webp/);
  assert.match(homeSource, /home-captured\/img-sp-1\.webp/);
  assert.match(homeSource, /home-captured\/IMG\.webp/);
  assert.match(homeSource, /home-captured\/menu-logo\.webp/);
  assert.match(homeSource, /home-captured\/header-logo\.webp/);
  assert.match(homeSource, /home-captured\/book-open\.svg/);
  assert.match(homeSource, /home-captured\/bg-tin-tuc\.webp/);
  assert.match(homeSource, /home-captured\/Group-205\.webp/);
  assert.match(homeSource, /home-captured\/check-circle\.svg/);
  assert.match(homeSource, /home-captured\/call\.webp/);
  assert.match(homeSource, /home-captured\/footer-logo\.webp/);
  assert.match(homeSource, /home-captured\/service-email\.svg/);

  await Promise.all(homepageOptimizedAssets.map(async ([path, limit]) => {
    const size = (await stat(new URL(path, appRoot))).size;
    assert.ok(size < limit, `expected ${path} to stay below ${limit} bytes; got ${size}`);
  }));
});

test("captured shared stylesheet keeps media on the local origin", () => {
  assert.doesNotMatch(capturedStylesheet, /https:\/\/giacong\.vn\/wp-content\//);
});
