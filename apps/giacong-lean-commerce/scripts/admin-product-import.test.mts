import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { canManageCatalog } from "../src/lib/admin-permissions.ts";
import {
  ADMIN_PRODUCT_IMPORT_AUDIT_BIND_COUNT,
  ADMIN_PRODUCT_IMPORT_BATCH_STATEMENTS,
  ADMIN_PRODUCT_IMPORT_CHUNK_ROWS,
  ADMIN_PRODUCT_IMPORT_HEADERS,
  ADMIN_PRODUCT_IMPORT_MARKER_BIND_COUNT,
  ADMIN_PRODUCT_IMPORT_META_BIND_COUNT,
  ADMIN_PRODUCT_IMPORT_PRODUCT_BIND_COUNT,
  MAX_ADMIN_PRODUCT_IMPORT_BIND_VARIABLES,
  MAX_ADMIN_PRODUCT_IMPORT_BYTES,
  MAX_ADMIN_PRODUCT_IMPORT_ROWS,
  fingerprintAdminProductImport,
  fingerprintAdminProductImportRows,
  getAdminProductImportBindCounts,
  parseProductImportCsv,
  prepareAdminProductImportRows,
  type AdminProductImportRow,
} from "../src/lib/admin-product-import.ts";
import {
  AdminProductImportIdempotencyConflictError,
  adminProductImportAuditId,
  createAdminProductsAtomically,
  findAdminProductImportReplay,
  isAdminProductImportReplay,
} from "../src/lib/admin-product-import-write.ts";
import {
  readJsonBodyWithinLimit,
  resolveAdminProductImportRequestId,
} from "../src/lib/admin-product-import-request.ts";

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
    throw new Error("bulk product write must not call statement.run()");
  }
}

class FakeBatchDatabase {
  readonly statements: FakeStatement[] = [];
  batchCalls = 0;

  prepare(query: string) {
    const statement = new FakeStatement(query);
    this.statements.push(statement);
    return statement;
  }

  async batch(statements: FakeStatement[]) {
    this.batchCalls += 1;
    assert.ok(statements.length <= ADMIN_PRODUCT_IMPORT_BATCH_STATEMENTS);
    let nextProductId = 101;
    return statements.map((statement) => {
      if (/INSERT INTO products/.test(statement.query)) {
        const count = statement.values.length / ADMIN_PRODUCT_IMPORT_PRODUCT_BIND_COUNT;
        return {
          results: Array.from({ length: count }, (_, index) => ({
            id: nextProductId++,
            slug: String(statement.values[index * ADMIN_PRODUCT_IMPORT_PRODUCT_BIND_COUNT + 1]),
          })),
        };
      }
      if (/INSERT INTO product_admin_meta|product\.bulk_created/.test(statement.query)) {
        const count = statement.values.length / (
          /INSERT INTO product_admin_meta/.test(statement.query)
            ? ADMIN_PRODUCT_IMPORT_META_BIND_COUNT
            : ADMIN_PRODUCT_IMPORT_AUDIT_BIND_COUNT
        );
        return { results: Array.from({ length: count }, () => ({ ok: 1 })) };
      }
      return { results: [{ ok: 1 }] };
    });
  }
}

class ReplayStatement extends FakeStatement {
  readonly kind: "marker" | "audit";
  private readonly marker: { action: string; entityKey: string; entityType: string };

  constructor(
    query: string,
    kind: "marker" | "audit",
    marker: { action: string; entityKey: string; entityType: string },
  ) {
    super(query);
    this.kind = kind;
    this.marker = marker;
  }

  override async first<T>() {
    return (this.kind === "marker"
      ? {
        action: this.marker.action,
        entity_key: this.marker.entityKey,
        entity_type: this.marker.entityType,
        payload_sha256: FINGERPRINT,
        request_id: REQUEST_ID,
      }
      : null) as T | null;
  }

  override async all<T>() {
    return (this.kind === "audit"
      ? {
        results: [
          { id: adminProductImportAuditId(REQUEST_ID, 0), entity_id: "101" },
          { id: adminProductImportAuditId(REQUEST_ID, 1), entity_id: "102" },
        ],
      }
      : { results: [] }) as { results: T[] };
  }
}

class ReplayDatabase {
  readonly statements: ReplayStatement[] = [];
  private readonly marker: { action: string; entityKey: string; entityType: string };

