import assert from "node:assert/strict";
import test from "node:test";

import {
  getRetiredLegacyProductRedirect,
  legacyProductRedirects,
  retiredLegacyProductSlugs,
} from "../src/lib/catalog-legacy-redirects.ts";

const staleDemoSlugs = [
  "b2b-demo-bot-dinh-duong",
  "b2b-demo-bot-dinh-duong-vi-vani",
  "b2b-demo-bot-dinh-duong-vi-it-ngot",
  "b2b-demo-thuc-uong-dinh-duong",
  "b2b-demo-thuc-uong-dinh-duong-lua-mach",
  "b2b-demo-sua-hat-pha-san",
  "b2b-demo-ngu-coc-dinh-duong",
  "b2b-demo-ngu-coc-dinh-duong-hat",
  "b2b-demo-bot-yen-mach-hoa-tan",
];

test("retired demo product URLs cannot redirect to missing catalog parents", () => {
  for (const slug of staleDemoSlugs) {
    assert.equal(retiredLegacyProductSlugs.has(slug), true, slug);
    assert.equal(legacyProductRedirects[slug], undefined, slug);
  }
});

test("retired demo product URLs redirect at the edge without carrying stale variant queries", () => {
  const staleUrl = new URL(
    "https://staging.kienhieu.id.vn/san-pham/b2b-demo-bot-dinh-duong-vi-vani/?variant=OLD-SKU",
  );

  assert.equal(
    getRetiredLegacyProductRedirect(staleUrl),
    "https://staging.kienhieu.id.vn/san-pham/",
  );
  assert.equal(
    getRetiredLegacyProductRedirect(new URL("https://staging.kienhieu.id.vn/san-pham/bot-gao-lut-xay-min")),
    null,
  );
});
