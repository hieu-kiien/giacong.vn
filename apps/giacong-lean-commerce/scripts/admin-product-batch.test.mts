import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  AdminProductBatchConflictError,
  AdminProductBatchIdempotencyConflictError,
  archiveAdminProductsAtomically,
  listAdminProductBatchSnapshots,
  parseAdminProductBatchItems,
} from "../src/lib/admin-product-batch.ts";
import type { D1DatabaseLike, D1PreparedStatementLike } from "../src/lib/admin-data.ts";

const root = new URL("../", import.meta.url);
const requestId = "66666666-6666-4666-8666-666666666666";

async function read(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, root), "utf8");
}

type ProductRow = { id: number; is_active: number; revision: number };

class FakeProductBatchDatabase implements D1DatabaseLike {
  readonly rows = new Map<number, ProductRow>([
    [1, { id: 1, is_active: 1, revision: 1 }],
    [2, { id: 2, is_active: 1, revision: 4 }],
    [3, { id: 3, is_active: 0, revision: 3 }],
  ]);
  readonly markers = new Map<string, { action: string; entity_key: string; entity_type: string; payload_sha256: string }>();
  readonly envelopes = new Map<string, string>();
  readonly childAudits = new Set<string>();
  readonly meta = new Set<number>();
  batchCalls = 0;
  raceAfterSnapshotId: number | null = null;
  private lastChanges = 0;

  prepare(query: string): D1PreparedStatementLike {
    return new FakeStatement(this, query);
  }

  async first<T>(query: string, values: unknown[]): Promise<T | null> {
    if (query.includes("FROM admin_audit_log")) return (this.markers.get(String(values[0])) ?? null) as T | null;
    if (query.includes("bulk_archived_batch")) {
      const metadata = this.envelopes.get(String(values[0]));
      return (metadata ? { metadata_json: metadata } : null) as T | null;
    }
    if (query.includes("sqlite_master")) {
      const table = String(values[0]);
      return (["admin_audit_log", "audit_logs", "product_admin_meta"].includes(table) ? { name: table } : null) as T | null;
    }
    return null;
  }

  async all<T>(query: string, values: unknown[]): Promise<{ results: T[] }> {
    if (!query.includes("FROM products")) return { results: [] };
    const ids = new Set(values.map(Number));
    const results = [...this.rows.values()].filter((row) => ids.has(row.id)).map((row) => ({ ...row })) as T[];
    if (this.raceAfterSnapshotId !== null) {
      const row = this.rows.get(this.raceAfterSnapshotId);
      if (row) row.revision += 1;
      this.raceAfterSnapshotId = null;
    }
    return { results };
  }

  async batch(statements: D1PreparedStatementLike[]) {
    this.batchCalls += 1;
    const before = this.snapshot();
    try {
      return statements.map((statement) => this.execute(statement as FakeStatement));
    } catch (error) {
      this.restore(before);
      throw error;
    }
  }

  private execute(statement: FakeStatement): { results?: unknown[] } {
    const { query, values } = statement;
    if (query.includes("WHERE NOT EXISTS")) {
      const id = Number(values[6]);
      const revision = Number(values[7]);
      const row = this.rows.get(id);
      if (this.lastChanges === 1 && row?.is_active === 0 && row.revision === revision) return { results: [] };
      throw new Error("UNIQUE constraint failed: admin_audit_log.request_id");
    }
    if (query.includes("INSERT INTO admin_audit_log")) {
      const id = String(values[0]);
      if (this.markers.has(id)) throw new Error("UNIQUE constraint failed: admin_audit_log.request_id");
      this.markers.set(id, { action: "delete", entity_key: String(values[2]), entity_type: "product", payload_sha256: String(values[3]) });
      this.lastChanges = 1;
      return { results: [{ request_id: id }] };
    }
    if (query.includes("UPDATE products")) {
      const id = Number(values[0]);
      const revision = Number(values[1]);
      const row = this.rows.get(id);
      if (!row || row.is_active !== 1 || row.revision !== revision) { this.lastChanges = 0; return { results: [] }; }
      row.is_active = 0;
      row.revision += 1;
      this.lastChanges = 1;
      return { results: [{ id, revision: row.revision }] };
    }
    if (query.includes("INSERT INTO product_admin_meta")) {
      const id = Number(values[0]);
      const row = this.rows.get(Number(values[2]));
      if (!row || row.is_active !== 0 || row.revision !== Number(values[3])) return { results: [] };
      this.meta.add(id);
      return { results: [{ product_id: id }] };
    }
    if (query.includes("bulk_archived_batch")) {
      this.envelopes.set(String(values[0]), String(values[2]));
      return { results: [{ id: values[0] }] };
    }
    if (query.includes("INSERT INTO audit_logs")) {
      const id = String(values[0]);
      this.childAudits.add(id);
      return { results: [{ id }] };
    }
    throw new Error(`Unhandled fake statement: ${query}`);
  }

  private snapshot() { return { rows: new Map([...this.rows].map(([id, row]) => [id, { ...row }])), markers: new Map(this.markers), envelopes: new Map(this.envelopes), childAudits: new Set(this.childAudits), meta: new Set(this.meta) }; }
  private restore(snapshot: ReturnType<FakeProductBatchDatabase["snapshot"]>) { this.rows.clear(); for (const [id, row] of snapshot.rows) this.rows.set(id, row); this.markers.clear(); for (const [id, marker] of snapshot.markers) this.markers.set(id, marker); this.envelopes.clear(); for (const [id, value] of snapshot.envelopes) this.envelopes.set(id, value); this.childAudits.clear(); for (const id of snapshot.childAudits) this.childAudits.add(id); this.meta.clear(); for (const id of snapshot.meta) this.meta.add(id); }
}