  constructor(marker = {
    action: "create",
    entityKey: `bulk-product-import:${REQUEST_ID}`,
    entityType: "product",
  }) {
    this.marker = marker;
  }

  prepare(query: string) {
    const statement = new ReplayStatement(
      query,
      /admin_audit_log/.test(query) ? "marker" : "audit",
      this.marker,
    );
    this.statements.push(statement);
    return statement;
  }
}

class SqliteD1PreparedStatement {
  private values: unknown[] = [];
  private readonly statement: ReturnType<DatabaseSync["prepare"]>;

  constructor(statement: ReturnType<DatabaseSync["prepare"]>) {
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

class SqliteD1Database {
  readonly sqlite: DatabaseSync;

  constructor(sqlite: DatabaseSync) {
    this.sqlite = sqlite;
  }

  prepare(query: string) {
    return new SqliteD1PreparedStatement(this.sqlite.prepare(query));
  }

  async batch(statements: SqliteD1PreparedStatement[]) {
    this.sqlite.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.all());
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }
}

const categories = [
  { id: 3, name: "Bột dinh dưỡng", slug: "bot-dinh-duong" },
  { id: 4, name: "Nước uống", slug: "nuoc-uong" },
];

const validRows: AdminProductImportRow[] = [
  {
    categorySlug: "bot-dinh-duong",
    description: "Mô tả chi tiết",
    imageUrl: "",
    leadTimeDays: "14",
    name: "Bột yến mạch",
    shortDescription: "Mô tả ngắn",
    sku: "OAT-001",
    slug: "bot-yen-mach",
  },
  {
    categorySlug: "nuoc-uong",
    description: "",
    imageUrl: "https://example.com/water.webp",
    leadTimeDays: "",
    name: "Nước trái cây",
    shortDescription: "",
    sku: "JUICE-001",
    slug: "nuoc-trai-cay",
  },
];

const REQUEST_ID = "6b1e0f7a-6c2f-4c1a-9c3e-8f5b2d0a1e44";
const FINGERPRINT = "a".repeat(64);

test("bulk import row cap is derived from every D1 statement bind budget", () => {
  assert.equal(MAX_ADMIN_PRODUCT_IMPORT_BIND_VARIABLES, 100);
  assert.equal(ADMIN_PRODUCT_IMPORT_CHUNK_ROWS, 14);
  assert.equal(MAX_ADMIN_PRODUCT_IMPORT_ROWS, 50);
  assert.equal(ADMIN_PRODUCT_IMPORT_BATCH_STATEMENTS, 13);
  assert.deepEqual(getAdminProductImportBindCounts(MAX_ADMIN_PRODUCT_IMPORT_ROWS), {
    audit: MAX_ADMIN_PRODUCT_IMPORT_ROWS * ADMIN_PRODUCT_IMPORT_AUDIT_BIND_COUNT,
    marker: ADMIN_PRODUCT_IMPORT_MARKER_BIND_COUNT,
    meta: MAX_ADMIN_PRODUCT_IMPORT_ROWS * ADMIN_PRODUCT_IMPORT_META_BIND_COUNT,
    product: MAX_ADMIN_PRODUCT_IMPORT_ROWS * ADMIN_PRODUCT_IMPORT_PRODUCT_BIND_COUNT,
  });
  assert.ok(getAdminProductImportBindCounts(MAX_ADMIN_PRODUCT_IMPORT_ROWS).product
    > MAX_ADMIN_PRODUCT_IMPORT_BIND_VARIABLES);
  assert.ok(getAdminProductImportBindCounts(ADMIN_PRODUCT_IMPORT_CHUNK_ROWS).product
    <= MAX_ADMIN_PRODUCT_IMPORT_BIND_VARIABLES);
});

test("CSV product import rejects UTF-8 content beyond the contract byte bound", () => {
  const oversized = `name,slug,sku\n${"é".repeat(MAX_ADMIN_PRODUCT_IMPORT_BYTES)}`;
  const result = parseProductImportCsv(oversized);

  assert.equal(result.rows.length, 0);
  assert.ok(result.errors.some((error) => error.includes("64 KiB")));
});

test("CSV product import supports BOM, quoted commas and quoted newlines", () => {
  const csv = `\uFEFFname,slug,sku,category_slug,short_description,description,image_url,lead_time_days\n"Bột, yến mạch",bot-yen-mach,OAT-001,bot-dinh-duong,"Ngắn","Dòng một\nDòng hai",,14`;
  const result = parseProductImportCsv(csv);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.headers, [...ADMIN_PRODUCT_IMPORT_HEADERS]);
  assert.equal(result.rows[0]?.name, "Bột, yến mạch");
  assert.equal(result.rows[0]?.description, "Dòng một\nDòng hai");
});

