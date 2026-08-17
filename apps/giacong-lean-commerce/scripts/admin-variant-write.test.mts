import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  AdminVariantStaleWriteError,
  archiveAdminVariantAtomically,
  createAdminVariantAtomically,
  updateAdminVariantAtomically,
} from "../src/lib/admin-variant-write.ts";

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
    throw new Error("atomic variant write must not call statement.run()");
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
  attributeCode: "weight",
  attributeId: 1,
  attributeLabel: "Khối lượng",
  contactFromQuantity: 100,
  imageUrl: null,
  isAvailable: true,
  moq: 10,
  name: "Bao 5 kg",
  optionId: 5,
  optionLabel: "5 kg",
  quantityStep: 10,
  revision: 7,
  sku: "SKU-5KG",
  sortOrder: 0,
  tierPrices: [
    { currency: "VND" as const, minQuantity: 10, price: 50_000 },
    { currency: "VND" as const, minQuantity: 50, price: 45_000 },
  ],
  unit: "bao",
};

const repoRoot = path.join(import.meta.dirname, "..");

function assertNoIndividualWrites(database: FakeBatchDatabase) {
  assert.equal(database.prepared.reduce((total, statement) => total + statement.runCalls, 0), 0);
}

test("variant create, all tiers and audit are committed in one D1 batch", async () => {
  const database = new FakeBatchDatabase([{ id: 55 }]);

  const variantId = await createAdminVariantAtomically(database, 12, input, "actor@example.com");

  assert.equal(variantId, 55);
  assert.equal(database.batches.length, 1);
  const batch = database.batches[0] ?? [];
  assert.equal(batch.length, 4, "variant insert + two tiers + audit must share one transaction");
  assert.match(batch[0]?.query ?? "", /INSERT INTO product_variants/);
  assert.match(batch[0]?.query ?? "", /revision\) VALUES \([^]*, 1\) RETURNING id/i);
  assert.match(batch[1]?.query ?? "", /INSERT INTO variant_tier_prices/);
  assert.match(batch[2]?.query ?? "", /INSERT INTO variant_tier_prices/);
  assert.match(batch[3]?.query ?? "", /INSERT INTO audit_logs/);
  for (const statement of batch.slice(1)) {
    assert.match(statement.query, /product_id = \? AND sku = \?/);
    assert.ok(statement.values.includes(12));
    assert.ok(statement.values.includes(input.sku));
  }
  assertNoIndividualWrites(database);
});

test("variant update fields, tier replacement and audit marker share one guarded D1 batch", async () => {
  const database = new FakeBatchDatabase();

  await updateAdminVariantAtomically(database, 12, 34, input, "actor@example.com");

  assert.equal(database.batches.length, 1);
  const batch = database.batches[0] ?? [];
  assert.equal(batch.length, 5, "audit marker + variant update + tier delete + two tier inserts");

  assert.match(batch[0]?.query ?? "", /INSERT INTO audit_logs/);
  assert.match(batch[0]?.query ?? "", /revision = \?/);
  assert.match(batch[0]?.query ?? "", /RETURNING id/);

  assert.match(batch[1]?.query ?? "", /UPDATE product_variants/);
  assert.match(batch[1]?.query ?? "", /revision = revision \+ 1/);
  assert.match(batch[1]?.query ?? "", /revision = \?/);
  assert.match(batch[1]?.query ?? "", /EXISTS \(SELECT 1 FROM audit_logs WHERE id = \?\)/);

  for (const statement of batch.slice(2)) {
    assert.match(statement.query, /EXISTS \(SELECT 1 FROM audit_logs WHERE id = \?\)/);
  }
  assert.match(batch[2]?.query ?? "", /DELETE FROM variant_tier_prices/);
  assert.match(batch[3]?.query ?? "", /INSERT INTO variant_tier_prices/);
  assert.match(batch[4]?.query ?? "", /INSERT INTO variant_tier_prices/);

  const auditId = batch[0]?.values[0];
  assert.equal(typeof auditId, "string");
  assert.ok(batch.slice(1).every((statement) => statement.values.includes(auditId)));
  assertNoIndividualWrites(database);
});

