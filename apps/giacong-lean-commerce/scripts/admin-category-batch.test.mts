import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  AdminCategoryBatchConflictError,
  AdminCategoryBatchIdempotencyConflictError,
  archiveAdminCategoriesAtomically,
  parseAdminCategoryBatchItems,
} from "../src/lib/admin-category-batch.ts";
import type { D1DatabaseLike, D1PreparedStatementLike } from "../src/lib/admin-data.ts";

const root = new URL("../", import.meta.url);

async function read(path: string): Promise<string> {
  return readFile(new URL(path, root), "utf8");
}

type FakeCategoryRow = { id: number; is_active: number; revision: number };

class FakeCategoryBatchDatabase implements D1DatabaseLike {
  readonly rows = new Map<number, FakeCategoryRow>([
    [1, { id: 1, is_active: 1, revision: 1 }],
    [2, { id: 2, is_active: 1, revision: 4 }],
    [3, { id: 3, is_active: 0, revision: 3 }],
  ]);
  readonly markers = new Map<string, { action: string; entity_key: string; entity_type: string; payload_sha256: string }>();
  readonly envelopes = new Map<string, string>();
  readonly childAudits = new Set<string>();
  batchCalls = 0;
  raceAfterSnapshotId: number | null = null;
  private lastChanges = 0;

  prepare(query: string): D1PreparedStatementLike {
    return new FakeCategoryBatchStatement(this, query);
  }

  async first<T>(query: string, values: unknown[]): Promise<T | null> {
    if (query.includes("FROM admin_audit_log")) {
      return (this.markers.get(String(values[0])) ?? null) as T | null;
    }
    if (query.includes("category.bulk_archived_batch")) {
      const metadata = this.envelopes.get(String(values[0]));
      return (metadata ? { metadata_json: metadata } : null) as T | null;
    }
    if (query.includes("sqlite_master")) {
      const tableName = String(values[0]);
      return (["admin_audit_log", "audit_logs"].includes(tableName) ? { name: tableName } : null) as T | null;
    }
    return null;
  }

  async all<T>(query: string, values: unknown[]): Promise<{ results: T[] }> {
    if (!query.includes("FROM categories")) return { results: [] };
    const ids = new Set(values.map(Number));
    const results = [...this.rows.values()]
      .filter((row) => ids.has(row.id))
      .map((row) => ({ ...row })) as T[];
    if (this.raceAfterSnapshotId !== null) {
      const row = this.rows.get(this.raceAfterSnapshotId);
      if (row) row.revision += 1;
      this.raceAfterSnapshotId = null;
    }
    return { results };
  }

  async batch(statements: D1PreparedStatementLike[]): Promise<Array<{ results?: unknown[] }>> {
    this.batchCalls += 1;
    const rowsBefore = new Map([...this.rows].map(([id, row]) => [id, { ...row }]));
    const markersBefore = new Map(this.markers);
    const envelopesBefore = new Map(this.envelopes);
    const childAuditsBefore = new Set(this.childAudits);
    const lastChangesBefore = this.lastChanges;
    const results: Array<{ results?: unknown[] }> = [];
    try {
      for (const statement of statements) {
        const current = statement as FakeCategoryBatchStatement;
        results.push(this.execute(current.query, current.values));
      }
      return results;
    } catch (error) {
      this.rows.clear();
      for (const [id, row] of rowsBefore) this.rows.set(id, row);
      this.markers.clear();
      for (const [id, marker] of markersBefore) this.markers.set(id, marker);
      this.envelopes.clear();
      for (const [id, metadata] of envelopesBefore) this.envelopes.set(id, metadata);
      this.childAudits.clear();
      for (const id of childAuditsBefore) this.childAudits.add(id);
      this.lastChanges = lastChangesBefore;
      throw error;
    }
  }

  private execute(query: string, values: unknown[]): { results?: unknown[] } {
    if (query.includes("WHERE NOT EXISTS")) {
      const id = Number(values[6]);
      const expectedRevision = Number(values[7]);
      const row = this.rows.get(id);
      if (this.lastChanges === 1 && row?.is_active === 0 && row.revision === expectedRevision) return { results: [] };
      throw new Error("UNIQUE constraint failed: admin_audit_log.request_id");
    }
    if (query.includes("INSERT INTO admin_audit_log")) {
      const requestId = String(values[0]);
      if (this.markers.has(requestId)) throw new Error("UNIQUE constraint failed: admin_audit_log.request_id");
      this.markers.set(requestId, {
        action: "delete",
        entity_key: String(values[2]),
        entity_type: "category",
        payload_sha256: String(values[3]),
      });
      this.lastChanges = 1;
      return { results: [{ request_id: requestId }] };
    }
    if (query.includes("UPDATE categories")) {
      const id = Number(values[0]);
      const expectedRevision = Number(values[1]);
      const row = this.rows.get(id);
      if (!row || row.is_active !== 1 || row.revision !== expectedRevision) {
        this.lastChanges = 0;
        return { results: [] };
      }
      row.is_active = 0;
      row.revision += 1;
      this.lastChanges = 1;
      return { results: [{ id: row.id, revision: row.revision }] };
    }
    if (query.includes("category.bulk_archived_batch")) {
      this.envelopes.set(String(values[0]), String(values[2]));
      return { results: [{ id: values[0] }] };
    }
    if (query.includes("INSERT INTO audit_logs")) {
      const id = String(values[0]);
      const row = this.rows.get(Number(values[3]));
      if (!row || row.is_active !== 0 || row.revision !== Number(values[4])) return { results: [] };
      this.childAudits.add(id);
      return { results: [{ id }] };
    }
    throw new Error(`Unhandled fake statement: ${query}`);
  }
}

