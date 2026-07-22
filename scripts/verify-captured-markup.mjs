import assert from "node:assert/strict";

import { normalizeCapturedMarkup } from "../src/lib/captured-markup.ts";

const fixture = `
  <nav aria-label="Breadcrumb"><a class="breadcrumb-home" href="/">Trang Chủ</a></nav>
  <main><a class="content-home" href="/gioi-thieu/">Trang Chủ</a></main>
  <ul class="desktop-menu">
    <li class="menu-item" id="menu-item-4618"><a href="/"><img alt="" src="/home.svg"/>Trang Chủ</a></li>
  </ul>
  <ul class="mobile-menu">
    <li class="menu-item" id="menu-item-5465"><a href="/"><img alt="" src="/home.svg"/>Trang Chủ</a></li>
  </ul>
`;

const normalized = normalizeCapturedMarkup(fixture);

assert.match(
  normalized,
  /<a class="breadcrumb-home" href="\/">Trang Chủ<\/a>/,
  "Breadcrumb labels outside the captured menus must remain unchanged",
);
assert.match(
  normalized,
  /<a class="content-home" href="\/gioi-thieu\/">Trang Chủ<\/a>/,
  "Content anchors outside the captured menus must remain unchanged",
);
assert.match(
  normalized,
  /id="menu-item-4618"><a href="\/">(?:<img[^>]*>)?Home<\/a>/,
  "Desktop Home menu label and href must be normalized by its stable item ID",
);
assert.match(
  normalized,
  /id="menu-item-5465"><a href="\/">(?:<img[^>]*>)?Home<\/a>/,
  "Mobile Home menu label and href must be normalized by its stable item ID",
);

console.log("Verified scoped captured Home menu normalization.");
