import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const headers = await readFile(new URL("../public/_headers", import.meta.url), "utf8");

test("fingerprinted Next assets use immutable browser caching", () => {
  assert.match(headers, /\/_next\/static\/\*/);
  assert.match(headers, /Cache-Control:\s*public, max-age=31536000, immutable/);
});

test("stable public media and style assets use bounded browser caching", () => {
  assert.match(headers, /\/images\/\*/);
  assert.match(headers, /\/styles\/\*/);
  assert.match(headers, /Cache-Control:\s*public, max-age=86400, stale-while-revalidate=604800/);
});