test("a stale variant update fails after a no-op guarded transaction", async () => {
  const database = new FakeBatchDatabase([]);

  await assert.rejects(
    updateAdminVariantAtomically(database, 12, 34, input, "actor@example.com"),
    AdminVariantStaleWriteError,
  );
  assert.equal(database.batches.length, 1);
  assertNoIndividualWrites(database);
});

test("variant update requires an explicit positive revision before preparing a write", async () => {
  const database = new FakeBatchDatabase();

  await assert.rejects(
    updateAdminVariantAtomically(database, 12, 34, { ...input, revision: undefined }, "actor@example.com"),
    /Revision hiện tại là bắt buộc/,
  );
  assert.equal(database.prepared.length, 0);
  assert.equal(database.batches.length, 0);
});

test("variant archive uses exact-revision audit marker and mutation in one batch", async () => {
  const database = new FakeBatchDatabase();

  await archiveAdminVariantAtomically(database, 12, 34, 7, "actor@example.com");

  assert.equal(database.batches.length, 1);
  const batch = database.batches[0] ?? [];
  assert.equal(batch.length, 2);
  assert.match(batch[0]?.query ?? "", /INSERT INTO audit_logs/);
  assert.match(batch[0]?.query ?? "", /revision = \?/);
  assert.match(batch[0]?.query ?? "", /RETURNING id/);
  assert.ok(batch[0]?.values.includes("variant.archived"));
  assert.match(batch[1]?.query ?? "", /SET is_available = 0, revision = revision \+ 1/);
  assert.match(batch[1]?.query ?? "", /revision = \?/);
  assert.match(batch[1]?.query ?? "", /EXISTS \(SELECT 1 FROM audit_logs WHERE id = \?\)/);
  assert.equal(batch[1]?.values.at(-2), 7);
  assert.equal(batch[1]?.values.at(-1), batch[0]?.values[0]);
  assertNoIndividualWrites(database);
});

test("stale or missing archive revision cannot mutate a variant", async () => {
  const stale = new FakeBatchDatabase([]);
  await assert.rejects(
    archiveAdminVariantAtomically(stale, 12, 34, 7, "actor@example.com"),
    AdminVariantStaleWriteError,
  );
  assertNoIndividualWrites(stale);

  const missing = new FakeBatchDatabase();
  await assert.rejects(
    archiveAdminVariantAtomically(missing, 12, 34, undefined, "actor@example.com"),
    /Revision hiện tại là bắt buộc/,
  );
  assert.equal(missing.prepared.length, 0);
  assert.equal(missing.batches.length, 0);
});

test("variant routes use atomic create, update and archive writers", async () => {
  const [collectionRoute, itemRoute] = await Promise.all([
    readFile(path.join(repoRoot, "src/app/api/admin/products/[id]/variants/route.ts"), "utf8"),
    readFile(path.join(repoRoot, "src/app/api/admin/products/[id]/variants/[variantId]/route.ts"), "utf8"),
  ]);

  assert.match(collectionRoute, /createAdminVariantAtomically/);
  assert.doesNotMatch(collectionRoute, /createAdminProductVariant/);
  assert.match(itemRoute, /updateAdminVariantAtomically/);
  assert.match(itemRoute, /archiveAdminVariantAtomically/);
  assert.doesNotMatch(itemRoute, /updateAdminProductVariant|archiveAdminProductVariant/);
  assert.match(itemRoute, /hasExplicitRevision\(payload\)/);
  assert.match(itemRoute, /STALE_WRITE/);
});

test("admin variant UI sends the visible row revision when archiving", async () => {
  const panel = await readFile(
    path.join(repoRoot, "src/components/admin/AdminVariantPanel.tsx"),
    "utf8",
  );

  assert.match(panel, /body:\s*\{\s*revision:\s*variant\.revision\s*\}/);
  assert.match(panel, /method:\s*"DELETE"/);
});
