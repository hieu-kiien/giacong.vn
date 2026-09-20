import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const worker = await readFile(new URL("../custom-worker.ts", import.meta.url), "utf8");
const openNextConfig = await readFile(new URL("../open-next.config.ts", import.meta.url), "utf8");
const wrangler = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");

test("public document caching is bounded and isolated from private surfaces", () => {
  assert.match(worker, /isPublicDocumentRequest/);
  assert.match(worker, /kienhieu\.id\.vn/);
  assert.match(worker, /request\.method !== "GET"/);
  assert.match(worker, /Accept/);
  assert.match(worker, /Set-Cookie/);
  assert.match(worker, /Cookie/);
  assert.match(worker, /public, max-age=0, s-maxage=600, stale-while-revalidate=3600/);
  assert.match(worker, /caches as CacheStorage & \{ default: Cache \}/);
  assert.match(worker, /publicDocumentCache\.match/);
  assert.match(worker, /publicDocumentCache\.put/);
  assert.match(worker, /ctx\.waitUntil/);
  assert.match(worker, /withPublicDocumentCache\(request/);
});


test("OpenNext persists incremental cache in the existing R2 buckets", () => {
  assert.match(openNextConfig, /r2-incremental-cache/);
  assert.match(openNextConfig, /incrementalCache:\s*r2IncrementalCache/);
  assert.match(wrangler, /"binding":\s*"NEXT_INC_CACHE_R2_BUCKET"/);
  assert.match(wrangler, /"binding":\s*"WORKER_SELF_REFERENCE"[\s\S]*?"service":\s*"giacong-vn"/);
  assert.match(wrangler, /"binding":\s*"WORKER_SELF_REFERENCE"[\s\S]*?"service":\s*"giacong-vn-staging"/);
});