test("CSV product import accepts optional columns when required identity columns exist", () => {
  const result = parseProductImportCsv("name,slug,sku\nA,a,A-1");

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.rows[0], {
    categorySlug: "",
    description: "",
    imageUrl: "",
    leadTimeDays: "",
    name: "A",
    shortDescription: "",
    sku: "A-1",
    slug: "a",
  });
});

test("CSV product import rejects empty files and unknown columns", () => {
  assert.deepEqual(parseProductImportCsv("").errors, ["File chưa có dòng sản phẩm nào để nhập."]);
  const result = parseProductImportCsv("name,slug,sku,unexpected\nA,a,A-1,x");

  assert.equal(result.rows.length, 0);
  assert.ok(result.errors.some((error) => error.includes("unexpected")));
});

test("product import preparation maps categories and always creates inactive drafts", () => {
  const result = prepareAdminProductImportRows(validRows, categories);

  assert.deepEqual(result.errors, []);
  assert.equal(result.entries.length, 2);
  assert.deepEqual(result.entries[0]?.input, {
    categoryId: 3,
    description: "Mô tả chi tiết",
    imageUrl: null,
    isActive: false,
    leadTimeDays: 14,
    name: "Bột yến mạch",
    shortDescription: "Mô tả ngắn",
    sku: "OAT-001",
    slug: "bot-yen-mach",
    status: "draft",
  });
});

test("product import reports row-level validation, duplicates and missing categories", () => {
  const result = prepareAdminProductImportRows([
    ...validRows,
    { ...validRows[0]!, name: "", sku: "JUICE-001", slug: "bot-yen-mach" },
    { ...validRows[1]!, sku: "juice-001", slug: "nuoc-khac" },
    { ...validRows[1]!, categorySlug: "missing-category", sku: "JUICE-003", slug: "nuoc-thu-ba" },
  ], categories);

  assert.equal(result.entries.length, 3);
  assert.ok(result.errors.some((error) => error.row === 4 && error.field === "name"));
  assert.ok(result.errors.some((error) => error.row === 4 && error.field === "slug"));
  assert.ok(result.errors.some((error) => error.row === 4 && error.field === "sku"));
  assert.ok(result.errors.some((error) => error.row === 6 && error.field === "category_slug"));
});

test("product import caps rows before D1 work starts and uses the contract body limit", () => {
  const rows = Array.from({ length: MAX_ADMIN_PRODUCT_IMPORT_ROWS + 1 }, (_, index) => ({
    ...validRows[0]!,
    name: `Sản phẩm ${index}`,
    slug: `san-pham-${index}`,
    sku: `SKU-${index}`,
  }));
  const result = prepareAdminProductImportRows(rows, categories);

  assert.equal(result.entries.length, 0);
  assert.ok(result.errors.some((error) => error.field === "rows"));
  assert.equal(MAX_ADMIN_PRODUCT_IMPORT_BYTES, 64 * 1024);
});

test("request id accepts a stable UUID header and rejects missing or conflicting values", () => {
  assert.equal(
    resolveAdminProductImportRequestId(new Headers({ "Idempotency-Key": ` ${REQUEST_ID.toUpperCase()} ` })),
    REQUEST_ID,
  );
  assert.equal(resolveAdminProductImportRequestId(new Headers()), null);
  assert.equal(
    resolveAdminProductImportRequestId(new Headers({ "Idempotency-Key": REQUEST_ID, "X-Request-Id": "not-a-uuid" })),
    null,
  );
});

test("actual streamed request bytes are bounded before JSON parsing", async () => {
  const oversized = new TextEncoder().encode("x".repeat(65));
  const request = {
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(oversized);
        controller.close();
      },
    }),
  } as Request;

  const result = await readJsonBodyWithinLimit(request, 64);
  assert.deepEqual(result, { ok: false, reason: "payload_too_large" });
});

