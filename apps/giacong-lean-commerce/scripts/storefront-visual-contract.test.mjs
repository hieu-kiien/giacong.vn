import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const homePage = await read("../src/components/site/CapturedHomePage.tsx");
const newsPage = await read("../src/app/(storefront)/tin-tuc/page.tsx");
const globals = await read("../src/app/globals.css");

test("home hero uses four independent local image elements", () => {
  assert.match(homePage, /data-testid=["']home-hero-gallery["']/);
  assert.match(homePage, /data-gallery-image=/);
  assert.equal((homePage.match(/src: "\/images\/home-hero\/hero-[1-4]\.png"/g) ?? []).length, 4);
  assert.doesNotMatch(homePage, /gia-cong-thuc-pham\.png/);
});

test("news route has its own source-aligned page frame and active navigation", () => {
  assert.doesNotMatch(newsPage, /activeNavigation="products"/);
  assert.match(newsPage, /giacong-page-hero/);
  assert.match(newsPage, /giacong-news-list/);
  assert.match(newsPage, /data-testid="news-empty-state"/);
});

test("news route highlights its captured source menu item without changing shared navigation", () => {
  assert.match(globals, /\.archive #header #menu-item-1541 > a/);
});

test("captured content routes opt into restrained motion with reduced-motion fallback", () => {
  assert.match(globals, /@keyframes giacong-/);
  assert.match(globals, /\.section01 \.section-bg/);
  assert.match(globals, /\.section-duong-dan \.section-bg/);
  assert.match(globals, /prefers-reduced-motion:\s*reduce/);
});