class FakeCategoryBatchStatement implements D1PreparedStatementLike {
  values: unknown[] = [];
  private readonly database: FakeCategoryBatchDatabase;
  readonly query: string;

  constructor(database: FakeCategoryBatchDatabase, query: string) {
    this.database = database;
    this.query = query;
  }

  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }

  all<T>(): Promise<{ results: T[] }> {
    return this.database.all<T>(this.query, this.values);
  }

  first<T>(): Promise<T | null> {
    return this.database.first<T>(this.query, this.values);
  }

  async run(): Promise<unknown> {
    return {};
  }
}

test("category batch parser rejects empty, duplicate, oversized and malformed selections", () => {
  assert.equal(parseAdminCategoryBatchItems([]), null);
  assert.equal(parseAdminCategoryBatchItems(Array.from({ length: 101 }, (_, id) => ({ expectedRevision: 1, id: id + 1 }))), null);
  assert.equal(parseAdminCategoryBatchItems([{ expectedRevision: 1, id: 1 }, { expectedRevision: 2, id: 1 }]), null);
  assert.equal(parseAdminCategoryBatchItems([{ expectedRevision: 1, id: 1, extra: true }]), null);
  assert.deepEqual(parseAdminCategoryBatchItems([{ expectedRevision: 2, id: 2 }, { expectedRevision: 1, id: 1 }]), [
    { expectedRevision: 1, id: 1 },
    { expectedRevision: 2, id: 2 },
  ]);
});

test("category batch archives active rows, reports skips, and replays idempotently", async () => {
  const database = new FakeCategoryBatchDatabase();
  const input = {
    actorSubject: "owner@example.com",
    items: [
      { expectedRevision: 3, id: 3 },
      { expectedRevision: 1, id: 1 },
      { expectedRevision: 3, id: 2 },
      { expectedRevision: 1, id: 4 },
    ],
    requestId: "55555555-5555-4555-8555-555555555555",
  };

  const first = await archiveAdminCategoriesAtomically(database, input);
  assert.deepEqual(first, {
    changedCount: 1,
    replayed: false,
    selectedCount: 4,
    skipped: [
      { id: 2, reason: "stale" },
      { id: 3, reason: "already_archived" },
      { id: 4, reason: "not_found" },
    ],
  });
  assert.deepEqual(database.rows.get(1), { id: 1, is_active: 0, revision: 2 });
  assert.equal(database.childAudits.size, 1);
  assert.equal(database.envelopes.size, 1);
  assert.equal(database.batchCalls, 1);

  const replay = await archiveAdminCategoriesAtomically(database, input);
  assert.deepEqual(replay, { ...first, replayed: true });
  assert.equal(database.batchCalls, 1);
  await assert.rejects(
    () => archiveAdminCategoriesAtomically(database, { ...input, items: [{ expectedRevision: 2, id: 1 }] }),
    AdminCategoryBatchIdempotencyConflictError,
  );
});

test("category batch maps a concurrent revision race to stale write and rolls back", async () => {
  const database = new FakeCategoryBatchDatabase();
  database.raceAfterSnapshotId = 1;

  await assert.rejects(
    () => archiveAdminCategoriesAtomically(database, {
      actorSubject: "owner@example.com",
      items: [{ expectedRevision: 1, id: 1 }],
      requestId: "66666666-6666-4666-8666-666666666666",
    }),
    AdminCategoryBatchConflictError,
  );
  assert.deepEqual(database.rows.get(1), { id: 1, is_active: 1, revision: 2 });
  assert.equal(database.markers.size, 0);
  assert.equal(database.envelopes.size, 0);
  assert.equal(database.childAudits.size, 0);
});

test("category batch route and UI stay bounded, authorized, revision-aware and deactivation-only", async () => {
  const [route, writer, panel, packageJson] = await Promise.all([
    read("src/app/api/admin/categories/batch/route.ts"),
    read("src/lib/admin-category-batch.ts"),
    read("src/components/admin/AdminCategoryPanel.tsx"),
    read("package.json"),
  ]);

  assert.match(route, /readBoundedAdminJson/);
  assert.match(route, /canManageCatalog/);
  assert.match(route, /hasOnlyKeys/);
  assert.match(route, /archiveAdminCategoriesAtomically/);
  assert.match(route, /STALE_WRITE/);
  assert.match(writer, /MAX_CATEGORY_BATCH_ITEMS = 100/);
  assert.match(writer, /admin_audit_log/);
  assert.match(writer, /payload_sha256/);
  assert.match(writer, /batch\(/);
  assert.match(writer, /UPDATE categories/);
  assert.match(writer, /revision = revision \+ 1/);
  assert.match(writer, /audit_logs/);
  assert.match(writer, /AdminCategoryBatchIdempotencyConflictError/);
  assert.match(panel, /selectedIds/);
  assert.match(panel, /\/api\/admin\/categories\/batch/);
  assert.match(panel, /Chọn tất cả danh mục trong trang/);
  assert.match(panel, /AdminConfirmDialog/);
  assert.match(panel, /Ẩn danh mục đã chọn/);
  assert.doesNotMatch(panel, /method: "DELETE"/);
  assert.match(packageJson, /scripts\/admin-category-batch\.test\.mts/);
});
