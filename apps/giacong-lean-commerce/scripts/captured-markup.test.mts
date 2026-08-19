import assert from "node:assert/strict";
import test from "node:test";

import { normalizeCapturedMarkup } from "../src/lib/captured-markup.ts";

test("captured markup keeps one main landmark when WordPress nests role=main inside main", () => {
  const input = '<main id="main"><div class="page" id="content" role="main"><h1>Trang chủ</h1></div></main>';
  const output = normalizeCapturedMarkup(input);

  assert.match(output, /<main id="main">/);
  assert.match(output, /<div class="page" id="content">/);
  assert.doesNotMatch(output, /id="content"[^>]*role="main"/);
});

test("captured markup preserves a sole role=main when there is no semantic main element", () => {
  const input = '<div id="content" role="main"><h1>Nội dung</h1></div>';
  assert.equal(normalizeCapturedMarkup(input), input);
});

test("captured main normalization is attribute-order independent", () => {
  const input = "<main class='page-main' id='main'><div role='main' data-page='1' id='content'>Nội dung</div></main>";
  const output = normalizeCapturedMarkup(input);

  assert.match(output, /<main class='page-main' id='main'>/);
  assert.match(output, /<div data-page='1' id='content'>/);
  assert.doesNotMatch(output, /role='main'/);
});
