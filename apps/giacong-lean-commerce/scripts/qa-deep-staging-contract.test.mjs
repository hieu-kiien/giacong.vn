import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("deep staging QA waits for semantic render readiness", async () => {
  const source = await readFile(new URL("./qa-deep-staging.mjs", import.meta.url), "utf8");

  assert.match(source, /async function waitForPageSettled\(page/);
  assert.match(source, /waitForRenderedSelector\(page, selector/);
  assert.match(source, /document\.fonts\?\.ready/);
  assert.match(source, /await waitForPageSettled\(page\)/);
  assert.doesNotMatch(source, /await page\.waitForTimeout\(500\)/);
});
