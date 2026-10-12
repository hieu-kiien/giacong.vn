import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const worker = await readFile(new URL("../custom-worker.ts", import.meta.url), "utf8");

test("public document cache keys change with the staging release version", () => {
  assert.match(worker, /const PUBLIC_DOCUMENT_CACHE_VERSION = "[^"]+"/);
  assert.match(worker, /url\.searchParams\.set\("__document_cache_version", PUBLIC_DOCUMENT_CACHE_VERSION\)/);
});
