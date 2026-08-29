import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ADMIN_AUDIT_ENTITY_TYPES,
  MAX_ADMIN_AUDIT_PAGE_SIZE,
  listAdminAudit,
  parseAdminAuditQuery,
  type AdminAuditEntry,
} from "../src/lib/admin-audit.ts";
import type { D1DatabaseLike, D1PreparedStatementLike } from "../src/lib/admin-data.ts";

async function read(relativePath: string): Promise<string> {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

class FakeAuditDatabase implements D1DatabaseLike {
  readonly tables = new Set([
    "audit_logs",
    "admin_audit_log",
    "admin_news_audit",
    "admin_news_bulk_audit",
    "admin_site_setting_audit",
    "admin_site_setting_bulk_audit",
  ]);

  prepare(query: string): D1PreparedStatementLike {
    return new FakeAuditStatement(this, query);
  }
}

class FakeAuditStatement implements D1PreparedStatementLike {
  private readonly database: FakeAuditDatabase;
  private readonly query: string;
  private values: unknown[] = [];

  constructor(database: FakeAuditDatabase, query: string) {
    this.database = database;
    this.query = query;
  }

  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    if (this.query.includes("sqlite_master")) {
      const tableName = String(this.values[0]);
      return (this.database.tables.has(tableName) ? { name: tableName } : null) as T | null;
    }
    if (this.query.includes("COUNT(*)")) return { count: 2 } as T;
    return null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    if (!this.query.includes("FROM (")) return { results: [] };
    return {
      results: [
        {
          action: "update",
          actor_subject: "owner@example.com",
          created_at: "2026-08-29T14:00:00.000Z",
          entity_key: "home.hero.title",
          entity_type: "site_setting",
          operation: "draft",
          previous_revision: 2,
          request_id: "11111111-1111-4111-8111-111111111111",
          resulting_revision: 3,
          source: "admin_site_setting_audit",
          source_id: "7",
        },
        {
          action: "delete",
          actor_subject: "owner@example.com",
          created_at: "2026-08-29T13:00:00.000Z",
          entity_key: "bulk-product-archive:22222222-2222-4222-8222-222222222222",
          entity_type: "product",
          operation: null,
          previous_revision: null,
          request_id: "22222222-2222-4222-8222-222222222222",
          resulting_revision: null,
          source: "admin_audit_log",
          source_id: "9",
        },
      ] as T[],
    };
  }

  async run(): Promise<unknown> {
    return {};
  }
}

test("audit query parser is bounded and allowlisted", () => {
  assert.deepEqual(parseAdminAuditQuery(new URLSearchParams("page=2&pageSize=50&query= hero &entityType=product")), {
    entityType: "product",
    page: 2,
    pageSize: 50,
    search: "hero",
  });
  assert.equal(MAX_ADMIN_AUDIT_PAGE_SIZE, 50);
  assert.equal(parseAdminAuditQuery(new URLSearchParams("page=0")), null);
  assert.equal(parseAdminAuditQuery(new URLSearchParams("pageSize=51")), null);
  assert.equal(parseAdminAuditQuery(new URLSearchParams("entityType=unknown")), null);
  assert.equal(parseAdminAuditQuery(new URLSearchParams(`query=${"x".repeat(101)}`)), null);
  assert.ok(ADMIN_AUDIT_ENTITY_TYPES.includes("product"));
});

test("audit reader merges available tables into a bounded safe view", async () => {
  const result = await listAdminAudit(new FakeAuditDatabase(), {
    entityType: undefined,
    page: 1,
    pageSize: 20,
    search: "",
  });

  assert.equal(result.total, 2);
  assert.deepEqual(result.pagination, { currentPage: 1, lastPage: 1, pageSize: 20, total: 2 });
  assert.deepEqual(result.entries, [
    {
      action: "update",
      actorSubject: "owner@example.com",
      createdAt: "2026-08-29T14:00:00.000Z",
      entityKey: "home.hero.title",
      entityType: "site_setting",
      operation: "draft",
      previousRevision: 2,
      requestId: "11111111-1111-4111-8111-111111111111",
      resultingRevision: 3,
      source: "admin_site_setting_audit",
    },
    {
      action: "delete",
      actorSubject: "owner@example.com",
      createdAt: "2026-08-29T13:00:00.000Z",
      entityKey: "bulk-product-archive:22222222-2222-4222-8222-222222222222",
      entityType: "product",
      operation: null,
      previousRevision: null,
      requestId: "22222222-2222-4222-8222-222222222222",
      resultingRevision: null,
      source: "admin_audit_log",
    },
  ] satisfies AdminAuditEntry[]);
  assert.equal("metadataJson" in result.entries[0], false);
});

test("audit reader skips an absent specialized table without failing", async () => {
  const database = new FakeAuditDatabase();
  database.tables.delete("admin_news_audit");
  const result = await listAdminAudit(database, { page: 1, pageSize: 20, search: "" });
  assert.equal(result.entries.length, 2);
});

test("audit API is owner-only, read-only and bounded", async () => {
  const route = await read("src/app/api/admin/audit/route.ts");
  const page = await read("src/app/admin/audit/page.tsx");
  assert.match(route, /requireAdmin\(request\)/);
  assert.match(route, /guard\.member\.role !== "owner"/);
  assert.match(route, /parseAdminAuditQuery/);
  assert.match(route, /adminSuccess/);
  assert.doesNotMatch(route, /export async function POST/);
  assert.match(page, /Lịch sử thay đổi/);
  assert.match(page, /\/api\/admin\/audit/);
  assert.match(page, /aria-live="polite"/);
});
