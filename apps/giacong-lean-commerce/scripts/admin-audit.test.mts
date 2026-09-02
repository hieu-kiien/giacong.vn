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
    "admin_site_page_audit",
    "admin_navigation_audit",
    "admin_navigation_bulk_audit",
    "admin_navigation_create_audit",
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

  private assertD1CompoundSelectLimit(): void {
    const unionCountsByQuery = new Map<number, number>();
    const openings: number[] = [];
    for (let index = 0; index < this.query.length; index += 1) {
      const character = this.query[index];
      if (character === "(") openings.push(index);
      if (character === ")") openings.pop();
      if (this.query.slice(index, index + 9) === "UNION ALL") {
        const queryStart = openings.at(-1) ?? -1;
        unionCountsByQuery.set(queryStart, (unionCountsByQuery.get(queryStart) ?? 0) + 1);
      }
    }
    if ([...unionCountsByQuery.values()].some((unionCount) => unionCount + 1 > 5)) {
      throw new Error("too many terms in compound SELECT");
    }
  }

  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    this.assertD1CompoundSelectLimit();
    if (this.query.includes("sqlite_master")) {
      const tableName = String(this.values[0]);
      return (this.database.tables.has(tableName) ? { name: tableName } : null) as T | null;
    }
    if (this.query.includes("COUNT(*)")) return { count: this.query.includes("admin_site_page_audit") ? 6 : this.query.includes("admin_navigation_create_audit") ? 5 : this.query.includes("admin_navigation_audit") || this.query.includes("admin_navigation_bulk_audit") ? 4 : 2 } as T;
    return null;
  }

  async all<T>(): Promise<{ results: T[] }> {
    this.assertD1CompoundSelectLimit();
    if (!this.query.includes("FROM (")) return { results: [] };
    return {
      results: [
        ...(this.query.includes("admin_site_page_audit") ? [
          {
            action: "update",
            actor_subject: "owner@example.com",
            created_at: "2026-08-29T17:00:00.000Z",
            entity_key: "home",
            entity_type: "page",
            operation: "publish",
            previous_revision: 2,
            request_id: "66666666-6666-4666-8666-666666666666",
            resulting_revision: 3,
            source: "admin_site_page_audit",
            source_id: "14",
          },
        ] : []),
        ...(this.query.includes("admin_navigation_create_audit") ? [
          {
            action: "create",
            actor_subject: "owner@example.com",
            created_at: "2026-08-29T16:00:00.000Z",
            entity_key: "custom-contact",
            entity_type: "site_navigation",
            operation: "create",
            previous_revision: 0,
            request_id: "55555555-5555-4555-8555-555555555555",
            resulting_revision: 1,
            source: "admin_navigation_create_audit",
            source_id: "13",
          },
        ] : []),
        ...(this.query.includes("admin_navigation_audit") ? [
          {
            action: "update",
            actor_subject: "owner@example.com",
            created_at: "2026-08-29T15:00:00.000Z",
            entity_key: "home",
            entity_type: "site_navigation",
            operation: "publish",
            previous_revision: 1,
            request_id: "33333333-3333-4333-8333-333333333333",
            resulting_revision: 2,
            source: "admin_navigation_audit",
            source_id: "11",
          },
        ] : []),
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
        ...(this.query.includes("admin_navigation_bulk_audit") ? [
          {
            action: "update",
            actor_subject: "owner@example.com",
            created_at: "2026-08-29T12:00:00.000Z",
            entity_key: "bulk:publish_all",
            entity_type: "site_navigation",
            operation: "publish_all",
            previous_revision: null,
            request_id: "44444444-4444-4444-8444-444444444444",
            resulting_revision: null,
            source: "admin_navigation_bulk_audit",
            source_id: "12",
          },
        ] : []),
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
  assert.ok(ADMIN_AUDIT_ENTITY_TYPES.includes("site_navigation"));
});

test("audit reader merges all available tables without exceeding D1 compound SELECT limits", async () => {
  const result = await listAdminAudit(new FakeAuditDatabase(), {
    entityType: undefined,
    page: 1,
    pageSize: 20,
    search: "",
  });

  assert.equal(result.total, 6);
  assert.deepEqual(result.pagination, { currentPage: 1, lastPage: 1, pageSize: 20, total: 6 });
  assert.deepEqual(result.entries, [
    {
      action: "update",
      actorSubject: "owner@example.com",
      createdAt: "2026-08-29T17:00:00.000Z",
      entityKey: "home",
      entityType: "page",
      operation: "publish",
      previousRevision: 2,
      requestId: "66666666-6666-4666-8666-666666666666",
      resultingRevision: 3,
      source: "admin_site_page_audit",
    },
    {
      action: "create",
      actorSubject: "owner@example.com",
      createdAt: "2026-08-29T16:00:00.000Z",
      entityKey: "custom-contact",
      entityType: "site_navigation",
      operation: "create",
      previousRevision: 0,
      requestId: "55555555-5555-4555-8555-555555555555",
      resultingRevision: 1,
      source: "admin_navigation_create_audit",
    },
    {
      action: "update",
      actorSubject: "owner@example.com",
      createdAt: "2026-08-29T15:00:00.000Z",
      entityKey: "home",
      entityType: "site_navigation",
      operation: "publish",
      previousRevision: 1,
      requestId: "33333333-3333-4333-8333-333333333333",
      resultingRevision: 2,
      source: "admin_navigation_audit",
    },
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
    {
      action: "update",
      actorSubject: "owner@example.com",
      createdAt: "2026-08-29T12:00:00.000Z",
      entityKey: "bulk:publish_all",
      entityType: "site_navigation",
      operation: "publish_all",
      previousRevision: null,
      requestId: "44444444-4444-4444-8444-444444444444",
      resultingRevision: null,
      source: "admin_navigation_bulk_audit",
    },
  ] satisfies AdminAuditEntry[]);
  assert.equal("metadataJson" in result.entries[0], false);
});

test("audit reader skips an absent specialized table without failing", async () => {
  const database = new FakeAuditDatabase();
  database.tables.delete("admin_news_audit");
  const result = await listAdminAudit(database, { page: 1, pageSize: 20, search: "" });
  assert.equal(result.entries.length, 6);
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
  assert.match(page, /site_navigation/);
  assert.match(page, /\/api\/admin\/audit/);
  assert.match(page, /aria-live="polite"/);
});
