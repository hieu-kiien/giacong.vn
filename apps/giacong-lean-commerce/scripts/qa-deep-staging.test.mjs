import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./qa-deep-staging.mjs", import.meta.url), "utf8");

test("deep staging QA waits for streamed detail content before asserting controls", () => {
  assert.match(source, /async function waitForRenderedSelector\(page, selector, timeout = 15_000\)/);
  assert.match(source, /await waitForPageSettled\(mpage, "h1"\);/);
  assert.match(source, /await waitForRenderedSelector\(mpage, '\[class\*="commercial"\]'\);/);
  assert.match(source, /await waitForRenderedSelector\(mpage, 'button\[class\*="secondaryAction"\]'\);/);
  assert.match(source, /const panel = mpage\.locator\('\[class\*="commercial"\]'\)\.first\(\);/);
  assert.match(source, /await waitForRenderedSelector\(mpage, "text=Bột gạo lứt"\);/);
  assert.match(source, /await waitForPageSettled\(kpage, 'input\[type=search\]'\);/);
});