test("canonical import fingerprint is deterministic and changes with accepted data", async () => {
  const entries = prepareAdminProductImportRows(validRows, categories).entries;
  const first = await fingerprintAdminProductImport(entries);
  const second = await fingerprintAdminProductImport(entries);
  const changed = await fingerprintAdminProductImport([
    { ...entries[0]!, input: { ...entries[0]!.input, name: "Tên khác" } },
    entries[1]!,
  ]);

  assert.match(first, /^[0-9a-f]{64}$/);
  assert.equal(first, second);
  assert.notEqual(first, changed);
});

test("raw retry fingerprint stays stable when category lookup changes after the first write", async () => {
  const first = await fingerprintAdminProductImportRows(validRows);
  const retry = await fingerprintAdminProductImportRows(validRows.map((row) => ({ ...row })));
  const changed = await fingerprintAdminProductImportRows([
    { ...validRows[0]!, categorySlug: "inactive-category" },
    validRows[1]!,
  ]);

  assert.equal(first, retry);
  assert.notEqual(first, changed);
});

test("bulk product create, meta and per-item audit use one D1 batch", async () => {
  const database = new FakeBatchDatabase();
  const entries = prepareAdminProductImportRows(validRows, categories).entries;
  const result = await createAdminProductsAtomically(database, entries, "actor@example.com", REQUEST_ID, FINGERPRINT);

  assert.deepEqual(result, [101, 102]);
  assert.equal(database.statements.filter((statement) => /INSERT INTO products/.test(statement.query)).length, 1);
  assert.equal(database.statements.filter((statement) => /INSERT INTO product_admin_meta/.test(statement.query)).length, 1);
  assert.equal(database.statements.filter((statement) => /INSERT INTO admin_audit_log/.test(statement.query)).length, 1);
  assert.equal(database.statements.filter((statement) => /product\.bulk_created/.test(statement.query)).length, 1);
  assert.match(database.statements.find((statement) => /INSERT INTO admin_audit_log/.test(statement.query))!.query, /NULL, 1, \?/);
  assert.ok(database.statements.every((statement) => statement.runCalls === 0));
});

test("bulk writer covers zero, one and maximum row counts within the D1 bind cap", async () => {
  const emptyDatabase = new FakeBatchDatabase();
  await assert.rejects(() => createAdminProductsAtomically(emptyDatabase, [], "actor@example.com", REQUEST_ID, FINGERPRINT));
  assert.equal(emptyDatabase.batchCalls, 0);

  const oneDatabase = new FakeBatchDatabase();
  const oneEntries = prepareAdminProductImportRows([validRows[0]!], categories).entries;
  assert.deepEqual(
    await createAdminProductsAtomically(oneDatabase, oneEntries, "actor@example.com", REQUEST_ID, FINGERPRINT),
    [101],
  );

  const maxRows = Array.from({ length: MAX_ADMIN_PRODUCT_IMPORT_ROWS }, (_, index) => ({
    ...validRows[0]!,
    name: `Sản phẩm ${index}`,
    slug: `san-pham-${index}`,
    sku: `SKU-${index}`,
  }));
  const maxEntries = prepareAdminProductImportRows(maxRows, categories).entries;
  assert.equal(maxEntries.length, MAX_ADMIN_PRODUCT_IMPORT_ROWS);
  const maxDatabase = new FakeBatchDatabase();
  const productIds = await createAdminProductsAtomically(
    maxDatabase,
    maxEntries,
    "actor@example.com",
    REQUEST_ID,
    FINGERPRINT,
  );

  assert.equal(productIds.length, MAX_ADMIN_PRODUCT_IMPORT_ROWS);
  assert.equal(maxDatabase.statements.length, ADMIN_PRODUCT_IMPORT_BATCH_STATEMENTS);
  assert.deepEqual(maxDatabase.statements.map((statement) => statement.values.length), [
    ADMIN_PRODUCT_IMPORT_MARKER_BIND_COUNT,
    98,
    56,
    56,
    98,
    56,
    56,
    98,
    56,
    56,
    56,
    32,
    32,
  ]);
  assert.ok(maxDatabase.statements.every((statement) => statement.values.length <= MAX_ADMIN_PRODUCT_IMPORT_BIND_VARIABLES));
});

