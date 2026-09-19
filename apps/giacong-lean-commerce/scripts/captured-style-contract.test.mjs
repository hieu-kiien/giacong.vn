import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { layerCapturedStyles, needsCapturedShopStyles } = await import("../src/lib/captured-markup.ts");
const capturedLayersSource = await readFile(
  new URL("../src/app/(storefront)/captured-layers.css", import.meta.url),
  "utf8",
);
const capturedPageSource = await readFile(
  new URL("../src/components/CapturedPage.tsx", import.meta.url),
  "utf8",
);

test("captured fl-icons does not block text while the icon font loads", () => {
  const result = layerCapturedStyles(`@font-face {
    font-family: "fl-icons";
    font-display: block;
    src: url(/styles/icons/fl-icons.woff2) format("woff2");
  }`);

  assert.match(result, /font-family:\s*["']fl-icons["'][\s\S]*font-display:\s*swap/i);
  assert.doesNotMatch(result, /font-family:\s*["']fl-icons["'][\s\S]*font-display:\s*block/i);
});

test("captured CSS maps retired WordPress backgrounds to local assets", () => {
  const result = layerCapturedStyles(`.archive-page-header {
    background-image: url("https://giacong.vn/wp-content/uploads/2024/10/form-bg.jpg");
  }
  .service-icon {
    background-image: url(https://giacong.vn/wp-content/uploads/2024/08/book-open-svgrepo-com.svg);
  }`);

  assert.match(result, /\/images\/home-captured\/form-bg\.webp/);
  assert.match(result, /\/images\/home-captured\/book-open\.svg/);
  assert.doesNotMatch(result, /https:\/\/giacong\.vn\/wp-content\/uploads\/(?:2024\/10\/form-bg\.jpg|2024\/08\/book-open-svgrepo-com\.svg)/);
});

test("captured CSS maps contact-page assets to local fallbacks", () => {
  const result = layerCapturedStyles(`.contact {
    background-image: url(https://giacong.vn/wp-content/uploads/2024/09/form-bg.jpg);
  }
  .partner {
    background-image: url(https://giacong.vn/wp-content/uploads/2024/08/doi-tac--510x137.png);
  }`);

  assert.match(result, /\/images\/home-captured\/form-bg\.webp/);
  assert.match(result, /\/images\/captured-asset-placeholder\.svg/);
  assert.doesNotMatch(result, /https:\/\/giacong\.vn\/wp-content\/uploads\/(?:2024\/09\/form-bg\.jpg|2024\/08\/doi-tac--510x137\.png)/);
});

test("captured CSS falls back any unmapped upload to a local placeholder", () => {
  const result = layerCapturedStyles(`.unknown {
    background-image: url(https://giacong.vn/wp-content/uploads/2025/09/future-capture.png);
  }`);

  assert.match(result, /\/images\/captured-asset-placeholder\.svg/);
  assert.doesNotMatch(result, /https:\/\/giacong\.vn\/wp-content\/uploads\//);
});

test("fixed TOC CSS is loaded only by captured pages that contain a TOC", () => {
  assert.doesNotMatch(capturedLayersSource, /fixed-toc\.css/);
  assert.match(capturedPageSource, /ftwp-/);
  assert.match(capturedPageSource, /fixed-toc\.css/);
});

test("legacy widget styles are not part of the storefront critical stylesheet", () => {
  assert.doesNotMatch(capturedLayersSource, /woocommerce-blocks\.css/);
  assert.doesNotMatch(capturedLayersSource, /quick-buy\.css/);
  assert.doesNotMatch(capturedLayersSource, /star-ratings\.css/);
  assert.doesNotMatch(capturedLayersSource, /flatsome-shop\.css/);
  assert.match(capturedPageSource, /captured-shop\.css/);
});

test("shop styles load only when captured markup contains product surfaces", () => {
  assert.equal(needsCapturedShopStyles('<main><div class="product-small"></div></main>'), true);
  assert.equal(needsCapturedShopStyles('<main><div class="product-main"></div></main>'), true);
  assert.equal(needsCapturedShopStyles('<main><article class="blog-single"></article></main>'), false);
  assert.equal(needsCapturedShopStyles('<main><section class="section01"></section></main>'), false);
});
