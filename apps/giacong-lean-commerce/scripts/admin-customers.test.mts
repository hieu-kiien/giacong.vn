import assert from "node:assert/strict";
import test from "node:test";

import { buildCustomerExportCsv } from "../src/lib/admin-customer-export.ts";
import { getAdminCustomerDetail, listAdminCustomers } from "../src/lib/admin-customers.ts";

type Handler = (sql: string, params: unknown[]) => unknown;

function database(tables: string[], handler: Handler) {
  const statements: Array<{ params: unknown[]; sql: string }> = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          statements.push({ params, sql });
          return {
            all: async () => ({ results: (handler(sql, params) as unknown[]) ?? [] }),
            first: async () => {
              if (sql.includes("sqlite_master")) return tables.includes(String(params[0])) ? { name: params[0] } : null;
              return handler(sql, params);
            },
            run: async () => ({}),
          };
        },
      };
    },
  };
  return { db: db as never, statements };
}

test("listAdminCustomers reports not ready when the auth user table is missing", async () => {
  const { db } = database([], () => null);
  assert.deepEqual(await listAdminCustomers(db, { page: 1, pageSize: 20 }), { customers: [], ready: false, total: 0 });
});

test("listAdminCustomers binds search text, paginates and maps counters", async () => {
  const { db, statements } = database(["user", "leads", "zalo_sales"], (sql) => {
    if (sql.includes("COUNT(*) AS total")) return { total: 41 };
    return [{
      created_at: "2026-09-01T00:00:00Z",
      email: "lan@example.test",
      id: "u1",
      last_request_at: "2026-09-20T00:00:00Z",
      name: "Lan",
      phone: "0912345678",
      request_count: "3",
      sale_count: 1,
      sale_total: 450000,
      username: null,
    }];
  });
  const result = await listAdminCustomers(db, { page: 2, pageSize: 20, query: "50%_off" });
  assert.equal(result.total, 41);
  assert.equal(result.customers[0]!.requestCount, 3);
  assert.equal(result.customers[0]!.saleTotal, 450000);
  const list = statements.find((statement) => statement.sql.includes("LIMIT ? OFFSET ?"))!;
  assert.ok(list.params.includes("%50\\%\\_off%"), "LIKE wildcards are escaped and bound, not interpolated");
  assert.deepEqual(list.params.slice(-2), [20, 20]);
  assert.doesNotMatch(list.sql, /50%/);
});

test("getAdminCustomerDetail returns null for unknown ids and lists requests with items and sales", async () => {
  const missing = database(["user", "leads"], () => null);
  assert.equal(await getAdminCustomerDetail(missing.db, "nope"), null);

  const { db } = database(["user", "leads", "lead_items", "zalo_sales"], (sql) => {
    if (sql.includes('FROM "user" u')) {
      return { created_at: "2026-09-01", email: "a@b.c", id: "u1", last_request_at: null, name: "A", phone: null, request_count: 1, sale_count: 1, sale_total: 10, username: "a" };
    }
    if (sql.includes("FROM leads")) return [{ created_at: "2026-09-20", id: "lead-1", status: "new" }];
    if (sql.includes("FROM lead_items")) return [{ lead_id: "lead-1", product_name: "Bột", quantity: 3, variant_name: "500g" }];
    if (sql.includes("FROM zalo_sales")) return [{ confirmed_at: "2026-09-21", id: "s1", sale_code: "ZS-1", total_amount: 10 }];
    return null;
  });
  const detail = await getAdminCustomerDetail(db, "u1");
  assert.ok(detail);
  assert.deepEqual(detail.requests[0]!.items, ["Bột · 500g × 3"]);
  assert.equal(detail.sales[0]!.saleCode, "ZS-1");
});

test("customer CSV export is Excel friendly and guards formulas", () => {
  const csv = buildCustomerExportCsv([{
    createdAt: "2026-09-01",
    email: "lan@example.test",
    id: "u1",
    lastRequestAt: null,
    name: "=cmd|calc",
    phone: "+84 912 345 678",
    requestCount: 2,
    saleCount: 0,
    saleTotal: 0,
    username: null,
  }]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const [header, row] = csv.slice(1).split("\r\n");
  assert.ok(header!.startsWith("ho_ten,email,"));
  assert.ok(row!.startsWith("'=cmd|calc,lan@example.test,,+84 912 345 678,2,"));
});
