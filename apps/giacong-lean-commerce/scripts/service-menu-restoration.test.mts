import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeCapturedMarkup } from "../src/lib/captured-markup.ts";

test("old service detail links remain reachable in desktop and mobile navigation", () => {
  const page = JSON.parse(readFileSync(new URL("../src/data/pages/tin-tuc.json", import.meta.url), "utf8"));
  const html = normalizeCapturedMarkup(page.markup);
  for (const href of ["/gia-cong-sua-bot/", "/gia-cong-sua-tuoi/", "/say-thang-hoa/", "/say-nong/", "/say-lanh/", "/say-chan-khong/", "/say-hong-ngoai/", "/gia-cong-sua-hat/", "/gia-cong-sua-thuc-vat/", "/gia-cong-nuoc-ep-trai-cay/", "/gia-cong-nuoc-giai-khat-co-ga/", "/gia-cong-tra-dong-chai/", "/gia-cong-nuoc-uong-dong-chai/", "/gia-cong-ca-phe-qua-tang/", "/gia-cong-ca-phe-hoa-tan/", "/gia-cong-tra-tui-loc/", "/rang-gia-cong-ca-phe/"]) {
    assert.ok(html.split(`href="${href}"`).length >= 3, `${href} must appear in both menus`);
  }
});
