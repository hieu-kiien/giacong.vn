import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { normalizeCapturedMarkup } = await import("../src/lib/captured-markup" + ".ts");
const root = new URL("../", import.meta.url);

function duplicateIds(markup: string): string[] {
  const counts = new Map<string, number>();
  for (const match of markup.matchAll(/\sid=(["'])([^"']+)\1/gi)) {
    counts.set(match[2], (counts.get(match[2]) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
    .sort();
}

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

test("captured inline SVG roots keep the first id and drop repeated root ids", () => {
  const input = [
    '<svg id="Layer_1" viewBox="0 0 10 10"><path d="M0 0" /></svg>',
    '<div id="keep-me"></div>',
    '<svg class="second" id="Layer_1" viewBox="0 0 20 20"><path d="M1 1" /></svg>',
    '<svg id="unique-svg" viewBox="0 0 30 30"></svg>',
  ].join("");
  const normalized = normalizeCapturedMarkup(input);

  assert.equal((normalized.match(/id="Layer_1"/g) ?? []).length, 1);
  assert.match(normalized, /<svg class="second" viewBox="0 0 20 20">/);
  assert.match(normalized, /<div id="keep-me"><\/div>/);
  assert.match(normalized, /<svg id="unique-svg"/);
});

test("the captured homepage normalizes to unique DOM ids", async () => {
  const source = JSON.parse(
    await readFile(new URL("src/data/pages/home.json", root), "utf8"),
  ) as { markup: string };

  assert.deepEqual(duplicateIds(source.markup), ["Layer_1"]);
  assert.deepEqual(duplicateIds(normalizeCapturedMarkup(source.markup)), []);
});
