import assert from "node:assert/strict";
import test from "node:test";

const { normalizeCapturedMarkup } = await import("../src/lib/captured-markup" + ".ts");

test("captured WordPress content keeps one main landmark", () => {
  const input = '<main id="main"><div id="content" role="main" class="content-area"><p>Body</p></div></main>';
  const normalized = normalizeCapturedMarkup(input);

  assert.match(normalized, /<main id="main">/);
  assert.match(normalized, /<div id="content" class="content-area">/);
  assert.doesNotMatch(normalized, /<div\b[^>]*\bid="content"[^>]*\brole="main"/i);
});

test("standalone role=main is preserved when no semantic main exists", () => {
  const input = '<div id="content" role="main"><p>Body</p></div>';
  assert.equal(normalizeCapturedMarkup(input), input);
});

test("unrelated main roles are not rewritten", () => {
  const input = '<main id="main"><div id="other" role="main">Other</div></main>';
  assert.equal(normalizeCapturedMarkup(input), input);
});
