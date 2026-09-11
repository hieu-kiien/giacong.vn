import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  AdminProductBatchConflictError,
  AdminProductBatchIdempotencyConflictError,
  AdminProductBatchStorageError,
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
  private readonly omitBatchResults: boolean;
  private readonly skipMeta: boolean;

  constructor(options: { omitBatchResults?: boolean; skipMeta?: boolean } = {}) {
    this.omitBatchResults = options.omitBatchResults ?? false;
    this.skipMeta = options.skipMeta ?? false;
  }

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
    if (query.includes("FROM audit_logs")) {
      const ids = new Set(values.map(String));
      return {
        results: [...this.childAudits]
          .filter((id) => ids.has(id))
          .map((id) => ({ id })) as T[],
      };
    }
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
      if (this.omitBatchResults) return statements.map(() => ({}));
      return statements.map((statement) => this.execute(statement as FakeStatement));
    } catch (error) {
      this.restore(before);
      throw error;
    }
  }

  private execute(statement: FakeStatement): { results?: unknown[] } {
    const { query, values } = statement;
    if (query.includes("product batch postcondition")) {
      if (this.skipMeta) throw new Error("NOT NULL constraint failed: admin_audit_log.request_id");
      return { results: [{ ok: 1 }] };
    }
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

test("a complete product batch remains successful when D1 omits returned rows", async () => {
  const database = new FakeProductBatchDatabase({ omitBatchResults: true });
  const result = await archiveAdminProductsAtomically(database, {
    actorSubject: "owner@example.com",
    items: [{ id: 1, expectedRevision: 1 }],
    requestId,
  });

  assert.deepEqual(result, {
    changedCount: 1,
    replayed: false,
    selectedCount: 1,
    skipped: [],
  });
  assert.equal(database.batchCalls, 1);
});

test("an incomplete product batch rolls back when product metadata is missing", async () => {
  const database = new FakeProductBatchDatabase({ skipMeta: true });

  await assert.rejects(
    () => archiveAdminProductsAtomically(database, {
      actorSubject: "owner@example.com",
      items: [{ id: 1, expectedRevision: 1 }],
      requestId,
    }),
    AdminProductBatchStorageError,
  );
  assert.deepEqual(database.rows.get(1), { id: 1, is_active: 1, revision: 1 });
  assert.equal(database.markers.size, 0);
  assert.equal(database.envelopes.size, 0);
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

test("product batch replay rejects when a child audit is missing", async () => {
  const database = new FakeProductBatchDatabase();
  const input = { actorSubject: "owner@example.com", items: [{ id: 1, expectedRevision: 1 }], requestId };
  await archiveAdminProductsAtomically(database, input);
  database.childAudits.clear();

  await assert.rejects(
    () => archiveAdminProductsAtomically(database, input),
    AdminProductBatchStorageError,
  );
});

test("product batch maps a concurrent stale race to conflict and rolls back atomically", async () => {
  const database = new FakeProductBatchDatabase();
  database.raceAfterSnapshotId = 1;
  await assert.rejects(() => archiveAdminProductsAtomically(database, { actorSubject: "owner@example.com", items: [{ id: 1, expectedRevision: 1 }], requestId }), AdminProductBatchConflictError);
  assert.deepEqual(database.rows.get(1), { id: 1, is_active: 1, revision: 2 });
  assert.equal(database.markers.size, 0);
  assert.equal(database.envelopes.size, 0);
});

test("SQLite product batch postconditions remain atomic when results are omitted", async () => {
  const database = createSqliteProductBatchDatabase({ omitBatchResults: true });
  try {
    database.sqlite.prepare("INSERT INTO products (name, slug, sku, short_description, description, is_active, revision) VALUES (?, ?, ?, ?, ?, 1, 1)").run(
      "Sản phẩm",
      "san-pham",
      "SKU-1",
      "",
      "",
    );
    const input = { actorSubject: "owner@example.com", items: [{ id: 1, expectedRevision: 1 }], requestId };

    const result = await archiveAdminProductsAtomically(database, input);
    assert.equal(result.changedCount, 1);
    const archived = database.sqlite.prepare("SELECT is_active, revision FROM products WHERE id = 1").get() as { is_active: number; revision: number };
    assert.equal(archived.is_active, 0);
    assert.equal(archived.revision, 2);
    assert.deepEqual((await archiveAdminProductsAtomically(database, input)).replayed, true);
  } finally {
    database.sqlite.close();
  }
});

test("SQLite product batch postconditions rollback a missing metadata write", async () => {
  const database = createSqliteProductBatchDatabase({ skipQuery: /INSERT INTO product_admin_meta/ });
  try {
    database.sqlite.prepare("INSERT INTO products (name, slug, sku, short_description, description, is_active, revision) VALUES (?, ?, ?, ?, ?, 1, 1)").run(
      "Sản phẩm",
      "san-pham",
      "SKU-1",
      "",
      "",
    );

    await assert.rejects(
      () => archiveAdminProductsAtomically(database, {
        actorSubject: "owner@example.com",
        items: [{ id: 1, expectedRevision: 1 }],
        requestId,
      }),
      AdminProductBatchStorageError,
    );
    const active = database.sqlite.prepare("SELECT is_active, revision FROM products WHERE id = 1").get() as { is_active: number; revision: number };
    assert.equal(active.is_active, 1);
    assert.equal(active.revision, 1);
    assert.equal(database.sqlite.prepare("SELECT COUNT(*) AS count FROM admin_audit_log").get()?.count, 0);
    assert.equal(database.sqlite.prepare("SELECT COUNT(*) AS count FROM audit_logs").get()?.count, 0);
  } finally {
    database.sqlite.close();
  }
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
  assert.match(page, /canManage \? <td(?: className="[^"]*")?><input aria-label=\{`Chọn sản phẩm/);
  assert.match(page, /canManage \? <button className="admin-button admin-button-primary" data-testid="button-product-create"/);
  assert.match(page, /canManage \? <td(?: className="[^"]*")?>[\s\S]*admin-table-actions/);
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

class SqliteProductBatchStatement implements D1PreparedStatementLike {
  readonly query: string;
  private values: unknown[] = [];
  private readonly statement: ReturnType<DatabaseSync["prepare"]>;

  constructor(query: string, statement: ReturnType<DatabaseSync["prepare"]>) {
    this.query = query;
    this.statement = statement;
  }

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async all<T>() {
    return { results: this.statement.all(...(this.values as never[])) as T[] };
  }

  async first<T>() {
    return (this.statement.get(...(this.values as never[])) as T | undefined) ?? null;
  }

  async run() {
    this.statement.run(...(this.values as never[]));
    return {};
  }
}

class SqliteProductBatchDatabase implements D1DatabaseLike {
  readonly sqlite: DatabaseSync;
  private readonly omitBatchResults: boolean;
  private readonly skipQuery?: RegExp;

  constructor(sqlite: DatabaseSync, options: { omitBatchResults?: boolean; skipQuery?: RegExp } = {}) {
    this.sqlite = sqlite;
    this.omitBatchResults = options.omitBatchResults ?? false;
    this.skipQuery = options.skipQuery;
  }

  prepare(query: string) {
    return new SqliteProductBatchStatement(query, this.sqlite.prepare(query));
  }

  async batch(statements: SqliteProductBatchStatement[]) {
    this.sqlite.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) {
        if (this.skipQuery?.test(statement.query)) {
          results.push({ results: [] });
        } else {
          results.push(await statement.all());
        }
      }
      this.sqlite.exec("COMMIT");
      return this.omitBatchResults ? results.map(() => ({})) : results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
}

function createSqliteProductBatchDatabase(options: { omitBatchResults?: boolean; skipQuery?: RegExp } = {}) {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      sku TEXT NOT NULL UNIQUE,
      short_description TEXT NOT NULL,
      description TEXT NOT NULL,
      image_url TEXT,
      category_id INTEGER,
      is_active INTEGER NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE product_admin_meta (
      product_id INTEGER PRIMARY KEY,
      status TEXT NOT NULL,
      updated_by TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE admin_audit_log (
      id TEXT PRIMARY KEY DEFAULT 'marker-id',
      request_id TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actor_subject TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_key TEXT NOT NULL,
      previous_revision INTEGER,
      resulting_revision INTEGER,
      payload_sha256 TEXT NOT NULL
    );
    CREATE TABLE audit_logs (
      id TEXT PRIMARY KEY NOT NULL,
      actor_subject TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return new SqliteProductBatchDatabase(sqlite, options);
}
