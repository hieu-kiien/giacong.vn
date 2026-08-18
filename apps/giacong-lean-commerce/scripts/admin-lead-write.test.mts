import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  AdminLeadStaleWriteError,
  updateAdminLeadStatusAtomically,
} from "../src/lib/admin-lead-write.ts";

class FakeStatement {
  readonly query: string;
  values: unknown[] = [];
  firstResult: unknown = null;
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
    return this.firstResult as T | null;
  }

  async run() {
    this.runCalls += 1;
    throw new Error("atomic lead status update must not call statement.run()");
  }
}

class FakeBatchDatabase {
  readonly prepared: FakeStatement[] = [];
  readonly batches: FakeStatement[][] = [];
  readonly firstResults: unknown[];
  markerInserted: boolean;

  constructor(options: { firstResults?: unknown[]; markerInserted?: boolean } = {}) {
    this.firstResults = [...(options.firstResults ?? [])];
    this.markerInserted = options.markerInserted ?? true;
  }

  prepare(query: string) {
    const statement = new FakeStatement(query);
    if (/SELECT id, status, full_name/i.test(query)) {
      statement.firstResult = this.firstResults.shift() ?? null;
    }
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

const LEAD_ID = "11111111-1111-4111-8111-111111111111";
const repoRoot = path.join(import.meta.dirname, "..");

function leadRow(status: string) {
  return {
    assigned_to: null,
    company_name: "Công ty Demo",
    country: "VN",
    created_at: "2026-08-17 10:00:00",
    delivery_status: "delivered",
    email: "demo@example.com",
    full_name: "Nguyễn Demo",
    id: LEAD_ID,
    message: "Cần báo giá",
    phone: "0912345678",
    source: "request_form",
    status,
    updated_at: "2026-08-17 10:00:00",
  };
}

function assertNoIndividualWrites(database: FakeBatchDatabase) {
  assert.equal(database.prepared.reduce((total, statement) => total + statement.runCalls, 0), 0);
}

test("lead status, event and audit marker are committed in one guarded D1 batch", async () => {
  const database = new FakeBatchDatabase({
    firstResults: [leadRow("new"), leadRow("contacted")],
  });

  const lead = await updateAdminLeadStatusAtomically(
    database,
    LEAD_ID,
    "new",
    "contacted",
    "sales@example.com",
  );

  assert.equal(lead?.status, "contacted");
  assert.equal(database.batches.length, 1);
  const batch = database.batches[0] ?? [];
  assert.equal(batch.length, 3);
  assert.match(batch[0]?.query ?? "", /INSERT INTO audit_logs/);
  assert.match(batch[0]?.query ?? "", /WHERE id = \? AND status = \?/);
  assert.match(batch[0]?.query ?? "", /RETURNING id/);
  assert.ok(batch[0]?.values.includes("new"));
  assert.match(batch[1]?.query ?? "", /UPDATE leads/);
  assert.match(batch[1]?.query ?? "", /WHERE id = \? AND status = \?/);
  assert.match(batch[2]?.query ?? "", /INSERT INTO lead_events/);
  assert.match(batch[2]?.query ?? "", /status_changed/);

  const auditId = batch[0]?.values[0];
  assert.equal(typeof auditId, "string");
  assert.ok(batch.slice(1).every((statement) => statement.values.includes(auditId)));
  assertNoIndividualWrites(database);
});

test("a stale UI status is rejected before preparing any mutation batch", async () => {
  const database = new FakeBatchDatabase({ firstResults: [leadRow("qualified")] });

  await assert.rejects(
    updateAdminLeadStatusAtomically(database, LEAD_ID, "new", "contacted", "sales@example.com"),
    AdminLeadStaleWriteError,
  );
  assert.equal(database.batches.length, 0);
  assertNoIndividualWrites(database);
});

test("a concurrent status change after the initial read is rejected by the transaction marker", async () => {
  const database = new FakeBatchDatabase({
    firstResults: [leadRow("new")],
    markerInserted: false,
  });

  await assert.rejects(
    updateAdminLeadStatusAtomically(database, LEAD_ID, "new", "contacted", "sales@example.com"),
    AdminLeadStaleWriteError,
  );
  assert.equal(database.batches.length, 1);
  assertNoIndividualWrites(database);
});

test("requesting the already-read status is an idempotent no-op", async () => {
  const database = new FakeBatchDatabase({ firstResults: [leadRow("qualified")] });

  const lead = await updateAdminLeadStatusAtomically(
    database,
    LEAD_ID,
    "qualified",
    "qualified",
    "sales@example.com",
  );

  assert.equal(lead?.status, "qualified");
  assert.equal(database.batches.length, 0);
  assertNoIndividualWrites(database);
});

test("lead status update fails closed when D1 batch is unavailable", async () => {
  const statements: FakeStatement[] = [];
  const database = {
    prepare(query: string) {
      const statement = new FakeStatement(query);
      if (/SELECT id, status, full_name/i.test(query)) statement.firstResult = leadRow("new");
      statements.push(statement);
      return statement;
    },
  };

  await assert.rejects(
    updateAdminLeadStatusAtomically(database, LEAD_ID, "new", "contacted", "sales@example.com"),
    /D1 batch\(\) là bắt buộc/,
  );
  assert.equal(statements.reduce((total, statement) => total + statement.runCalls, 0), 0);
});

test("lead route requires expectedStatus and no longer calls the legacy split writer", async () => {
  const route = await readFile(
    path.join(repoRoot, "src/app/api/admin/leads/[id]/route.ts"),
    "utf8",
  );

  assert.match(route, /readLeadStatus\(payload, "expectedStatus"\)/);
  assert.match(route, /updateAdminLeadStatusAtomically/);
  assert.doesNotMatch(route, /updateAdminLeadStatus\(/);
  assert.match(route, /STALE_WRITE/);
});

test("admin client injects the last-read lead status only for direct lead PATCH mutations", async () => {
  const client = await readFile(path.join(repoRoot, "src/lib/admin-client.ts"), "utf8");

  assert.match(client, /leadStatusCache/);
  assert.match(client, /withCachedLeadStatus/);
  assert.match(client, /expectedStatus/);

  const matcherStart = client.indexOf("function leadMutationId");
  const matcherEnd = client.indexOf("function withCachedLeadStatus", matcherStart);
  assert.ok(matcherStart >= 0 && matcherEnd > matcherStart, "lead mutation matcher must be isolated");
  const matcherSource = client.slice(matcherStart, matcherEnd);
  assert.ok(matcherSource.includes("api"));
  assert.ok(matcherSource.includes("admin"));
  assert.ok(matcherSource.includes("leads"));
  assert.doesNotMatch(matcherSource, /products|services|variants/);

  assert.match(client, /rememberLeadStatus\(value\.lead\)/);
  assert.match(client, /Array\.isArray\(value\.leads\)/);
  assert.match(client, /leadStatusCache\.delete\(leadId\)/);
  assert.match(client, /method !== "PATCH"/);
});

test("lead inbox exposes delivery diagnostics without adding a retry mutation", async () => {
  const [route, readModel, page] = await Promise.all([
    readFile(path.join(repoRoot, "src/app/api/admin/leads/route.ts"), "utf8"),
    readFile(path.join(repoRoot, "src/lib/admin-lead-delivery-data.ts"), "utf8"),
    readFile(path.join(repoRoot, "src/app/admin/yeu-cau/page.tsx"), "utf8"),
  ]);

  assert.match(readModel, /delivery_attempts/);
  assert.match(readModel, /delivery_error/);
  assert.match(readModel, /webhook_reference/);
  assert.match(readModel, /delivered_at/);
  assert.match(route, /getAdminLeadDeliveryDetails/);
  assert.match(page, /lead\.deliveryAttempts/);
  assert.match(page, /lead\.deliveryError/);
  assert.match(page, /lead\.webhookReference/);
  assert.match(page, /lead\.deliveredAt/);
  assert.doesNotMatch(page, /retry-delivery|retryDelivery/);
});
