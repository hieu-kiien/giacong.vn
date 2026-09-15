import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normalizeCapturedMarkup } from "../src/lib/captured-markup.ts";
import {
  resolveDesktopDropdownEscapeTarget,
  type EscapeActiveElement,
  type EscapeFocusable,
  type EscapeScope,
} from "../src/lib/desktop-dropdown-escape.ts";

const root = new URL("../", import.meta.url);
const readDataPage = (name: string): Promise<{ markup: string }> =>
  readFile(new URL(`src/data/pages/${name}`, root), "utf8").then(
    (text) => JSON.parse(text) as { markup: string },
  );

const serviceMenuRegion = (html: string): string => {
  const start = html.indexOf("clone-service-menu");
  assert.ok(start >= 0, "expected the replaced service mega menu in output");
  return html.slice(start, start + 40000);
};

const productMenuItemRegion = (html: string): string => {
  const start = html.indexOf('id="menu-item-1742"');
  assert.ok(start >= 0, "expected the normalized product link in output");
  const end = html.indexOf('id="menu-item-5166"', start);
  assert.ok(end > start, "expected the service menu after the product link");
  return html.slice(start, end);
};

const mobileMenuRegion = (html: string): string => {
  const start = html.indexOf('id="menu-item-5467"');
  assert.ok(start >= 0, "expected the direct mobile product link in output");
  return html.slice(start, start + 12000);
};

const PLACEHOLDER_LABELS = [
  "Mít sấy",
  "Hồng sấy",
  "Khoai lang sấy",
  "Nước ép chanh leo",
  "Nước ép dưa hấu",
  "Nước ép dứa",
  "Bột phô mai tách muối",
  "Sữa chua vị việt quất",
  "Sữa chua vị chuối",
  "Sữa chua vị dâu tây",
  "Sữa chua vị đào",
  "Sữa chua vị nguyên bản",
  "Sữa chua vị truyền thống",
  "Bột gừng",
  "Bột hành",
  "Bột Hành Baro",
  "Bột hành tây",
  "Bột nghệ",
  "Bột ớt",
  "Bột sả",
];

test("service mega menu never links placeholder labels anywhere", async () => {
  const { markup } = await readDataPage("tin-tuc.json");
  const normalized = normalizeCapturedMarkup(markup);
  for (const label of PLACEHOLDER_LABELS) {
    assert.doesNotMatch(
      normalized,
      new RegExp(`<a[^>]*>[\\s\\S]{0,120}${label}[\\s\\S]{0,20}<\\/a>`),
    );
  }
  assert.doesNotMatch(normalized, /\/Hoa quả sấy/);
});

test("service mega menu exposes grouped service entry points", async () => {
  const { markup } = await readDataPage("tin-tuc.json");
  const region = serviceMenuRegion(normalizeCapturedMarkup(markup));
  assert.match(region, /<h4><span>Thực phẩm và nguyên liệu<\/span><\/h4>/);
  assert.match(region, /<h4><span>Sữa và đồ uống<\/span><\/h4>/);
  assert.match(region, /<h4><span>Sấy và đóng gói<\/span><\/h4>/);
  assert.match(region, /<h4><span>Trà và cà phê<\/span><\/h4>/);
  assert.match(region, /<a[^>]*href="\/dich-vu-say\/"[^>]*>[\s\S]{0,60}Dịch vụ sấy/);
  assert.match(region, /<a[^>]*href="\/gia-cong-do-uong\/"[^>]*>[\s\S]{0,60}Gia công đồ uống/);
  assert.match(region, /href="\/gia-cong-sua\/"/);
  assert.match(region, /Gia công sữa/);
  assert.match(region, /href="\/gia-cong-dong-goi\/"/);
  assert.match(region, /Xem tất cả dịch vụ/);
  assert.match(region, /href="\/gia-cong-sua-bot\/"/);
  assert.match(region, /href="\/say-thang-hoa\/"/);
  assert.doesNotMatch(region, /href="\/dich-vu-dong-goi-bot-hoa-tan\/"/);
});

