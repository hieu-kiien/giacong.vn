import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { getAdminCustomerDetail } from "../src/lib/admin-customers.ts";
import { getCustomerSalesForExport } from "../src/lib/admin-customer-sales-export.ts";
import type { D1DatabaseLike } from "../src/lib/admin-data.ts";

function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  const parameterCounts: number[] = [];
  sqlite.exec(`CREATE TABLE "user" (id TEXT, name TEXT, email TEXT, username TEXT, createdAt TEXT);
    CREATE TABLE zalo_sales (id TEXT, customer_id TEXT, sale_code TEXT, confirmed_at TEXT, total_amount INTEGER);
    INSERT INTO "user" VALUES ('u1', 'Khách A', 'a@example.test', NULL, '2026-10-05');`);
  const insert = sqlite.prepare("INSERT INTO zalo_sales VALUES (?, ?, ?, ?, ?)");
  for (let index = 0; index < 21; index++) insert.run(`s${index}`, "u1", `GD-${index}`, `2026-10-${String(index + 1).padStart(2, "0")}`, 100);
  insert.run("foreign", "u2", "PRIVATE", "2026-10-30", 999);
  const database: D1DatabaseLike = { prepare(sql) {
    let values: SQLInputValue[] = [];
    return {
      bind(...params: unknown[]) { values = params as SQLInputValue[]; parameterCounts.push(params.length); return this; },
      async first<T>() { return (sqlite.prepare(sql).get(...values) as T | undefined) ?? null; },
      async all<T>() { return { results: sqlite.prepare(sql).all(...values) as T[] }; },
      async run() { return sqlite.prepare(sql).run(...values); },
    };
  } };
  return { database, sqlite, parameterCounts };
}

test("confirmed customer history can reach records beyond the first 20", async () => {
  const { database, sqlite } = fixture();
  try {
    const customer = await getAdminCustomerDetail(database, "u1", 2);
    assert.equal(customer?.saleCount, 21);
    assert.equal(customer?.sales.length, 1);
    assert.equal(customer?.sales[0].saleCode, "GD-0");
    assert.equal(customer?.salesPagination.currentPage, 2);
    assert.equal(customer?.salesPagination.lastPage, 2);
  } finally { sqlite.close(); }
});

test("Excel sale export includes all selected-customer history, excludes other customers and respects D1 binding limits", async () => {
  const { database, sqlite, parameterCounts } = fixture();
  try {
    const ids = ["u1", ...Array.from({ length: 190 }, (_, index) => `absent-${index}`)];
    const result = await getCustomerSalesForExport(database, ids);
    assert.equal(result.overflow, false);
    assert.equal(result.sales.length, 21);
    assert.ok(result.sales.every((sale) => sale.customerId === "u1"));
    assert.ok(parameterCounts.every((count) => count <= 100));
  } finally { sqlite.close(); }
});
