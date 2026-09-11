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

const productMenuRegion = (html: string): string => {
  const start = html.indexOf("clone-product-menu");
  assert.ok(start >= 0, "expected the replaced product mega menu in output");
  return html.slice(start, start + 40000);
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
  "Gia công sữa tươi",
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

test("service items without a real destination render as text, real hubs stay linked", async () => {
  const { markup } = await readDataPage("tin-tuc.json");
  const region = serviceMenuRegion(normalizeCapturedMarkup(markup));
  assert.match(region, /<span class="ux-menu-link__text">Sữa chua vị chuối<\/span>/);
  assert.doesNotMatch(region, /<a[^>]*>[\s\S]{0,80}Sữa chua vị chuối[\s\S]{0,20}<\/a>/);
  assert.match(region, /<a[^>]*href="\/dich-vu-say\/"[^>]*>[\s\S]{0,60}Dịch vụ sấy/);
  assert.match(region, /<a[^>]*href="\/gia-cong-do-uong\/"[^>]*>[\s\S]{0,60}Gia công đồ uống/);
});

test("menu groups without a real page render as headers, not links", async () => {
  const { markup } = await readDataPage("tin-tuc.json");
  const region = serviceMenuRegion(normalizeCapturedMarkup(markup));
  for (const label of ["Dịch vụ pháp lý", "Dịch vụ marketing", "Dịch vụ thiết kế", "Dịch vụ đóng gói"]) {
    assert.match(region, new RegExp(`<h4><span>${label}<\\/span><\\/h4>`));
  }
  assert.doesNotMatch(region, /href="\/dich-vu-phap-ly\/"/);
  assert.doesNotMatch(region, /href="\/dich-vu-marketing\/"/);
  assert.doesNotMatch(region, /href="\/dich-vu-thiet-ke\/"/);
  assert.doesNotMatch(region, /href="\/dich-vu-dong-goi\/"/);
});

test("product mega menu lists each category exactly once", async () => {
  const { markup } = await readDataPage("tin-tuc.json");
  const region = productMenuRegion(normalizeCapturedMarkup(markup));
  const productOnly = region.slice(0, region.indexOf("clone-service-menu"));
  assert.equal(productOnly.split(">Gia công đồ uống</a>").length - 1, 1);
});

test("mobile product clone preserves published nested children", async () => {
  const source = await readFile(new URL("../src/components/mobile-navigation.ts", import.meta.url), "utf8");
  assert.match(source, /nested-navigation-children/);
  assert.match(source, /desktopProductItem[\s\S]*nested-navigation-children/);
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

test("desktop pointer hover has intent delay while keyboard focus opens immediately", async () => {
  const globals = await readFile(
    new URL("../src/app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(
    globals,
    /#header li\.has-dropdown:hover > \.nav-dropdown\s*\{[^}]*transition-delay:\s*140ms\s*!important/s,
  );
  assert.match(
    globals,
    /#header li\.has-dropdown:focus-within > \.nav-dropdown\s*\{[^}]*transition-delay:\s*0ms\s*!important/s,
  );
});
