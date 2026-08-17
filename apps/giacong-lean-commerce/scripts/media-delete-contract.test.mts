import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dataUrl = new URL("../src/lib/media-delete.ts", import.meta.url);
const routeUrl = new URL("../src/app/api/admin/media/[id]/route.ts", import.meta.url);

test("media delete checks every canonical image reference before deletion", async () => {
  const source = await readFile(dataUrl, "utf8");

  assert.match(source, /FROM products WHERE image_url = \?/);
  assert.match(source, /FROM product_variants WHERE image_url = \?/);
  assert.match(source, /FROM site_settings/);
  assert.match(source, /draft_value = \? OR published_value = \?/);
  assert.match(source, /MediaAssetInUseError/);
});

test("reference checks are repeated inside the D1 transaction marker", async () => {
  const source = await readFile(dataUrl, "utf8");
  const markerStart = source.indexOf("INSERT INTO audit_logs");
  const markerEnd = source.indexOf("RETURNING id", markerStart);
  assert.ok(markerStart >= 0 && markerEnd > markerStart, "delete audit marker must exist");
  const marker = source.slice(markerStart, markerEnd);

  assert.match(marker, /status <> 'deleted'/);
  assert.match(marker, /NOT EXISTS \(SELECT 1 FROM products WHERE image_url = \?\)/);
  assert.match(marker, /NOT EXISTS \(SELECT 1 FROM product_variants WHERE image_url = \?\)/);
  assert.match(marker, /NOT EXISTS \([\s\S]*FROM site_settings[\s\S]*draft_value = \? OR published_value = \?/);
});

test("D1 soft-delete and audit commit before the R2 object is deleted", async () => {
  const source = await readFile(dataUrl, "utf8");
  const batchIndex = source.indexOf("await batchDatabase.batch(statements)");
  const r2DeleteIndex = source.indexOf("await bucket.delete(initial.storage_key)");

  assert.ok(batchIndex >= 0, "D1 guarded batch must be present");
  assert.ok(r2DeleteIndex > batchIndex, "R2 delete must happen only after D1 commit");
  assert.match(source, /'media\.deleted', 'media'/);
  assert.match(source, /SET status = 'deleted'/);
  assert.match(source, /if \(initial\.status !== "deleted"\)/);
});

test("already soft-deleted media retries the idempotent R2 delete without another D1 mutation", async () => {
  const source = await readFile(dataUrl, "utf8");
  const guardedMutation = source.indexOf('if (initial.status !== "deleted")');
  const batch = source.indexOf("await batchDatabase.batch(statements)", guardedMutation);
  const blockEnd = source.indexOf("\n  }\n\n  // Delete from R2", guardedMutation);
  const r2Delete = source.indexOf("await bucket.delete(initial.storage_key)");

  assert.ok(guardedMutation >= 0 && batch > guardedMutation);
  assert.ok(blockEnd > batch, "D1 mutation should be scoped to non-deleted rows");
  assert.ok(r2Delete > blockEnd, "R2 retry must remain outside the mutation guard");
});

test("admin DELETE route uses only the reference-safe writer and returns actionable conflicts", async () => {
  const route = await readFile(routeUrl, "utf8");

  assert.match(route, /deleteMediaAssetSafely\(guard\.database, bucket, id, guard\.actorSubject\)/);
  assert.doesNotMatch(route, /deleteMediaAsset\(guard\.database/);
  assert.match(route, /MEDIA_IN_USE/);
  assert.match(route, /STALE_WRITE/);
  assert.match(route, /error\.references\.product/);
  assert.match(route, /error\.references\.variant/);
  assert.match(route, /error\.references\.siteSetting/);
});
