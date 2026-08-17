import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  AdminVariantStaleWriteError,
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
    throw new Error("atomic variant update must not call statement.run()");
  }
}

class FakeBatchDatabase {
  readonly prepared: FakeStatement[] = [];
  readonly batches: FakeStatement[][] = [];
  markerInserted = true;

  prepare(query: string) {
    const statement = new FakeStatement(query);
    this.prepared.push(statement);
    return statement;
  }

  async batch(statements: FakeStatement[]) {
    this.batches.push([...statements]);
    return statements.map((_, index) => ({
      results: index === 0 && this.markerInserted ? [{ id: "audit-marker" }] : [],
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

test("variant fields, tier replacement and audit marker share one guarded D1 batch", async () => {
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
  assert.equal(database.prepared.reduce((total, statement) => total + statement.runCalls, 0), 0);
});

test("a stale variant update fails after a no-op guarded transaction", async () => {
  const database = new FakeBatchDatabase();
  database.markerInserted = false;

  await assert.rejects(
    updateAdminVariantAtomically(database, 12, 34, input, "actor@example.com"),
    AdminVariantStaleWriteError,
  );
  assert.equal(database.batches.length, 1);
  assert.equal(database.prepared.reduce((total, statement) => total + statement.runCalls, 0), 0);
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

test("PATCH route requires client revision and no longer calls the legacy split writer", async () => {
  const route = await readFile(
    path.join(repoRoot, "src/app/api/admin/products/[id]/variants/[variantId]/route.ts"),
    "utf8",
  );

  assert.match(route, /hasExplicitRevision\(payload\)/);
  assert.match(route, /updateAdminVariantAtomically/);
  assert.doesNotMatch(route, /updateAdminProductVariant/);
  assert.match(route, /STALE_WRITE/);
});
