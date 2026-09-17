import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const worker = await readFile(new URL("../custom-worker.ts", import.meta.url), "utf8");

test("fingerprinted Next assets use immutable browser caching", () => {
  assert.match(worker, /isStaticAssetRequest/);
  assert.match(worker, /_next\/static/);
  assert.match(worker, /public, max-age=31536000, immutable/);
  assert.match(worker, /withStaticAssetCache\(request/);
});

test("stable public media and style assets use bounded browser caching", () => {
  assert.match(worker, /\/images\//);
  assert.match(worker, /\/styles\//);
  assert.match(worker, /public, max-age=86400, stale-while-revalidate=604800/);
});
