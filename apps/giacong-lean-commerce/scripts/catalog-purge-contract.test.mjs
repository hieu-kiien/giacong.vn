import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("product and service writes purge the public storefront", async () => {
  const [productRoute, serviceRoute] = await Promise.all([
    read("src/app/api/admin/products/[id]/route.ts"),
    read("src/app/api/admin/services/[id]/route.ts"),
  ]);

  // Update and archive both go through the shared purge helper.
  assert.equal((productRoute.match(/purgeCatalogStorefront\(/g) ?? []).length, 2);
  assert.equal((serviceRoute.match(/purgeCatalogStorefront\(/g) ?? []).length, 2);
  // The previous slug is purged too, so a renamed item's old URL cannot serve stale HTML.
  assert.match(productRoute, /catalogProductPurgePaths\(\[existing\.slug, product\.slug\]\)/);
  assert.match(serviceRoute, /catalogServicePurgePaths\(\[previous\?\.slug, service\.slug\]\)/);
});

test("purge helpers always include the home page and the list page", async () => {
  const source = await read("src/lib/storefront-revalidate.ts");

  assert.match(source, /new Set<string>\(\["\/", "\/san-pham\/"\]\)/);
  assert.match(source, /new Set<string>\(\["\/", "\/thue-gia-cong\/"\]\)/);
  assert.match(source, /encodeURIComponent\(slug\)/);
  assert.match(source, /withStorefrontPurgeHeader\(response, paths\)/);
});

test("a cached product page is visibility-checked on staging as well as production", async () => {
  const worker = await read("custom-worker.ts");
  const block = worker.match(/const cachedDocument = await readPublicDocumentCache\(request\);([\s\S]*?)const response = await generatedWorker\.fetch/)?.[1];

  assert.ok(block, "cached-document branch not found");
  const check = block.indexOf("withCatalogProductNotFoundStatus");
  const stagingHit = block.indexOf('withStagingDocumentCacheStatus(request, cachedDocument, "HIT")');
  assert.ok(check >= 0 && stagingHit >= 0);
  // The visibility check must run before any cached document is returned as a HIT.
  assert.ok(check < stagingHit, "staging returned a cache HIT before the visibility check");
});
