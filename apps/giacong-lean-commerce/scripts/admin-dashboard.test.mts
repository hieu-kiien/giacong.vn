import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getAdminOverview } from "../src/lib/admin-data.ts";
import type { D1DatabaseLike, D1PreparedStatementLike } from "../src/lib/admin-data.ts";

class OverviewStatement implements D1PreparedStatementLike {
  private values: unknown[] = [];
  private readonly database: OverviewDatabase;
  private readonly query: string;

  constructor(database: OverviewDatabase, query: string) {
    this.database = database;
    this.query = query;
  }

  bind(...values: unknown[]): this {
    this.values = values;
    return this;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
    return this.database.all<T>(this.query, this.values);
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    return this.database.first<T>(this.query, this.values);
  }

  async run(): Promise<unknown> {
    return { success: true };
  }
}

class OverviewDatabase implements D1DatabaseLike {
  prepareCount = 0;

  prepare(query: string): D1PreparedStatementLike {
    this.prepareCount += 1;
    return new OverviewStatement(this, query);
  }

  async first<T>(query: string, values: unknown[]): Promise<T | null> {
    if (query.includes("sqlite_master")) {
      return { name: String(values[0]) } as T;
    }

    if (query.includes("COUNT(*)")) {
      if (query.includes("FROM products p") && query.includes("product_admin_meta") && query.includes("m.status IN ('draft', 'review')")) return { total: 2 } as T;
      if (query.includes("FROM products") && query.includes("is_active = 1")) return { total: 10 } as T;
      if (query.includes("FROM products")) return { total: 12 } as T;
      if (query.includes("FROM services") && query.includes("is_active = 1")) return { total: 0 } as T;
      if (query.includes("FROM services")) return { total: 2 } as T;
      if (query.includes("FROM leads") && query.includes("status = 'new'")) return { total: 6 } as T;
      if (query.includes("FROM leads")) return { total: 8 } as T;
      if (query.includes("FROM admin_members")) return { total: 1 } as T;
      if (query.includes("FROM news_posts")) return { total: 0 } as T;
    }

    throw new Error(`Unexpected overview query: ${query}`);
  }

  async all<T>(query: string, values: unknown[]): Promise<{ results: T[] }> {
    if (query.includes("sqlite_master") && query.includes("name IN")) {
      return { results: values.map((name) => ({ name: String(name) })) as T[] };
    }
    return { results: [] };
  }
}

test("dashboard counts only products explicitly marked draft or review", async () => {
  const overview = await getAdminOverview(new OverviewDatabase(), { includeRecentLeads: true });

  assert.deepEqual(overview.counts, {
    activeProducts: 10,
    activeServices: 0,
    draftProducts: 2,
    leads: 8,
    newLeads: 6,
    news: 0,
    products: 12,
    services: 2,
  });
  assert.deepEqual(overview.dataReadiness, {
    adminMembersTable: true,
    activeProducts: true,
    activeServices: true,
    auditLogsTable: true,
    leadsTable: true,
    newLeads: true,
    newsPostsTable: true,
    productDraftsReady: true,
    productMetaTable: true,
    productsTable: true,
    recentLeads: true,
    serviceMetaTable: true,
    servicesTable: true,
  });
});

test("dashboard distinguishes failed data reads from real zero counts", async () => {
  class IncompleteOverviewDatabase extends OverviewDatabase {
    override async first<T>(query: string, values: unknown[]): Promise<T | null> {
      if (query.includes("FROM leads") || query.includes("FROM products")) {
        throw new Error("Table is unavailable");
      }
      return super.first<T>(query, values);
    }

    override async all<T>(query: string, values: unknown[]): Promise<{ results: T[] }> {
      if (query.includes("FROM leads")) throw new Error("Recent leads query failed");
      return super.all<T>(query, values);
    }
  }

  const overview = await getAdminOverview(new IncompleteOverviewDatabase(), { includeRecentLeads: true });

  assert.equal(overview.counts.leads, 0);
  assert.equal(overview.counts.draftProducts, 0);
  assert.equal(overview.counts.products, 0);
  assert.equal(overview.dataReadiness.leadsTable, false);
  assert.equal(overview.dataReadiness.productDraftsReady, false);
  assert.equal(overview.dataReadiness.productsTable, false);
  assert.equal(overview.dataReadiness.recentLeads, false);
});

