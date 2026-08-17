import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  AdminServiceStaleWriteError,
  archiveAdminServiceAtomically,
  createAdminServiceAtomically,
  updateAdminServiceAtomically,
} from "../src/lib/admin-service-write.ts";

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
    throw new Error("atomic service write must not call statement.run()");
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
  description: "Mô tả dịch vụ",
  isActive: false,
  leadTimeDays: 14,
  moqSummary: "Từ 500 kg / mẻ",
  name: "Gia công Demo",
  slug: "gia-cong-demo",
  status: "draft" as const,
  summary: "Tóm tắt dịch vụ",
};

const repoRoot = path.join(import.meta.dirname, "..");

function assertNoIndividualWrites(database: FakeBatchDatabase) {
  assert.equal(database.prepared.reduce((total, statement) => total + statement.runCalls, 0), 0);
}

test("service create, admin meta and audit are committed in one D1 batch", async () => {
  const database = new FakeBatchDatabase([{ id: 81 }]);

  const serviceId = await createAdminServiceAtomically(database, input, "actor@example.com");

  assert.equal(serviceId, 81);
  assert.equal(database.batches.length, 1);
  const batch = database.batches[0] ?? [];
  assert.equal(batch.length, 3);
  assert.match(batch[0]?.query ?? "", /INSERT INTO services/);
  assert.match(batch[0]?.query ?? "", /revision\s*\)\s*VALUES\s*\([^]*,\s*1\)\s*RETURNING id/i);
  assert.match(batch[1]?.query ?? "", /INSERT INTO service_admin_meta/);
  assert.match(batch[2]?.query ?? "", /INSERT INTO audit_logs/);
  for (const statement of batch.slice(1)) {
    assert.match(statement.query, /WHERE slug = \?/);
    assert.ok(statement.values.includes(input.slug));
  }
  assertNoIndividualWrites(database);
});

test("service update, meta and audit marker share one exact-revision D1 batch", async () => {
  const database = new FakeBatchDatabase();

  await updateAdminServiceAtomically(database, 81, input, 4, "actor@example.com");

  assert.equal(database.batches.length, 1);
  const batch = database.batches[0] ?? [];
  assert.equal(batch.length, 3);
  assert.match(batch[0]?.query ?? "", /INSERT INTO audit_logs/);
  assert.match(batch[0]?.query ?? "", /FROM services WHERE id = \? AND revision = \?/);
  assert.match(batch[0]?.query ?? "", /RETURNING id/);
  assert.ok(batch[0]?.values.includes("service.updated"));
  assert.ok(batch[0]?.values.includes(4));

  assert.match(batch[1]?.query ?? "", /UPDATE services/);
  assert.match(batch[1]?.query ?? "", /revision = revision \+ 1/);
  assert.match(batch[1]?.query ?? "", /WHERE id = \? AND revision = \?/);
  assert.match(batch[2]?.query ?? "", /INSERT INTO service_admin_meta/);

  const auditId = batch[0]?.values[0];
  assert.equal(typeof auditId, "string");
  assert.ok(batch.slice(1).every((statement) => statement.values.includes(auditId)));
  assertNoIndividualWrites(database);
});

test("stale service update fails after a guarded no-op transaction", async () => {
  const database = new FakeBatchDatabase([]);

  await assert.rejects(
    updateAdminServiceAtomically(database, 81, input, 4, "actor@example.com"),
    AdminServiceStaleWriteError,
  );
  assert.equal(database.batches.length, 1);
  assertNoIndividualWrites(database);
});

test("service archive uses exact revision and archives meta in the same batch", async () => {
  const database = new FakeBatchDatabase();

  await archiveAdminServiceAtomically(database, 81, 8, "actor@example.com");

  const batch = database.batches[0] ?? [];
  assert.equal(batch.length, 3);
  assert.ok(batch[0]?.values.includes("service.archived"));
  assert.ok(batch[0]?.values.includes(8));
  assert.match(batch[1]?.query ?? "", /SET is_active = 0, updated_at = CURRENT_TIMESTAMP, revision = revision \+ 1/);
  assert.match(batch[1]?.query ?? "", /WHERE id = \? AND revision = \?/);
  assert.match(batch[2]?.query ?? "", /status = 'archived'/);
  const auditId = batch[0]?.values[0];
  assert.ok(batch.slice(1).every((statement) => statement.values.includes(auditId)));
  assertNoIndividualWrites(database);
});

test("missing service revision fails before preparing any update or archive write", async () => {
  const updateDatabase = new FakeBatchDatabase();
  await assert.rejects(
    updateAdminServiceAtomically(updateDatabase, 81, input, undefined, "actor@example.com"),
    /Revision hiện tại là bắt buộc/,
  );
  assert.equal(updateDatabase.prepared.length, 0);
  assert.equal(updateDatabase.batches.length, 0);

  const archiveDatabase = new FakeBatchDatabase();
  await assert.rejects(
    archiveAdminServiceAtomically(archiveDatabase, 81, undefined, "actor@example.com"),
    /Revision hiện tại là bắt buộc/,
  );
  assert.equal(archiveDatabase.prepared.length, 0);
  assert.equal(archiveDatabase.batches.length, 0);
});

test("service routes expose revision tokens and use only the atomic write path", async () => {
  const [collectionRoute, itemRoute] = await Promise.all([
    readFile(path.join(repoRoot, "src/app/api/admin/services/route.ts"), "utf8"),
    readFile(path.join(repoRoot, "src/app/api/admin/services/[id]/route.ts"), "utf8"),
  ]);

  assert.match(collectionRoute, /attachAdminServiceRevisions/);
  assert.match(collectionRoute, /createAdminServiceAtomically/);
  assert.doesNotMatch(collectionRoute, /createAdminService\(/);

  assert.match(itemRoute, /attachAdminServiceRevision/);
  assert.match(itemRoute, /hasExplicitRevision\(payload\)/);
  assert.match(itemRoute, /updateAdminServiceAtomically/);
  assert.match(itemRoute, /archiveAdminServiceAtomically/);
  assert.doesNotMatch(itemRoute, /updateAdminService\(|archiveAdminService\(/);
  assert.match(itemRoute, /STALE_WRITE/);
});

test("admin client keeps product revision behavior and injects service revisions only for direct service mutations", async () => {
  const client = await readFile(path.join(repoRoot, "src/lib/admin-client.ts"), "utf8");

  assert.match(client, /serviceRevisionCache/);
  assert.match(client, /withCachedServiceRevision/);
  assert.match(client, /withCachedProductRevision/);

  const matcherStart = client.indexOf("function serviceMutationId");
  const matcherEnd = client.indexOf("function withCachedServiceRevision", matcherStart);
  assert.ok(matcherStart >= 0 && matcherEnd > matcherStart, "service mutation matcher must be isolated");
  const matcherSource = client.slice(matcherStart, matcherEnd);
  assert.ok(matcherSource.includes("api"));
  assert.ok(matcherSource.includes("admin"));
  assert.ok(matcherSource.includes("services"));
  assert.doesNotMatch(matcherSource, /products|variants/);

  assert.match(client, /rememberRevision\(serviceRevisionCache, value\.service\)/);
  assert.match(client, /Array\.isArray\(value\.services\)/);
  assert.match(client, /serviceRevisionCache\.delete\(serviceId\)/);
});
