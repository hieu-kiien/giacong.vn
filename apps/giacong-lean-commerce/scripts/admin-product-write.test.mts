import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  AdminProductStaleWriteError,
  archiveAdminProductAtomically,
  createAdminProductAtomically,
  updateAdminProductAtomically,
} from "../src/lib/admin-product-write.ts";

class FakeStatement {
  readonly query: string;
  values: unknown[] = [];
  runCalls = 0;

  constructor(query: string) {
    this.query = query.replace(/\s+/g, " ").trim();
  }

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async all<T>() {
    return { results: [] as T[] };
  }

  async first<T>() {
    return null as T | null;
  }

  async run() {
    this.runCalls += 1;
    throw new Error("atomic product write must not call statement.run()");
  }
}

class FakeBatchDatabase {
  readonly prepared: FakeStatement[] = [];
  readonly batches: FakeStatement[][] = [];
  firstRows: unknown[];

  constructor(firstRows: unknown[] = [{ id: "audit-marker" }]) {
    this.firstRows = firstRows;
  }

  prepare(query: string) {
    const statement = new FakeStatement(query);
    this.prepared.push(statement);
    return statement;
  }

  async batch(statements: FakeStatement[]) {
    this.batches.push([...statements]);
    return statements.map((_, index) => ({
      results: index === 0 ? this.firstRows : [],
    }));
  }
}

const input = {
  categoryId: 3,
  description: "Mô tả đầy đủ",
  imageUrl: "/media/products/demo.webp",
  isActive: false,
  leadTimeDays: 14,
  name: "Sản phẩm Demo",
  shortDescription: "Mô tả ngắn",
  sku: "PRODUCT-DEMO",
  slug: "san-pham-demo",
  status: "draft" as const,
};

const repoRoot = path.join(import.meta.dirname, "..");

function assertNoIndividualWrites(database: FakeBatchDatabase) {
  assert.equal(database.prepared.reduce((total, statement) => total + statement.runCalls, 0), 0);
}

test("product create, admin meta and audit are committed in one D1 batch", async () => {
  const database = new FakeBatchDatabase([{ id: 71 }]);

  const productId = await createAdminProductAtomically(database, input, "actor@example.com");

  assert.equal(productId, 71);
  assert.equal(database.batches.length, 1);
  const batch = database.batches[0] ?? [];
  assert.equal(batch.length, 3);
  assert.match(batch[0]?.query ?? "", /INSERT INTO products/);
  assert.match(batch[0]?.query ?? "", /revision\s*\)\s*VALUES\s*\([^]*,\s*1\)\s*RETURNING id/i);
  assert.match(batch[1]?.query ?? "", /INSERT INTO product_admin_meta/);
  assert.match(batch[2]?.query ?? "", /INSERT INTO audit_logs/);
  for (const statement of batch.slice(1)) {
    assert.match(statement.query, /slug = \? AND sku = \?/);
    assert.ok(statement.values.includes(input.slug));
    assert.ok(statement.values.includes(input.sku));
  }
  assertNoIndividualWrites(database);
});

test("product update, meta and audit marker share one exact-revision D1 batch", async () => {
  const database = new FakeBatchDatabase();

  await updateAdminProductAtomically(database, 71, input, 4, "actor@example.com");

  assert.equal(database.batches.length, 1);
  const batch = database.batches[0] ?? [];
  assert.equal(batch.length, 3);
  assert.match(batch[0]?.query ?? "", /INSERT INTO audit_logs/);
  assert.match(batch[0]?.query ?? "", /FROM products WHERE id = \? AND revision = \?/);
  assert.match(batch[0]?.query ?? "", /RETURNING id/);
  assert.ok(batch[0]?.values.includes("product.updated"));
  assert.ok(batch[0]?.values.includes(4));

  assert.match(batch[1]?.query ?? "", /UPDATE products/);
  assert.match(batch[1]?.query ?? "", /revision = revision \+ 1/);
  assert.match(batch[1]?.query ?? "", /WHERE id = \? AND revision = \?/);
  assert.match(batch[2]?.query ?? "", /INSERT INTO product_admin_meta/);

  const auditId = batch[0]?.values[0];
  assert.equal(typeof auditId, "string");
  assert.ok(batch.slice(1).every((statement) => statement.values.includes(auditId)));
  assertNoIndividualWrites(database);
});

