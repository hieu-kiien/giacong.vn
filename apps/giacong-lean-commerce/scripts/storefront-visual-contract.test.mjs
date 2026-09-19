import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const homePage = await read("../src/components/site/CapturedHomePage.tsx");
const storefrontShell = await read("../src/components/site/CapturedStorefrontShell.tsx");
const newsPage = await read("../src/app/(storefront)/tin-tuc/page.tsx");
const capturedRoute = await read("../src/app/(storefront)/[...slug]/page.tsx");
const newsData = await read("../src/lib/news-public.ts");
const globals = await read("../src/app/globals.css");
const interactions = await read("../src/components/GiacongInteractions.tsx");
const capturedMotion = await read("../src/components/captured-motion.ts");
const mobileNavigation = await read("../src/components/mobile-navigation.ts");
const contactForm = await read("../src/components/contact-form.ts");
const capturedMarkup = await read("../src/lib/captured-markup.ts");

test("home hero uses four independent local image elements", () => {
  assert.match(homePage, /data-testid=["']home-hero-gallery["']/);
  assert.match(homePage, /data-gallery-image=/);
  assert.equal((homePage.match(/src: "\/images\/home-hero\/hero-[1-4]\.png"/g) ?? []).length, 4);
  assert.doesNotMatch(homePage, /gia-cong-thuc-pham\.png/);
});

test("homepage applies the published navigation to the captured fallback", () => {
  assert.match(homePage, /applyHomepageSiteSettingsToMarkup/);
  assert.match(homePage, /applyNavigationToMarkup/);
  assert.match(homePage, /getPublishedSiteNavigation/);
  assert.match(homePage, /await getPublishedSiteNavigation\(\)/);
  assert.match(homePage, /applyNavigationToMarkup\(\s*normalizedMarkup,\s*navigation,\s*["']menu-item-4618["']/);
  assert.match(homePage, /applyFooterNavigationToMarkup/);
  assert.match(storefrontShell, /applyFooterNavigationToMarkup/);
});

test("storefront auxiliary mobile markup receives the published brand and navigation", () => {
  assert.match(storefrontShell, /const capturedAuxiliaryMarkupSource =/);
  assert.match(storefrontShell, /const auxiliaryMarkup = applySiteSettingsToMarkup\(/);
  assert.match(storefrontShell, /applyNavigationToMarkup\(\s*capturedAuxiliaryMarkupSource/);
  assert.match(storefrontShell, /__html: auxiliaryMarkup/);
});

test("news route has its own source-aligned page frame and active navigation", () => {
  assert.doesNotMatch(newsPage, /activeNavigation="products"/);
  assert.match(newsPage, /giacong-page-hero/);
  assert.match(newsPage, /giacong-news-list/);
  assert.match(newsPage, /data-testid="news-empty-state"/);
});

test("news route highlights its captured source menu item without changing shared navigation", () => {
  assert.match(globals, /\.archive\.category-tin-tuc #header #menu-item-1541 > a/);
  assert.doesNotMatch(globals, /\.archive #header #menu-item-1541/);
});

test("header-only mega menu groups reuse the linked heading style", () => {
  assert.match(globals, /\.menu-san-pham h4 > span[\s\S]*color:\s*#333/);
  assert.match(globals, /\.menu-san-pham h4 > span[\s\S]*font-size:\s*16px/);
});

test("captured mobile navigation has local fallbacks for primary pages", () => {
  assert.match(capturedRoute, /gioi-thieu-ve-gia-cong\.json/);
  assert.match(capturedRoute, /lien-he\.json/);
  assert.match(capturedRoute, /localCapturedPages/);
});

test("public news pages fail closed to usable empty states when D1 is unavailable", () => {
  assert.match(newsData, /Published news listing unavailable[\s\S]*return \[\]/);
  assert.match(newsData, /Published news post unavailable[\s\S]*return null/);
});

test("captured content routes opt into restrained motion with reduced-motion fallback", () => {
  assert.match(globals, /\.clone-slider-ready/);
  assert.match(globals, /\.clone-menu-backdrop[\s\S]*transition: opacity/);
  assert.doesNotMatch(globals, /giacong-page-orbit|giacong-background-drift|giacong-content-rise/);
  assert.match(globals, /prefers-reduced-motion:\s*reduce/);
});

test("captured motion is connected once and respects reduced motion", () => {
  assert.match(interactions, /connectCapturedMotion/);
  assert.match(capturedMotion, /IntersectionObserver/);
  assert.match(capturedMotion, /prefers-reduced-motion: reduce/);
  assert.match(capturedMotion, /clone-slider-ready/);
  assert.match(globals, /\.page-reveal-ready/);
  assert.match(globals, /\.clone-slider-ready/);
});

test("captured mobile navigation exposes state to assistive technology", () => {
  assert.match(mobileNavigation, /aria-label.*Đóng menu con.*Mở menu con/);
  assert.match(mobileNavigation, /aria-hidden.*String\(!expanded\)/);
});

test("invalid contact submissions stay on the client", () => {
  assert.match(contactForm, /form\.checkValidity\(\)/);
  assert.match(contactForm, /Không thể gửi yêu cầu|Vui lòng kiểm tra thông tin/);
});

test("captured markup repairs document semantics at the normalization boundary", () => {
  assert.match(capturedMarkup, /normalizeCapturedMainLandmark/);
  assert.match(capturedMarkup, /normalizeCapturedFrames/);
  assert.match(capturedMarkup, /normalizeCapturedFooterHeadings/);
});
