import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const worker = await readFile(new URL("../custom-worker.ts", import.meta.url), "utf8");
const openNextConfig = await readFile(new URL("../open-next.config.ts", import.meta.url), "utf8");
const wrangler = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");

test("cron primes only public documents in its own environment and the next visitor bypasses rendering", async () => {
  const stored = new Map();
  const calls = [];
  let privateResponse = false;
  globalThis.caches = { default: {
    async match(request) { return stored.get(request.url)?.clone(); },
    async put(request, response) { stored.set(request.url, response); },
  } };
  globalThis.__cronGeneratedWorker = { async fetch(request) {
    calls.push(request.url);
    const headers = { "Content-Type": "text/html" };
    if (privateResponse) headers["Set-Cookie"] = "session=private; HttpOnly";
    return new Response("<html>public content</html>", { headers });
  } };
  const withoutImports = worker.replace(/^import .*;\r?\n/gm, "");
  const code = ts.transpileModule(`const generatedWorker = globalThis.__cronGeneratedWorker;
const getStagingAdminEntryRedirect = () => null;
const getRetiredLegacyProductRedirect = () => null;
${withoutImports}`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  const { default: runtime } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  try {
    const pending = [];
    const ctx = { waitUntil(promise) { pending.push(promise); } };
    await runtime.scheduled({}, { ADMIN_HOSTNAME: "admin-staging.kienhieu.id.vn" }, ctx);
    await Promise.all(pending);
    assert.ok(calls.every(url => new URL(url).hostname === "staging.kienhieu.id.vn"));
    assert.equal(stored.size, 2);
    assert.ok([...stored.keys()].every(url => !new URL(url).pathname.startsWith("/tai-khoan")));
    const renders = calls.length;
    const response = await runtime.fetch(new Request("https://staging.kienhieu.id.vn/lien-he/", { headers: { Accept: "text/html" } }), {}, ctx);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("X-Storefront-Document-Cache"), "HIT");
    assert.equal(calls.length, renders, "cache hit must not invoke Next rendering");
    stored.clear();
    privateResponse = true;
    await runtime.scheduled({}, { ADMIN_HOSTNAME: "admin.kienhieu.id.vn" }, ctx);
    await Promise.all(pending);
    assert.ok(calls.slice(renders).every(url => new URL(url).hostname === "kienhieu.id.vn"));
    assert.equal(stored.size, 0, "responses setting a session cookie must never enter shared cache");
  } finally {
    delete globalThis.caches;
    delete globalThis.__cronGeneratedWorker;
  }
});

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

test("staging caches only anonymous document URLs without app-specific query state", () => {
  assert.match(worker, /staging\.kienhieu\.id\.vn/);
  assert.match(worker, /cf-access-jwt-assertion/);
  assert.match(worker, /MARKETING_QUERY_PARAMS/);
  assert.match(worker, /searchParams\.size/);
  assert.match(worker, /STAGING_DOCUMENT_CACHE_CONTROL = "public, max-age=0, s-maxage=600, stale-while-revalidate=3600"/);
  assert.match(worker, /STAGING_CDN_DOCUMENT_CACHE_CONTROL = "public, max-age=600"/);
  assert.match(worker, /publicDocumentCacheHostname\(requestUrl\.hostname\)/);
  assert.match(worker, /publicDocumentCacheKey\(request\)/);
  assert.match(worker, /X-Storefront-Document-Cache/);
  assert.match(worker, /headers\.set\("X-Storefront-Document-Cache", status\)/);
  assert.match(worker, /if \(status === "HIT"\) headers\.set\("Cache-Control", "no-store"\)/);
  assert.match(worker, /withStagingDocumentCacheStatus\(request, cachedDocument, "HIT"\)/);
  assert.match(worker, /withStagingDocumentCacheStatus\(request, finalResponse, "MISS"\)/);
});


test("OpenNext persists incremental cache in the existing R2 buckets", () => {
  assert.match(openNextConfig, /r2-incremental-cache/);
  assert.match(openNextConfig, /incrementalCache:\s*r2IncrementalCache/);
  assert.match(wrangler, /"binding":\s*"NEXT_INC_CACHE_R2_BUCKET"/);
  assert.match(wrangler, /"binding":\s*"WORKER_SELF_REFERENCE"[\s\S]*?"service":\s*"giacong-vn"/);
  assert.match(wrangler, /"binding":\s*"WORKER_SELF_REFERENCE"[\s\S]*?"service":\s*"giacong-vn-staging"/);
});
