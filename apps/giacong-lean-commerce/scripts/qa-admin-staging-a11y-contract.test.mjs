import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./qa-admin-staging.mjs", import.meta.url), "utf8");

test("admin staging QA covers reduced motion and keyboard focus without becoming a mutation runner", () => {
  assert.match(source, /reducedMotion/);
  assert.match(source, /name:\s*["']reduced-motion["']/);
  assert.match(source, /prefers-reduced-motion/);
  assert.match(source, /page\.keyboard\.press\(["']Tab["']\)/);
  assert.match(source, /document\.activeElement/);
  assert.match(source, /focus-visible|focusable/i);
  assert.doesNotMatch(source, /(?:page|locator)\.(?:click|fill|type)\(/);
  assert.doesNotMatch(source, /method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/i);
});