test("captured submit controls expose an explicit accessible name", () => {
  const normalized = normalizeCapturedMarkup(
    '<form><input class="wpcf7-submit" type="submit" value="Gửi yêu cầu"></form>',
  );
  assert.match(normalized, /type="submit"[^>]*aria-label="Gửi yêu cầu"/);

  const explicit = normalizeCapturedMarkup(
    '<form><input type="submit" value="Gửi" aria-label="Gửi biểu mẫu"></form>',
  );
  assert.match(explicit, /aria-label="Gửi biểu mẫu"/);
  assert.doesNotMatch(explicit, /aria-label="Gửi"/);
});

test("service menu keeps its grouped headings and hub links", async () => {
  const { markup } = await readDataPage("tin-tuc.json");
  const region = serviceMenuRegion(normalizeCapturedMarkup(markup));
  assert.match(region, /<a href="\/gia-cong-sot-cham\/">Gia công sốt chấm<\/a>/);
  assert.match(region, /<a href="\/gia-cong-duoc-lieu\/">Gia công dược liệu<\/a>/);
  assert.match(region, /<a href="\/gia-cong-ca-phe\/">Gia công cà phê<\/a>/);
  assert.match(region, /<a href="\/gia-cong-dong-goi\/">Gia công đóng gói<\/a>/);
  assert.match(region, /<a href="\/bot-gia-vi\/">Gia công bột gia vị<\/a>/);
});

test("product menu is a direct route without a desktop dropdown", async () => {
  const { markup } = await readDataPage("tin-tuc.json");
  const region = productMenuItemRegion(normalizeCapturedMarkup(markup));

  assert.match(region, /href="\/san-pham\/"/);
  assert.match(region, /Mua hàng/);
  assert.doesNotMatch(region, /nav-dropdown|clone-product-menu|icon-angle-down/);
});

test("service mega menu owns the processing URLs moved out of products", async () => {
  const { markup } = await readDataPage("tin-tuc.json");
  const normalized = normalizeCapturedMarkup(markup);
  const productOnly = productMenuItemRegion(normalized);
  const services = serviceMenuRegion(normalized);

  for (const href of [
    "/gia-cong-sot-cham/",
    "/gia-cong-do-uong/",
    "/gia-cong-sua/",
    "/dich-vu-say/",
    "/gia-cong-dong-goi/",
    "/bot-gia-vi/",
  ]) {
    assert.equal(productOnly.includes('href="' + href + '"'), false, href + " must not be in products");
    assert.equal(services.includes('href="' + href + '"'), true, href + " must be in services");
  }
  for (const href of [
    "/gia-cong-sua-bot/",
    "/say-thang-hoa/",
    "/dich-vu-dong-goi-bot-hoa-tan/",
  ]) {
    assert.equal(productOnly.includes('href="' + href + '"'), false, href + " must not be in products");
    assert.equal(services.includes('href="' + href + '"'), href !== "/dich-vu-dong-goi-bot-hoa-tan/", href + " preserves its menu or group-page destination");
  }
});

test("mobile navigation keeps Mua hàng direct and groups service accordions", async () => {
  const { markup } = await readDataPage("tin-tuc.json");
  const region = mobileMenuRegion(normalizeCapturedMarkup(markup));
  const source = await readFile(new URL("../src/components/mobile-navigation.ts", import.meta.url), "utf8");

  assert.match(region, /id="menu-item-5467"[\s\S]*href="\/san-pham\/"[\s\S]*Mua hàng/);
  assert.doesNotMatch(region, /clone-mobile-products|clone-mobile-product-children/);
  assert.match(region, /Thực phẩm và nguyên liệu/);
  assert.match(region, /Sữa và đồ uống/);
  assert.match(region, /Sấy và đóng gói/);
  assert.match(region, /Xem tất cả dịch vụ/);
  assert.match(region, /Gia công sữa bột/);
  assert.doesNotMatch(source, /createMobileProductItem|clone-mobile-product/);
});

