import assert from "node:assert/strict";
import test from "node:test";

const { layerCapturedStyles } = await import("../src/lib/captured-markup.ts");

test("captured fl-icons does not block text while the icon font loads", () => {
  const result = layerCapturedStyles(`@font-face {
    font-family: "fl-icons";
    font-display: block;
    src: url(/styles/icons/fl-icons.woff2) format("woff2");
  }`);

  assert.match(result, /font-family:\s*["']fl-icons["'][\s\S]*font-display:\s*swap/i);
  assert.doesNotMatch(result, /font-family:\s*["']fl-icons["'][\s\S]*font-display:\s*block/i);
});
