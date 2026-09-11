import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  normalizeCapturedMarkup,
  resolveCapturedActiveMenuId,
} from "../src/lib/captured-markup.ts";

const root = new URL("../", import.meta.url);
const readDataPage = (name: string): Promise<{ markup: string }> =>
  readFile(new URL(`src/data/pages/${name}`, root), "utf8").then(
    (text) => JSON.parse(text) as { markup: string },
  );

const ACTIVE_LI_TOKENS = [
  "current-menu-item",
  "current_page_item",
  "current-menu-parent",
  "active",
];

const liOpeningTag = (html: string, id: string): string => {
  const match = new RegExp(`<li\\b[^>]*\\bid="${id}"[^>]*>`).exec(html);
  assert.ok(match, `expected li#${id} in output`);
  return match[0];
};

const classTokens = (tag: string): string[] => {
  const match = /class=(["'])(.*?)\1/.exec(tag);
  return match ? match[2].split(/\s+/).filter(Boolean) : [];
};

const firstAnchorAfterLi = (html: string, id: string): string => {
  const li = liOpeningTag(html, id);
  const liIndex = html.indexOf(li);
  const anchorStart = html.indexOf("<a", liIndex + li.length);
  assert.ok(anchorStart >= 0, `expected an anchor inside li#${id}`);
  const anchorEnd = html.indexOf(">", anchorStart);
  return html.slice(anchorStart, anchorEnd + 1);
};

const activeLiTags = (html: string): string[] => {
  const tags: string[] = [];
  for (const match of html.matchAll(/<li\b[^>]*>/gi)) {
    const tokens = classTokens(match[0]);
    if (!tokens.includes("menu-item")) continue;
    if (tokens.some((token) => ACTIVE_LI_TOKENS.includes(token))) tags.push(match[0]);
  }
  return tags;
};

test("resolveCapturedActiveMenuId maps captured sections to their nav item", () => {
  assert.equal(resolveCapturedActiveMenuId("/gia-cong-sot-cham/"), "menu-item-5166");
  assert.equal(resolveCapturedActiveMenuId("/gia-cong-sot-cham/page/2/"), "menu-item-5166");
  assert.equal(resolveCapturedActiveMenuId("/dich-vu-say/"), "menu-item-5166");
  assert.equal(resolveCapturedActiveMenuId("/say-thang-hoa/"), "menu-item-5166");
  assert.equal(resolveCapturedActiveMenuId("/thuc-pham-chuc-nang/"), "menu-item-5166");
  assert.equal(resolveCapturedActiveMenuId("/bot-gia-vi/"), "menu-item-5166");
  assert.equal(resolveCapturedActiveMenuId("/gioi-thieu-ve-gia-cong/"), "menu-item-5498");
  assert.equal(resolveCapturedActiveMenuId("/lien-he/"), "menu-item-1542");
  assert.equal(resolveCapturedActiveMenuId("/tin-tuc/"), "menu-item-1541");
  assert.equal(resolveCapturedActiveMenuId("/san-pham/"), "menu-item-1742");
  assert.equal(resolveCapturedActiveMenuId("/chinh-sach-bao-mat/"), null);
  assert.equal(resolveCapturedActiveMenuId("/"), null);
});

test("service hub gains the services tab and keeps news inactive", async () => {
  const { markup } = await readDataPage("gia-cong-sot-cham.json");
  const normalized = normalizeCapturedMarkup(
    markup,
    resolveCapturedActiveMenuId("/gia-cong-sot-cham/"),
  );
  const serviceTokens = classTokens(liOpeningTag(normalized, "menu-item-5166"));
  assert.ok(serviceTokens.includes("current-menu-item"), "menu-item-5166 keeps current-menu-item");
  assert.ok(serviceTokens.includes("active"), "menu-item-5166 keeps active");
  assert.match(firstAnchorAfterLi(normalized, "menu-item-5166"), /aria-current=(["'])page\1/);
  const aliasTokens = classTokens(liOpeningTag(normalized, "menu-item-5466"));
  assert.ok(aliasTokens.includes("current-menu-item"), "mobile alias menu-item-5466 is marked");
  const newsTokens = classTokens(liOpeningTag(normalized, "menu-item-1541"));
  assert.ok(
    newsTokens.every((token) => !ACTIVE_LI_TOKENS.includes(token)),
    "menu-item-1541 stays inactive on a service hub",
  );
});

test("contact page marks the contact tab, not services", async () => {
  const { markup } = await readDataPage("lien-he.json");
  assert.equal(resolveCapturedActiveMenuId("/lien-he/"), "menu-item-1542");
  const normalized = normalizeCapturedMarkup(markup, "menu-item-1542");
  const contactTokens = classTokens(liOpeningTag(normalized, "menu-item-1542"));
  assert.ok(contactTokens.includes("current-menu-item"));
  assert.match(firstAnchorAfterLi(normalized, "menu-item-1542"), /aria-current=(["'])page\1/);
  const serviceTokens = classTokens(liOpeningTag(normalized, "menu-item-5166"));
  assert.ok(serviceTokens.every((token) => !ACTIVE_LI_TOKENS.includes(token)));
});

test("unknown route clears upstream markers but keeps pagination state", async () => {
  const { markup } = await readDataPage("tin-tuc.json");
  assert.equal(resolveCapturedActiveMenuId("/chinh-sach-bao-mat/"), null);
  const normalized = normalizeCapturedMarkup(markup, null);
  assert.deepEqual(activeLiTags(normalized), [], "no captured menu item stays marked");
  assert.doesNotMatch(normalized, /<a\b[^>]*aria-current=(["'])page\1/);
});

test("pagination aria-current survives strip and set", async () => {
  const { markup } = await readDataPage("gia-cong-sot-cham.json");
  assert.match(markup, /<span aria-current="page" class="page-number current">1<\/span>/);
  for (const active of ["menu-item-5166" as const, null]) {
    const normalized = normalizeCapturedMarkup(markup, active);
    assert.match(
      normalized,
      /<span aria-current="page" class="page-number current">1<\/span>/,
      `pagination marker survives active=${active}`,
    );
  }
});

test("omitted active id preserves legacy output for other callers", async () => {
  const { markup } = await readDataPage("tin-tuc.json");
  const normalized = normalizeCapturedMarkup(markup);
  const newsTokens = classTokens(liOpeningTag(normalized, "menu-item-1541"));
  assert.ok(newsTokens.includes("current-menu-item"), "upstream news marker untouched");
});