test("milk service capture uses a local image fallback for every card", async () => {
  const { markup } = await readDataPage("gia-cong-sua-bot.json");
  const normalized = normalizeCapturedMarkup(markup);
  const legacySources = [
    "gia-cong-sua-bot-510x366.jpg",
    "gia-cong-sua-bot-cho-tre-em-247x296.jpg",
    "gia-cong-sua-bot-nguyen-kem-247x296.webp",
    "gia-cong-sua-bot-pha-san-247x296.jpg",
    "sua-bot-cho-nguoi-gia-247x296.webp",
    "sua-bot-tach-beo-247x296.jpg",
  ];

  for (const source of legacySources) {
    assert.equal(normalized.includes(source), false, source + " must use the local asset");
  }
  assert.equal((normalized.match(/\/images\/services\/service-milk\.svg/g) ?? []).length, legacySources.length);
});

const stubScope = (
  topLink: { focus(): void; blur(): void } | null,
  dropdown: object | null,
): { querySelector(selectors: string): { focus(): void; blur(): void } | null } => ({
  querySelector: (selectors: string) => {
    if (selectors === ":scope > a") return topLink;
    return dropdown as { focus(): void; blur(): void } | null;
  },
});

const stubActive = (
  scope: { querySelector(selectors: string): { focus(): void; blur(): void } | null } | null,
  seen: string[],
): EscapeActiveElement => ({
  closest: (selectors: string) => {
    seen.push(selectors);
    return scope;
  },
});

test("escape inside an open desktop dropdown moves focus to its top link", () => {
  let focused = false;
  const topLink = { focus: () => { focused = true; }, blur: () => {} };
  const seen: string[] = [];
  const outcome = resolveDesktopDropdownEscapeTarget(
    stubActive(stubScope(topLink, {}), seen),
    () => true,
  );
  assert.deepEqual(seen, ["ul.header-nav-main > li"]);
  assert.equal(outcome.action, "focus");
  if (outcome.action === "focus") outcome.element.focus();
  assert.equal(focused, true);
});

test("escape on the top link itself releases focus instead of jumping", () => {
  let blurred = false;
  const scope: EscapeScope = {
    querySelector: (selectors: string): EscapeFocusable | null =>
      selectors === ":scope > a" || selectors === ":scope .nav-dropdown" ? both : null,
  };
  const both: EscapeActiveElement & EscapeFocusable = {
    closest: () => scope,
    focus: () => {},
    blur: () => { blurred = true; },
  };
  const outcome = resolveDesktopDropdownEscapeTarget(both, () => true);
  assert.equal(outcome.action, "blur");
  if (outcome.action === "blur") outcome.element.blur();
  assert.equal(blurred, true);
});

test("escape outside an open dropdown does nothing", () => {
  const seen: string[] = [];
  const topLink = { focus: () => {}, blur: () => {} };
  const closed = resolveDesktopDropdownEscapeTarget(
    stubActive(stubScope(topLink, {}), seen),
    () => false,
  );
  assert.equal(closed.action, "none");
  const missing = resolveDesktopDropdownEscapeTarget(
    { closest: () => null },
    () => true,
  );
  assert.equal(missing.action, "none");
  assert.equal(resolveDesktopDropdownEscapeTarget(null, () => true).action, "none");
});

test("desktop Escape dismissal wins over hover until pointer or focus re-enters", async () => {
  const interactions = await readFile(
    new URL("../src/components/GiacongInteractions.tsx", import.meta.url),
    "utf8",
  );
  const globals = await readFile(
    new URL("../src/app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(interactions, /data-dropdown-dismissed/);
  assert.match(interactions, /addEventListener\("pointerover"/);
  assert.match(interactions, /addEventListener\("focusin"/);
  assert.match(
    globals,
    /#header li\.has-dropdown\[data-dropdown-dismissed="true"\] > \.nav-dropdown/,
  );
});

test("desktop pointer hover and keyboard focus open without delay", async () => {
  const globals = await readFile(
    new URL("../src/app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(
    globals,
    /#header li\.has-dropdown:hover > \.nav-dropdown\s*\{[\s\S]*?transition-delay:\s*0ms\s*!important/,
  );
  assert.match(
    globals,
    /#header li\.has-dropdown:focus-within > \.nav-dropdown\s*\{[\s\S]*?transition-delay:\s*0ms\s*!important/,
  );
});