test("stale product update fails after a guarded no-op transaction", async () => {
  const database = new FakeBatchDatabase([]);

  await assert.rejects(
    updateAdminProductAtomically(database, 71, input, 4, "actor@example.com"),
    AdminProductStaleWriteError,
  );
  assert.equal(database.batches.length, 1);
  assertNoIndividualWrites(database);
});

test("product archive uses exact revision and archives meta in the same batch", async () => {
  const database = new FakeBatchDatabase();

  await archiveAdminProductAtomically(database, 71, 8, "actor@example.com");

  const batch = database.batches[0] ?? [];
  assert.equal(batch.length, 3);
  assert.ok(batch[0]?.values.includes("product.archived"));
  assert.ok(batch[0]?.values.includes(8));
  assert.match(batch[1]?.query ?? "", /SET is_active = 0, revision = revision \+ 1/);
  assert.match(batch[1]?.query ?? "", /WHERE id = \? AND revision = \?/);
  assert.match(batch[2]?.query ?? "", /status = 'archived'/);
  const auditId = batch[0]?.values[0];
  assert.ok(batch.slice(1).every((statement) => statement.values.includes(auditId)));
  assertNoIndividualWrites(database);
});

test("missing product revision fails before preparing any update or archive write", async () => {
  const updateDatabase = new FakeBatchDatabase();
  await assert.rejects(
    updateAdminProductAtomically(updateDatabase, 71, input, undefined, "actor@example.com"),
    /Revision hiện tại là bắt buộc/,
  );
  assert.equal(updateDatabase.prepared.length, 0);
  assert.equal(updateDatabase.batches.length, 0);

  const archiveDatabase = new FakeBatchDatabase();
  await assert.rejects(
    archiveAdminProductAtomically(archiveDatabase, 71, undefined, "actor@example.com"),
    /Revision hiện tại là bắt buộc/,
  );
  assert.equal(archiveDatabase.prepared.length, 0);
  assert.equal(archiveDatabase.batches.length, 0);
});

test("product routes expose revision tokens and use only the atomic write path", async () => {
  const [collectionRoute, itemRoute] = await Promise.all([
    readFile(path.join(repoRoot, "src/app/api/admin/products/route.ts"), "utf8"),
    readFile(path.join(repoRoot, "src/app/api/admin/products/[id]/route.ts"), "utf8"),
  ]);

  assert.match(collectionRoute, /attachAdminProductRevisions/);
  assert.match(collectionRoute, /createAdminProductAtomically/);
  assert.doesNotMatch(collectionRoute, /createAdminProduct\(/);

  assert.match(itemRoute, /attachAdminProductRevision/);
  assert.match(itemRoute, /hasExplicitRevision\(payload\)/);
  assert.match(itemRoute, /updateAdminProductAtomically/);
  assert.match(itemRoute, /archiveAdminProductAtomically/);
  assert.doesNotMatch(itemRoute, /updateAdminProduct\(|archiveAdminProduct\(/);
  assert.match(itemRoute, /STALE_WRITE/);
});

test("admin client caches product revisions and injects them only for direct product mutations", async () => {
  const client = await readFile(path.join(repoRoot, "src/lib/admin-client.ts"), "utf8");

  assert.match(client, /revision:\s*number/);
  assert.match(client, /productRevisionCache/);
  assert.match(client, /withCachedProductRevision/);
  assert.match(client, /\^\\\/api\\\/admin\\\/products\\\/(\\d\+\)\$/);
  assert.match(client, /body === undefined \? \{ revision \} : body/);
  assert.match(client, /body\.code === "STALE_WRITE"/);
});
