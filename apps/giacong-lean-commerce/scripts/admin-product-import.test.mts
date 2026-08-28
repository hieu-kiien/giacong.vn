import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { canManageCatalog } from "../src/lib/admin-permissions.ts";
import {
  ADMIN_PRODUCT_IMPORT_HEADERS,
  MAX_ADMIN_PRODUCT_IMPORT_BYTES,
  MAX_ADMIN_PRODUCT_IMPORT_ROWS,
  fingerprintAdminProductImport,
  parseProductImportCsv,
  prepareAdminProductImportRows,
  type AdminProductImportRow,
} from "../src/lib/admin-product-import.ts";
import {
  createAdminProductsAtomically,
  findAdminProductImportReplay,
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

  prepare(query: string) {
    const statement = new FakeStatement(query);
    this.statements.push(statement);
    return statement;
  }

  async batch(statements: FakeStatement[]) {
    assert.equal(statements.length, 4);
    return statements.map((statement) => {
      if (/INSERT INTO products/.test(statement.query)) {
        return { results: [{ id: 101, slug: "bot-yen-mach" }, { id: 102, slug: "nuoc-trai-cay" }] };
      }
      if (/INSERT INTO product_admin_meta|product\.bulk_created/.test(statement.query)) {
        return { results: [{ ok: 1 }, { ok: 1 }] };
      }
      return { results: [{ ok: 1 }] };
    });
  }
}

class ReplayStatement extends FakeStatement {
  private readonly kind: "marker" | "audit";

  constructor(query: string, kind: "marker" | "audit") {
    super(query);
    this.kind = kind;
  }

  override async first<T>() {
    return (this.kind === "marker"
      ? { request_id: REQUEST_ID, payload_sha256: FINGERPRINT }
      : null) as T | null;
  }

  override async all<T>() {
    return (this.kind === "audit"
      ? { results: [{ entity_id: "101" }, { entity_id: "102" }] }
      : { results: [] }) as { results: T[] };
  }
}

class ReplayDatabase {
  prepare(query: string) {
    return new ReplayStatement(query, /admin_audit_log/.test(query) ? "marker" : "audit");
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

test("bulk product create, meta and per-item audit use one D1 batch", async () => {
  const database = new FakeBatchDatabase();
  const entries = prepareAdminProductImportRows(validRows, categories).entries;
  const result = await createAdminProductsAtomically(database, entries, "actor@example.com", REQUEST_ID, FINGERPRINT);

  assert.deepEqual(result, [101, 102]);
  assert.equal(database.statements.filter((statement) => /INSERT INTO products/.test(statement.query)).length, 1);
  assert.equal(database.statements.filter((statement) => /INSERT INTO product_admin_meta/.test(statement.query)).length, 1);
  assert.equal(database.statements.filter((statement) => /INSERT INTO admin_audit_log/.test(statement.query)).length, 1);
  assert.equal(database.statements.filter((statement) => /product\.bulk_created/.test(statement.query)).length, 1);
  assert.ok(database.statements.every((statement) => statement.runCalls === 0));
});

test("an idempotent retry reads the original audit result without writing", async () => {
  const replay = await findAdminProductImportReplay(new ReplayDatabase(), REQUEST_ID);

  assert.deepEqual(replay, { payloadSha256: FINGERPRINT, productIds: [101, 102] });
});

test("catalog import uses the canonical matrix and does not grant content_manager catalog.write", () => {
  assert.equal(canManageCatalog("catalog_manager"), true);
  assert.equal(canManageCatalog("content_manager"), false);
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
  assert.match(route, /IDEMPOTENCY_CONFLICT/);
  assert.match(route, /PAYLOAD_TOO_LARGE/);
  assert.match(route, /UNSUPPORTED_MEDIA/);
});
