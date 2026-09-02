import assert from "node:assert/strict";
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
  const overview = await getAdminOverview(new OverviewDatabase());

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
});

test("dashboard overview stays within a bounded D1 query budget", async () => {
  const database = new OverviewDatabase();

  await getAdminOverview(database, { includeRecentLeads: true });

  assert.ok(database.prepareCount <= 11, `expected at most 11 D1 statements, got ${database.prepareCount}`);
});
