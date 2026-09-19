import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const appRoot = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, appRoot), "utf8");

const [catalogList, capturedMarkup, globalStyles] = await Promise.all([
  read("src/components/catalog/CatalogList.tsx"),
  read("src/lib/captured-markup.ts"),
  read("src/app/globals.css"),
]);

test("catalog listing uses the captured desktop rail instead of a narrow 4xl column", () => {
  assert.match(catalogList, /max-w-\[1263px\]/);
  assert.doesNotMatch(catalogList, /max-w-4xl/);
});

test("captured archive chrome does not force a Tin tức underline on every route", () => {
  assert.doesNotMatch(globalStyles, /archive\.category-tin-tuc #header #menu-item-1541 > a/);
});

test("captured header icons resolve to local vector assets", async () => {
  const icons = [
    "icon-home.svg",
    "icon-about.svg",
    "book-open.svg",
    "icon-services.svg",
    "icon-news.svg",
    "icon-contact.svg",
  ];

  for (const icon of icons) {
    await stat(new URL(`public/images/home-captured/${icon}`, appRoot));
    assert.match(capturedMarkup, new RegExp(`/images/home-captured/${icon}`));
  }

  assert.doesNotMatch(
    capturedMarkup,
    /file-star-svgrepo-com\.svg": "\/images\/captured-asset-placeholder\.svg|bulb-2-svgrepo-com\.svg": "\/images\/captured-asset-placeholder\.svg/,
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