class FakeStatement implements D1PreparedStatementLike {
  values: unknown[] = [];
  readonly database: FakeProductBatchDatabase;
  readonly query: string;
  constructor(database: FakeProductBatchDatabase, query: string) {
    this.database = database;
    this.query = query;
  }
  bind(...values: unknown[]) { this.values = values; return this; }
  all<T>() { return this.database.all<T>(this.query, this.values); }
  first<T>() { return this.database.first<T>(this.query, this.values); }
  async run() { return {}; }
}

test("product batch parser enforces exact keys, positive revisions, bounds and duplicate ids", () => {
  assert.deepEqual(parseAdminProductBatchItems([{ id: 2, expectedRevision: 4 }, { id: 1, expectedRevision: 1 }]), [
    { id: 1, expectedRevision: 1 }, { id: 2, expectedRevision: 4 },
  ]);
  assert.equal(parseAdminProductBatchItems([{ id: 1, expectedRevision: 1, extra: true }]), null);
  assert.equal(parseAdminProductBatchItems([{ id: 1, expectedRevision: 1 }, { id: 1, expectedRevision: 2 }]), null);
  assert.equal(parseAdminProductBatchItems(Array.from({ length: 101 }, (_, id) => ({ id: id + 1, expectedRevision: 1 }))), null);
});

test("product batch archives eligible rows and reports not_found, stale and already_archived", async () => {
  const database = new FakeProductBatchDatabase();
  const result = await archiveAdminProductsAtomically(database, {
    actorSubject: "owner@example.com",
    items: [{ id: 1, expectedRevision: 1 }, { id: 2, expectedRevision: 3 }, { id: 3, expectedRevision: 3 }, { id: 99, expectedRevision: 1 }],
    requestId,
  });
  assert.equal(result.changedCount, 1);
  assert.deepEqual(result.skipped, [{ id: 2, reason: "stale" }, { id: 3, reason: "already_archived" }, { id: 99, reason: "not_found" }]);
  assert.deepEqual(database.rows.get(1), { id: 1, is_active: 0, revision: 2 });
  assert.equal(database.batchCalls, 1);
});

test("product batch replay is idempotent and conflicting reuse is rejected", async () => {
  const database = new FakeProductBatchDatabase();
  const input = { actorSubject: "owner@example.com", items: [{ id: 1, expectedRevision: 1 }], requestId };
  const first = await archiveAdminProductsAtomically(database, input);
  const replay = await archiveAdminProductsAtomically(database, input);
  assert.deepEqual(replay, { ...first, replayed: true });
  assert.equal(database.batchCalls, 1);
  await assert.rejects(() => archiveAdminProductsAtomically(database, { ...input, items: [{ id: 2, expectedRevision: 4 }] }), AdminProductBatchIdempotencyConflictError);
});

test("product batch maps a concurrent stale race to conflict and rolls back atomically", async () => {
  const database = new FakeProductBatchDatabase();
  database.raceAfterSnapshotId = 1;
  await assert.rejects(() => archiveAdminProductsAtomically(database, { actorSubject: "owner@example.com", items: [{ id: 1, expectedRevision: 1 }], requestId }), AdminProductBatchConflictError);
  assert.deepEqual(database.rows.get(1), { id: 1, is_active: 1, revision: 2 });
  assert.equal(database.markers.size, 0);
  assert.equal(database.envelopes.size, 0);
});

test("product batch route and UI expose bounded revision-aware archive controls", async () => {
  const [route, writer, page] = await Promise.all([
    read("src/app/api/admin/products/batch/route.ts"),
    read("src/lib/admin-product-batch.ts"),
    read("src/app/admin/san-pham/page.tsx"),
  ]);
  assert.match(route, /requireAdmin\(request\)/);
  assert.match(route, /canManageCatalog\(guard\.member\.role\)/);
  assert.match(route, /readBoundedAdminJson/);
  assert.match(route, /hasOnlyKeys/);
  assert.match(route, /STALE_WRITE/);
  assert.match(writer, /MAX_PRODUCT_BATCH_ITEMS = 100/);
  assert.match(writer, /UPDATE products/);
  assert.match(writer, /revision = revision \+ 1/);
  assert.match(writer, /admin_audit_log/);
  assert.match(writer, /audit_logs/);
  assert.match(writer, /batch\(/);
  assert.match(page, /selectedIds/);
  assert.match(page, /Chọn tất cả sản phẩm trong trang/);
  assert.match(page, /\/api\/admin\/products\/batch/);
  assert.match(page, /canManageCatalog/);
  assert.match(page, /canManage \? <th scope="col"><label className="admin-check"><input aria-label="Chọn tất cả sản phẩm/);
  assert.match(page, /canManage \? <td><input aria-label=\{`Chọn sản phẩm/);
  assert.match(page, /canManage \? <button className="admin-button admin-button-primary" data-testid="button-product-create"/);
  assert.match(page, /canManage \? <td>[\s\S]*admin-table-actions/);
  assert.match(page, /expectedRevision: revisions\.get\(id\) \?\? 1/);
  assert.match(page, /selectedCount: number/);
  assert.match(page, /pendingBatch/);
  assert.match(page, /requestId: batch\.requestId/);
  assert.match(page, /stale: "xung đột phiên"/);
  assert.match(page, /already_archived: "đã ẩn trước đó"/);
  assert.match(page, /not_found: "không còn tồn tại"/);
});

test("product snapshot reader is additive and bounded", async () => {
  const database = new FakeProductBatchDatabase();
  assert.deepEqual(await listAdminProductBatchSnapshots(database, [2, 1]), [
    { id: 1, isActive: true, revision: 1 }, { id: 2, isActive: true, revision: 4 },
  ]);
  assert.equal(parseAdminProductBatchItems([]), null);
});
