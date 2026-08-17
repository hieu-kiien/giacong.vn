import assert from "node:assert/strict";
import test from "node:test";

import { LeadIdempotencyConflictError } from "../src/lib/lead-idempotency.ts";
import { createLeadPersistence } from "../src/lib/lead-persistence-core.ts";

class FakeStatement {
  readonly query: string;
  values: unknown[] = [];
  firstResult: unknown = null;
  runCalls = 0;

  constructor(query: string) {
    this.query = query;
  }

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async all<T>() {
    return { results: [] as T[] };
  }

  async first<T>() {
    return this.firstResult as T | null;
  }

  async run() {
    this.runCalls += 1;
    throw new Error("atomic create path must not call statement.run()");
  }
}

class FakeBatchDatabase {
  readonly prepared: FakeStatement[] = [];
  readonly batches: FakeStatement[][] = [];
  readonly firstResults: unknown[];
  batchError: Error | null;

  constructor(options: { batchError?: Error | null; firstResults?: unknown[] } = {}) {
    this.firstResults = [...(options.firstResults ?? [])];
    this.batchError = options.batchError ?? null;
  }

  prepare(query: string) {
    const statement = new FakeStatement(query);
    if (/SELECT id, public_reference, delivery_status, webhook_reference, payload_json/i.test(query)) {
      statement.firstResult = this.firstResults.shift() ?? null;
    }
    this.prepared.push(statement);
    return statement;
  }

  async batch(statements: FakeStatement[]) {
    this.batches.push([...statements]);
    if (this.batchError) throw this.batchError;
    return statements.map(() => ({ success: true }));
  }
}

const REQUEST_ID = "11111111-1111-4111-8111-111111111111";

function leadPayload() {
  return {
    request_id: REQUEST_ID,
    name: "Nguyễn Demo",
    phone: "0912345678",
    source: "lead-persistence-test",
    cart: [
      {
        product: "Sản phẩm A",
        product_slug: "san-pham-a",
        variant: "Bao 5 kg",
        variant_sku: "SKU-A-05",
        qty: 10,
        unit: "bao",
        unit_price: 50_000,
        line_total: 500_000,
        currency: "VND",
      },
      {
        product: "Sản phẩm B",
        product_slug: "san-pham-b",
        variant: "Thùng 12 chai",
        variant_sku: "SKU-B-12",
        qty: 20,
        unit: "thùng",
        unit_price: 80_000,
        line_total: 1_600_000,
        currency: "VND",
      },
    ],
  };
}

function existingLead(payloadJson: string) {
  return {
    delivery_status: "queued",
    id: "existing-lead",
    payload_json: payloadJson,
    public_reference: "LEAD-EXISTING",
    webhook_reference: null,
  };
}

function reorderedPayloadJson() {
  const payload = leadPayload();
  return JSON.stringify({
    cart: payload.cart.map((item) => ({
      currency: item.currency,
      line_total: item.line_total,
      unit_price: item.unit_price,
      unit: item.unit,
      qty: item.qty,
      variant_sku: item.variant_sku,
      variant: item.variant,
      product_slug: item.product_slug,
      product: item.product,
    })),
    source: payload.source,
    phone: payload.phone,
    name: payload.name,
    request_id: payload.request_id,
  });
}

test("lead, every item and received event are committed in one D1 batch", async () => {
  const database = new FakeBatchDatabase();
  const result = await createLeadPersistence(database).create(leadPayload());

  assert.equal(result.deliveryStatus, "pending");
  assert.equal(result.isDuplicate, false);
  assert.equal(database.batches.length, 1, "one logical lead intake must use exactly one D1 batch");

  const batch = database.batches[0] ?? [];
  assert.equal(batch.length, 4, "lead + two items + received event must share one transaction");
  assert.match(batch[0]?.query ?? "", /INSERT INTO leads/i);
  assert.match(batch[1]?.query ?? "", /INSERT INTO lead_items/i);
  assert.match(batch[2]?.query ?? "", /INSERT INTO lead_items/i);
  assert.match(batch[3]?.query ?? "", /INSERT INTO lead_events/i);

  assert.equal(
    database.prepared.reduce((total, statement) => total + statement.runCalls, 0),
    0,
    "create path must never execute individual writes outside the batch",
  );
});

test("lead persistence fails closed when the runtime does not expose D1 batch", async () => {
  const statements: FakeStatement[] = [];
  const database = {
    prepare(query: string) {
      const statement = new FakeStatement(query);
      statements.push(statement);
      return statement;
    },
  };

  await assert.rejects(
    createLeadPersistence(database).create(leadPayload()),
    /D1 batch\(\) is required for atomic lead persistence/,
  );
  assert.equal(statements.reduce((total, statement) => total + statement.runCalls, 0), 0);
});

test("the same request id replays only when its canonical payload fingerprint matches", async () => {
  const database = new FakeBatchDatabase({
    firstResults: [existingLead(reorderedPayloadJson())],
  });

  const result = await createLeadPersistence(database).create(leadPayload());

  assert.equal(result.isDuplicate, true);
  assert.equal(result.leadId, "existing-lead");
  assert.equal(database.batches.length, 0, "a verified replay must not write another lead");
});

test("the same request id with different content fails closed instead of replaying another lead", async () => {
  const database = new FakeBatchDatabase({
    firstResults: [existingLead(JSON.stringify(leadPayload()))],
  });
  const changed = { ...leadPayload(), phone: "0999999999" };

  await assert.rejects(
    createLeadPersistence(database).create(changed),
    (error: unknown) => error instanceof LeadIdempotencyConflictError
      && error.code === "LEAD_IDEMPOTENCY_CONFLICT",
  );
  assert.equal(database.batches.length, 0);
});

test("malformed stored payload cannot be accepted as a verified replay", async () => {
  const database = new FakeBatchDatabase({
    firstResults: [existingLead("{not-json")],
  });

  await assert.rejects(
    createLeadPersistence(database).create(leadPayload()),
    LeadIdempotencyConflictError,
  );
  assert.equal(database.batches.length, 0);
});

test("a unique-index race rechecks the winning payload before returning duplicate success", async () => {
  const changedStoredPayload = { ...leadPayload(), phone: "0888888888" };
  const database = new FakeBatchDatabase({
    batchError: new Error("UNIQUE constraint failed: leads.request_id"),
    firstResults: [null, existingLead(JSON.stringify(changedStoredPayload))],
  });

  await assert.rejects(
    createLeadPersistence(database).create(leadPayload()),
    LeadIdempotencyConflictError,
  );
  assert.equal(database.batches.length, 1, "the losing writer reached the transactional unique constraint");
});
