import assert from "node:assert/strict";
import test from "node:test";

import {
  listAdminProducts,
  parseAdminProductCategoryFilter,
  parseAdminProductSort,
} from "../src/lib/admin-data.ts";
import {
  ADMIN_PRODUCT_EXPORT_HEADERS,
  buildProductExportCsv,
  escapeCsvCell,
  type AdminProductExportInput,
} from "../src/lib/admin-product-export.ts";
import { parseProductImportCsv } from "../src/lib/admin-product-import-csv.ts";

function recordingDatabase() {
  const statements: Array<{ params: unknown[]; sql: string }> = [];
  const database = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          statements.push({ params, sql });
          return {
            all: async () => ({ results: [] }),
            first: async () => (sql.includes("sqlite_master") ? { name: params[0] } : { total: 0 }),
            run: async () => ({}),
          };
        },
      };
    },
  };
  return { database: database as never, statements };
}

function listStatement(statements: Array<{ params: unknown[]; sql: string }>) {
  return statements.find((statement) => statement.sql.includes("LIMIT ? OFFSET ?"))!;
}

const sample: AdminProductExportInput = {
  categorySlug: "bot-ngu-coc",
  description: 'Dòng 1\nDòng 2 có "ngoặc kép", dấu phẩy',
  imageUrl: "/media/a.jpg",
  isActive: true,
  leadTimeDays: 3,
  name: "Bột ngũ cốc",
  shortDescription: "Gói 500g",
  sku: "BNC-500",
  slug: "bot-ngu-coc",
  startingPrice: 45000,
  status: "published",
  variantCount: 2,
};

test("sort and category filter parsers only accept whitelisted values", () => {
  assert.equal(parseAdminProductSort("price_asc"), "price_asc");
  assert.equal(parseAdminProductSort("id; DROP TABLE products"), "newest");
  assert.equal(parseAdminProductSort(null), "newest");
  assert.equal(parseAdminProductCategoryFilter("12"), 12);
  assert.equal(parseAdminProductCategoryFilter("none"), "none");
  assert.equal(parseAdminProductCategoryFilter("0"), undefined);
  assert.equal(parseAdminProductCategoryFilter("1 OR 1=1"), undefined);
  assert.equal(parseAdminProductCategoryFilter("-3"), undefined);
});

test("listAdminProducts applies category filter with a bound parameter and the chosen sort", async () => {
  const { database, statements } = recordingDatabase();
  await listAdminProducts(database, { categoryId: 7, page: 2, pageSize: 20, sort: "price_desc" });
  const statement = listStatement(statements);
  assert.match(statement.sql, /p\.category_id = \?/);
  assert.match(statement.sql, /IS NULL, \(SELECT MIN\(tp\.price\)[\s\S]*DESC, p\.id DESC/);
  assert.deepEqual(statement.params, [7, 20, 20]);
});

test("listAdminProducts supports uncategorised filter and name/updated/default order", async () => {
  const none = recordingDatabase();
  await listAdminProducts(none.database, { categoryId: "none", page: 1, pageSize: 20, sort: "name" });
  assert.match(listStatement(none.statements).sql, /p\.category_id IS NULL/);
  assert.match(listStatement(none.statements).sql, /ORDER BY p\.name COLLATE NOCASE ASC, p\.id DESC/);

  const updated = recordingDatabase();
  await listAdminProducts(updated.database, { page: 1, pageSize: 20, sort: "updated" });
  assert.match(listStatement(updated.statements).sql, /ORDER BY m\.updated_at IS NULL, m\.updated_at DESC, p\.id DESC/);

  const fallback = recordingDatabase();
  await listAdminProducts(fallback.database, { page: 1, pageSize: 20 });
  assert.match(listStatement(fallback.statements).sql, /ORDER BY p\.id DESC/);
});

test("export CSV starts with BOM, uses CRLF and keeps the import columns first", () => {
  const csv = buildProductExportCsv([sample]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.ok(csv.endsWith("\r\n"));
  const header = csv.slice(1).split("\r\n")[0];
  assert.equal(header, ADMIN_PRODUCT_EXPORT_HEADERS.join(","));
  assert.ok(header.startsWith("name,slug,sku,category_slug,short_description,description,image_url,lead_time_days,"));
});

test("export CSV escapes quotes, commas, newlines and neutralises spreadsheet formulas", () => {
  assert.equal(escapeCsvCell('a "b", c'), '"a ""b"", c"');
  assert.equal(escapeCsvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
  assert.equal(escapeCsvCell("+cmd|' /C calc'!A0"), "'+cmd|' /C calc'!A0");
  assert.equal(escapeCsvCell("+84 912 345 678"), "+84 912 345 678");
  assert.equal(escapeCsvCell(-5, { text: false }), "-5");
  assert.equal(escapeCsvCell(null), "");
});

test("an exported file can be imported again (read-only columns are ignored)", () => {
  const csv = buildProductExportCsv([
    sample,
    { ...sample, isActive: false, name: "=Tên lạ", slug: "ten-la", sku: "TL-1", status: "draft", variantCount: 0, startingPrice: null },
  ]);
  const result = parseProductImportCsv(csv);
  assert.deepEqual(result.errors, []);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0]!.name, "Bột ngũ cốc");
  assert.equal(result.rows[0]!.description, sample.description);
  assert.equal(result.rows[0]!.leadTimeDays, "3");
  assert.equal(result.rows[1]!.name, "=Tên lạ");
});

test("import still rejects genuinely unknown columns", () => {
  const result = parseProductImportCsv("name,slug,sku,variant_price\nA,a,A-1,100\n");
  assert.ok(result.errors.some((message) => message.includes("variant_price")));
});