test("dashboard keeps filtered counts unknown when only a filtered query fails", async () => {
  class IncompleteFilteredCountsDatabase extends OverviewDatabase {
    override async first<T>(query: string, values: unknown[]): Promise<T | null> {
      if (
        (query.includes("FROM products") && query.includes("is_active = 1")) ||
        (query.includes("FROM services") && query.includes("is_active = 1")) ||
        (query.includes("FROM leads") && query.includes("status = 'new'"))
      ) {
        throw new Error("Filtered column is unavailable");
      }
      return super.first<T>(query, values);
    }
  }

  const overview = await getAdminOverview(new IncompleteFilteredCountsDatabase());

  assert.equal(overview.dataReadiness.productsTable, true);
  assert.equal(overview.dataReadiness.servicesTable, true);
  assert.equal(overview.dataReadiness.leadsTable, true);
  assert.equal(overview.dataReadiness.activeProducts, false);
  assert.equal(overview.dataReadiness.activeServices, false);
  assert.equal(overview.dataReadiness.newLeads, false);
  assert.equal(overview.counts.activeProducts, 0);
  assert.equal(overview.counts.activeServices, 0);
  assert.equal(overview.counts.newLeads, 0);
});

test("dashboard overview stays within a bounded D1 query budget", async () => {
  const database = new OverviewDatabase();

  await getAdminOverview(database, { includeRecentLeads: true });

  assert.ok(database.prepareCount <= 11, `expected at most 11 D1 statements, got ${database.prepareCount}`);
});

test("dashboard queue uses accurate copy when no items need review", async () => {
  const primitives = await readFile(new URL("../src/components/admin/AdminPrimitives.tsx", import.meta.url), "utf8");

  assert.match(primitives, /Không có yêu cầu mới/);
  assert.doesNotMatch(primitives, /Đã xử lý hết/);
  assert.match(primitives, /Không có sản phẩm ở trạng thái nháp hoặc chờ duyệt/);
  assert.doesNotMatch(primitives, /100% hoàn tất|đã được phê duyệt và sẵn sàng/);
});

test("dashboard presents unavailable counts as unavailable instead of zero", async () => {
  const dashboard = await readFile(new URL("../src/app/admin/page.tsx", import.meta.url), "utf8");
  const primitives = await readFile(new URL("../src/components/admin/AdminPrimitives.tsx", import.meta.url), "utf8");

  assert.match(dashboard, /data\.dataReadiness\.productsTable \? data\.counts\.products : "—"/);
  assert.match(dashboard, /data\.dataReadiness\.productDraftsReady \? data\.counts\.draftProducts : "—"/);
  assert.match(dashboard, /Object\.entries\(data\.dataReadiness\)/);
  assert.doesNotMatch(dashboard, /key !== "leadsTable"/);
  assert.match(primitives, /dataReadiness\.leadsTable/);
  assert.match(primitives, /dataReadiness\.recentLeads/);
  assert.match(primitives, /dataReadiness\.newLeads/);
  assert.match(primitives, /Chưa thể tải yêu cầu báo giá/);
  assert.match(primitives, /Chưa thể tải danh sách yêu cầu gần đây/);
  assert.match(primitives, /dataReadiness\.productDraftsReady/);
  assert.match(primitives, /Chưa xác định trạng thái bản nháp/);
  assert.match(dashboard, /data\.dataReadiness\.activeProducts \?/);
  assert.match(dashboard, /data\.dataReadiness\.activeServices \?/);
});
