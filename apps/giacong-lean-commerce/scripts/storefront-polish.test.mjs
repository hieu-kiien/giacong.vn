import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const appRoot = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, appRoot), "utf8");
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const [catalogList, capturedMarkup, globalStyles] = await Promise.all([
  read("src/components/catalog/CatalogList.tsx"),
  read("src/lib/captured-markup.ts"),
  read("src/app/globals.css"),
]);

test("catalog listing uses the captured desktop rail instead of a narrow 4xl column", () => {
  assert.match(catalogList, /max-w-\[1263px\]/);
  assert.doesNotMatch(catalogList, /max-w-4xl/);
});

test("catalog distinguishes an unpublished empty catalogue from filters with no matches", () => {
  assert.match(catalogList, /const isEmptyCatalog = pagination\.total === 0 && !filters\.query && !filters\.category/);
  assert.match(catalogList, /Danh mục sản phẩm đang được cập nhật/);
  assert.match(catalogList, /Chưa tìm thấy sản phẩm phù hợp/);
  assert.match(catalogList, /Gửi yêu cầu báo giá/);
});

test("captured archive chrome does not force a Tin tức underline on every route", () => {
  assert.doesNotMatch(globalStyles, /archive\.category-tin-tuc #header #menu-item-1541 > a/);
});

test("captured header icons resolve to local vector assets", async () => {
  const icons = [
    "nav-home.svg",
    "nav-about.svg",
    "nav-products.svg",
    "nav-services.svg",
    "icon-news.svg",
    "nav-contact.svg",
    "sidebar-home.svg",
    "sidebar-about.png",
    "sidebar-services.svg",
    "sidebar-news.png",
    "sidebar-contact.png",
  ];

  for (const icon of icons) {
    await stat(new URL(`public/images/${icon.startsWith("nav-") || icon.startsWith("sidebar-") ? "captured-legacy" : "home-captured"}/${icon}`, appRoot));
    assert.match(capturedMarkup, new RegExp(`/images/(?:captured-legacy|home-captured)/${icon}`));
  }

  assert.doesNotMatch(
    capturedMarkup,
    /(?:file-star-svgrepo-com|bulb-2-svgrepo-com|dich-vu)\.svg": "\/images\/captured-asset-placeholder\.svg/,
  );
});

test("captured about-page visuals keep real local assets after the Kienhieu rebrand", async () => {
  const aliases = [
    ["doi-tac-.png", "/images/captured-legacy/partner-strip.png"],
    ["doi-tac--510x137.png", "/images/captured-legacy/partner-strip.png"],
    ["doi-tac--300x81.png", "/images/captured-legacy/partner-strip.png"],
    ["doi-tac--1024x275.png", "/images/captured-legacy/partner-strip.png"],
    ["doi-tac--768x207.png", "/images/captured-legacy/partner-strip.png"],
    ["doi-tac--1536x413.png", "/images/captured-legacy/partner-strip.png"],
    ["fb.png", "/images/captured-social/facebook.png"],
    ["tele.png", "/images/captured-social/telegram.png"],
    ["insta.png", "/images/captured-social/instagram.png"],
    ["zalo.png", "/images/captured-social/zalo.png"],
    ["gift-card-150x150.png", "/images/captured-legacy/sidebar-news.png"],
    ["comment-info-150x150.png", "/images/captured-legacy/sidebar-about.png"],
    ["envelope-dot-150x150.png", "/images/captured-legacy/sidebar-contact.png"],
    ["trang-chu-netfood.svg", "/images/captured-legacy/sidebar-home.svg"],
  ];

  for (const [source, replacement] of aliases) {
    assert.match(capturedMarkup, new RegExp(`${escapeRegExp(source)}[\\s\\S]{0,250}${escapeRegExp(replacement)}`));
    await stat(new URL(`public${replacement}`, appRoot));
  }

  assert.doesNotMatch(
    capturedMarkup,
    /(?:doi-tac(?:--(?:510x137|300x81|1024x275|768x207|1536x413))?|fb|tele|insta|zalo)\.png": "\/images\/captured-asset-placeholder\.svg/,
  );
});

test("quick-contact rail keeps its branded local icons", () => {
  assert.match(globalStyles, /phonering-alo-alo[\s\S]*?home-captured\/call\.webp/);
  assert.match(globalStyles, /phonering-alo-sms[\s\S]*?home-captured\/mail\.webp/);
  assert.match(globalStyles, /phonering-alo-zalo[\s\S]*?home-captured\/zalo\.webp/);
  assert.match(globalStyles, /phonering-alo-messenger[\s\S]*?home-captured\/messenger\.webp/);
});

test("service cards use semantic icon fallbacks when no curated image exists", async () => {
  const visuals = await read("src/components/services/service-visuals.ts");
  assert.match(visuals, /SERVICE_IMAGE_BY_SLUG\[slug\] \?\? null/);
  assert.match(visuals, /export function getServiceFamilyImage\(slug: string\): string \| null/);
});
