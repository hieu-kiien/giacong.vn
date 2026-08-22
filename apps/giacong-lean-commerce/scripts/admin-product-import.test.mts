import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  ADMIN_PRODUCT_IMPORT_HEADERS,
  MAX_ADMIN_PRODUCT_IMPORT_ROWS,
  findAdminProductImportConflicts,
  parseProductImportCsv,
  prepareAdminProductImportRows,
  type AdminProductImportRow,
} from "../src/lib/admin-product-import.ts";
import { createAdminProductsAtomically } from "../src/lib/admin-product-write.ts";
import { slugifyProductName } from "../src/lib/slugify-product.ts";

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
  readonly batches: FakeStatement[][] = [];

  prepare(query: string) {
    return new FakeStatement(query);
  }

  async batch(statements: FakeStatement[]) {
    this.batches.push([...statements]);
    return statements.map((_, index) => ({
      results: index % 3 === 0 ? [{ id: 100 + index / 3 }] : [],
    }));
  }
}

class FakeConflictStatement {
  readonly query: string;
  values: unknown[] = [];

  constructor(query: string) {
    this.query = query.replace(/\s+/g, " ").trim();
  }

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async all<T>() {
    return { results: [{ slug: "existing-slug", sku: "EXISTING-001" }] as T[] };
  }

  async first<T>() {
    return null as T | null;
  }

  async run() {
    return {};
  }
}

class FakeConflictDatabase {
  statement: FakeConflictStatement | null = null;

  prepare(query: string) {
    this.statement = new FakeConflictStatement(query);
    return this.statement;
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

test("CSV product import supports BOM, quoted commas and quoted newlines", () => {
  const csv = `\uFEFFname,slug,sku,category_slug,short_description,description,image_url,lead_time_days\n"Bột, yến mạch",bot-yen-mach,OAT-001,bot-dinh-duong,"Ngắn","Dòng một\nDòng hai",,14`;
  const result = parseProductImportCsv(csv);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.headers, [...ADMIN_PRODUCT_IMPORT_HEADERS]);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.name, "Bột, yến mạch");
  assert.equal(result.rows[0]?.description, "Dòng một\nDòng hai");
});

test("CSV product import rejects an empty file", () => {
  const result = parseProductImportCsv("");

  assert.deepEqual(result.rows, []);
  assert.deepEqual(result.errors, ["File chưa có dòng sản phẩm nào để nhập."]);
});

test("single product editor derives a stable ASCII slug from the product name", () => {
  assert.equal(slugifyProductName("Bột yến mạch ít đường 500g"), "bot-yen-mach-it-duong-500g");
  assert.equal(slugifyProductName("  Nước — trái cây  "), "nuoc-trai-cay");
});

test("CSV product import rejects missing and unknown columns", () => {
  const result = parseProductImportCsv("name,slug,sku,unexpected\nA,a,A-1,x");

  assert.equal(result.rows.length, 0);
  assert.ok(result.errors.some((error) => error.includes("unexpected")));
  assert.ok(result.errors.some((error) => error.includes("category_slug")));
});

test("product import preparation maps category slug and always creates inactive drafts", () => {
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

test("product import reports row-level validation and duplicate errors", () => {
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

test("product import caps a file before D1 work starts", () => {
  const rows = Array.from({ length: MAX_ADMIN_PRODUCT_IMPORT_ROWS + 1 }, (_, index) => ({
    ...validRows[0]!,
    name: `Sản phẩm ${index}`,
    slug: `san-pham-${index}`,
    sku: `SKU-${index}`,
  }));
  const result = prepareAdminProductImportRows(rows, categories);

  assert.equal(result.entries.length, 0);
  assert.ok(result.errors.some((error) => error.field === "rows"));
});

test("bulk product create, meta and audit are committed in one D1 batch", async () => {
  const database = new FakeBatchDatabase();
  const result = await createAdminProductsAtomically(
    database,
    [
      { input: { ...prepareAdminProductImportRows(validRows, categories).entries[0]!.input, status: "draft" }, rowNumber: 2 },
      { input: { ...prepareAdminProductImportRows(validRows, categories).entries[1]!.input, status: "draft" }, rowNumber: 3 },
    ],
    "actor@example.com",
  );

  assert.deepEqual(result, [100, 101]);
  assert.equal(database.batches.length, 1);
  const batch = database.batches[0] ?? [];
  assert.equal(batch.length, 6);
  assert.equal(batch.filter((statement) => /INSERT INTO products/.test(statement.query)).length, 2);
  assert.equal(batch.filter((statement) => /INSERT INTO product_admin_meta/.test(statement.query)).length, 2);
  assert.equal(batch.filter((statement) => /INSERT INTO audit_logs/.test(statement.query)).length, 2);
  assert.ok(batch.every((statement) => statement.runCalls === 0));
});

test("product import checks existing slug and SKU conflicts with bound values", async () => {
  const database = new FakeConflictDatabase();
  const entries = [{
    input: { ...prepareAdminProductImportRows(validRows, categories).entries[0]!.input },
    rowNumber: 2,
  }];
  entries[0]!.input.slug = "existing-slug";

  const errors = await findAdminProductImportConflicts(database, entries);

  assert.deepEqual(errors, [{ field: "slug", message: "Slug đã tồn tại trong catalog.", row: 2 }]);
  assert.match(database.statement?.query ?? "", /lower\(slug\) IN/);
  assert.ok(database.statement?.values.includes("existing-slug"));
});

test("bulk product route remains protected, role-gated and atomic", async () => {
  const route = await readFile(path.join(import.meta.dirname, "../src/app/api/admin/products/import/route.ts"), "utf8");

  assert.match(route, /requireAdmin\(request\)/);
  assert.match(route, /canManageCatalog\(guard\.member\.role\)/);
  assert.match(route, /prepareAdminProductImportRows/);
  assert.match(route, /findAdminProductImportConflicts/);
  assert.match(route, /createAdminProductsAtomically/);
  assert.match(route, /PAYLOAD_TOO_LARGE/);
  assert.doesNotMatch(route, /createAdminProductAtomically\(/);
});