test("D1 batch is all-or-none when a later product violates a constraint", async () => {
  const database = createSqliteD1Database();
  try {
    database.sqlite.prepare(`
      INSERT INTO products (
        name, slug, sku, short_description, description, image_url, category_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run("Existing", "existing-slug", "DUP-SKU", "", "", null, null, 0);

    const entries = prepareAdminProductImportRows([
      { ...validRows[0]!, slug: "new-slug", sku: "NEW-SKU" },
      { ...validRows[1]!, slug: "duplicate-slug", sku: "DUP-SKU" },
    ], categories).entries;

    await assert.rejects(() => createAdminProductsAtomically(
      database,
      entries,
      "actor@example.com",
      REQUEST_ID,
      FINGERPRINT,
    ));
    assert.equal(sqliteCount(database, "products"), 1);
    assert.equal(sqliteCount(database, "product_admin_meta"), 0);
    assert.equal(sqliteCount(database, "admin_audit_log"), 0);
    assert.equal(sqliteCount(database, "audit_logs"), 0);
  } finally {
    database.sqlite.close();
  }
});

test("an idempotent retry reads the original audit result without writing", async () => {
  const database = new ReplayDatabase();
  const replay = await findAdminProductImportReplay(database, REQUEST_ID);

  assert.deepEqual(replay, { payloadSha256: FINGERPRINT, productIds: [101, 102] });
  const auditLookup = database.statements.find((statement) => statement.kind === "audit");
  assert.ok(auditLookup);
  assert.doesNotMatch(auditLookup.query, /LIKE/i);
  assert.match(auditLookup.query, /id IN \(\?,/);
  assert.deepEqual(auditLookup.values, Array.from(
    { length: MAX_ADMIN_PRODUCT_IMPORT_ROWS },
    (_, index) => adminProductImportAuditId(REQUEST_ID, index),
  ));
  assert.ok(auditLookup.values.every((value) => typeof value === "string"));
  assert.equal(isAdminProductImportReplay(FINGERPRINT, FINGERPRINT), true);
  assert.equal(isAdminProductImportReplay(FINGERPRINT, "b".repeat(64)), false);
});

test("a request ID owned by another mutation is not treated as an import replay", async () => {
  const database = new ReplayDatabase({
    action: "update",
    entityKey: "42",
    entityType: "product",
  });

  await assert.rejects(
    () => findAdminProductImportReplay(database, REQUEST_ID),
    AdminProductImportIdempotencyConflictError,
  );
});

test("catalog import uses the canonical matrix and does not grant content_manager catalog.write", () => {
  assert.equal(canManageCatalog("owner"), true);
  assert.equal(canManageCatalog("catalog_manager"), true);
  assert.equal(canManageCatalog("content_manager"), false);
  assert.equal(canManageCatalog("viewer"), false);
});

test("bulk product route is protected, bounded, idempotent and atomic", async () => {
  const route = await readFile(path.join(import.meta.dirname, "../src/app/api/admin/products/import/route.ts"), "utf8");

  assert.match(route, /requireAdmin\(request\)/);
  assert.match(route, /canManageCatalog\(guard\.member\.role\)/);
  assert.doesNotMatch(route, /role === ["']content_manager/);
  assert.match(route, /readJsonBodyWithinLimit/);
  assert.match(route, /Idempotency-Key/);
  assert.match(route, /findAdminProductImportReplay/);
  assert.match(route, /createAdminProductsAtomically/);
  assert.match(route, /fingerprintAdminProductImportRows/);
  assert.match(route, /Object\.keys\(body\.value\)/);
  assert.doesNotMatch(route, /parseProductImportCsv/);
  assert.doesNotMatch(route, /value\.csv/);
  assert.match(route, /isUniqueConstraintError\(error\)/);
  assert.match(route, /isAdminProductImportReplay/);
  assert.doesNotMatch(route, /function isUniqueError/);
  assert.match(route, /IDEMPOTENCY_CONFLICT/);
  assert.match(route, /PAYLOAD_TOO_LARGE/);
  assert.match(route, /UNSUPPORTED_MEDIA/);
  assert.ok(route.indexOf("fingerprintAdminProductImportRows") < route.indexOf("categories = await listAdminCategories"));
});

function createSqliteD1Database(): SqliteD1Database {
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
      revision INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE product_admin_meta (
      product_id INTEGER PRIMARY KEY,
      status TEXT NOT NULL,
      lead_time_days INTEGER,
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
  return new SqliteD1Database(sqlite);
}

function sqliteCount(
  database: SqliteD1Database,
  table: "admin_audit_log" | "audit_logs" | "product_admin_meta" | "products",
): number {
  const row = database.sqlite.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
  return row.count;
}
