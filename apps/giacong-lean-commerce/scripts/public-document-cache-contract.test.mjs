import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const worker = await readFile(new URL("../custom-worker.ts", import.meta.url), "utf8");

test("public document caching is bounded and isolated from private surfaces", () => {
  assert.match(worker, /isPublicDocumentRequest/);
  assert.match(worker, /kienhieu\.id\.vn/);
  assert.match(worker, /request\.method !== "GET"/);
  assert.match(worker, /Accept/);
  assert.match(worker, /Set-Cookie/);
  assert.match(worker, /public, max-age=0, s-maxage=60, stale-while-revalidate=300/);
  assert.match(worker, /withPublicDocumentCache\(request/);
});
