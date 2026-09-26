import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getAdminOverview } from "../src/lib/admin-data.ts";
import type { D1DatabaseLike, D1PreparedStatementLike } from "../src/lib/admin-data.ts";
import { canManage } from "../src/lib/admin-permissions.ts";

async function readSource(...segments: string[]) {
  return readFile(new URL(`../src/${segments.join("/")}`, import.meta.url), "utf8");
}

/* ========================================================================== */
/* SECTION 1: D1 Query Budget Stress & Resilience                             */
/* ========================================================================== */

class MockStatement implements D1PreparedStatementLike {
  private values: unknown[] = [];
  private readonly db: MockDatabase;
  private readonly query: string;

  constructor(db: MockDatabase, query: string) {
    this.db = db;
    this.query = query;
  }

  bind(...values: unknown[]): this {
    this.values = values;
    return this;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
    return this.db.handleAll<T>(this.query, this.values);
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    return this.db.handleFirst<T>(this.query, this.values);
  }

  async run(): Promise<unknown> {
    return { success: true };
  }
}

class MockDatabase implements D1DatabaseLike {
  prepareCount = 0;
  executedQueries: string[] = [];
  existingTables = new Set<string>(["product_admin_meta", "service_admin_meta", "audit_logs", "news_posts"]);
  productCount = 50;
  activeProductCount = 40;
  draftProductCount = 10;
  serviceCount = 15;
  activeServiceCount = 12;
  leadCount = 100;
  newLeadCount = 25;
  newsCount = 8;
  memberCount = 3;
  recentLeadsData = [
    { id: "lead-1", full_name: "Cong ty A", status: "new", created_at: "2026-09-25T01:00:00Z" },
    { id: "lead-2", full_name: "Cong ty B", status: "contacted", created_at: "2026-09-25T02:00:00Z" },
    { id: "lead-3", full_name: "Cong ty C", status: "quotation_sent", created_at: "2026-09-25T03:00:00Z" },
    { id: "lead-4", full_name: "Cong ty D", status: "won", created_at: "2026-09-25T04:00:00Z" },
    { id: "lead-5", full_name: "Cong ty E", status: "spam", created_at: "2026-09-25T05:00:00Z" },
    { id: "lead-6", full_name: "Cong ty F (SHOULD NOT BE RETURNED)", status: "new", created_at: "2026-09-25T06:00:00Z" },
  ];

  prepare(query: string): D1PreparedStatementLike {
    this.prepareCount += 1;
    this.executedQueries.push(query);
    return new MockStatement(this, query);
  }

  handleFirst<T>(query: string, values: unknown[]): T | null {
    if (query.includes("sqlite_master")) {
      const name = String(values[0]);
      return this.existingTables.has(name) ? ({ name } as T) : null;
    }

    if (query.includes("COUNT(*)")) {
      if (query.includes("FROM products p") && query.includes("product_admin_meta") && query.includes("m.status IN ('draft', 'review')")) {
        return { total: this.draftProductCount } as T;
      }
      if (query.includes("FROM products") && query.includes("is_active = 1")) {
        return { total: this.activeProductCount } as T;
      }
      if (query.includes("FROM products")) {
        return { total: this.productCount } as T;
      }
      if (query.includes("FROM services") && query.includes("is_active = 1")) {
        return { total: this.activeServiceCount } as T;
      }
      if (query.includes("FROM services")) {
        return { total: this.serviceCount } as T;
      }
      if (query.includes("FROM leads") && query.includes("status = 'new'")) {
        return { total: this.newLeadCount } as T;
      }
      if (query.includes("FROM leads")) {
        return { total: this.leadCount } as T;
      }
      if (query.includes("FROM admin_members")) {
        return { total: this.memberCount } as T;
      }
      if (query.includes("FROM news_posts")) {
        return { total: this.newsCount } as T;
      }
    }

    throw new Error(`Unexpected query in MockDatabase: ${query}`);
  }

  handleAll<T>(query: string, values: unknown[]): { results: T[] } {
    if (query.includes("sqlite_master") && query.includes("name IN")) {
      const matched = values.filter((name) => this.existingTables.has(String(name)));
      return { results: matched.map((name) => ({ name: String(name) })) as T[] };
    }
    if (query.includes("FROM leads") && query.includes("ORDER BY created_at DESC") && query.includes("LIMIT 5")) {
      return { results: this.recentLeadsData.slice(0, 5) as T[] };
    }
    return { results: [] };
  }
}

test("D1 Query Budget: Under full load with recentLeads enabled, budget <= 11 statements", async () => {
  const db = new MockDatabase();
  const overview = await getAdminOverview(db, { includeRecentLeads: true });

  assert.ok(db.prepareCount <= 11, `Expected <= 11 D1 statements, got ${db.prepareCount}`);
  assert.equal(db.prepareCount, 11, "Expected exactly 11 bounded queries for full overview");

  // Verify recentLeads strictly limited to at most 5 items
  assert.equal(overview.recentLeads.length, 5);
  assert.equal(overview.recentLeads[0].fullName, "Cong ty A");
  assert.equal(overview.recentLeads[4].fullName, "Cong ty E");
  // Lead 6 must not appear
  assert.ok(!overview.recentLeads.some((l) => l.fullName.includes("SHOULD NOT BE RETURNED")));
});

test("D1 Query Budget: When includeRecentLeads is false, budget <= 10 statements", async () => {
  const db = new MockDatabase();
  const overview = await getAdminOverview(db, { includeRecentLeads: false });

  assert.ok(db.prepareCount <= 10, `Expected <= 10 D1 statements, got ${db.prepareCount}`);
  assert.equal(overview.recentLeads.length, 0);
});

test("D1 Query Budget Resilience: Gracefully handles missing optional tables without crashing or query explosion", async () => {
  const db = new MockDatabase();
  db.existingTables.clear(); // No product_admin_meta, service_admin_meta, audit_logs, news_posts

  const overview = await getAdminOverview(db, { includeRecentLeads: true });

  // Missing product_admin_meta and news_posts should bypass draft product query and news count query
  assert.ok(db.prepareCount <= 9, `Expected <= 9 queries when optional tables missing, got ${db.prepareCount}`);
  assert.equal(overview.counts.draftProducts, 0);
  assert.equal(overview.counts.news, 0);
  assert.equal(overview.dataReadiness.productMetaTable, false);
  assert.equal(overview.dataReadiness.auditLogsTable, false);
});

/* ========================================================================== */
/* SECTION 2: Metric & Count Contract Assertions                              */
/* ========================================================================== */

test("Metric Contract: All required count properties accurately map to schema", async () => {
  const db = new MockDatabase();
  const overview = await getAdminOverview(db, { includeRecentLeads: true });

  assert.deepEqual(overview.counts, {
    activeProducts: 40,
    activeServices: 12,
    draftProducts: 10,
    leads: 100,
    newLeads: 25,
    news: 8,
    products: 50,
    services: 15,
  });

  // Verify recentLeads field structure
  for (const lead of overview.recentLeads) {
    assert.ok(typeof lead.id === "string" && lead.id.length > 0);
    assert.ok(typeof lead.fullName === "string");
    assert.ok(typeof lead.status === "string");
    assert.ok(typeof lead.createdAt === "string");
  }
});

/* ========================================================================== */
/* SECTION 3: Frontend TestID & Link Integrity Audit                          */
/* ========================================================================== */

test("Frontend TestID Integrity: page.tsx retains all required metrics and shortcut testids", async () => {
  const pageSrc = await readSource("app", "admin", "page.tsx");

  // Metric testids
  assert.match(pageSrc, /testId="metric-products"/, "Missing metric-products testId");
  assert.match(pageSrc, /testId="metric-draft-products"/, "Missing metric-draft-products testId");
  assert.match(pageSrc, /testId="metric-services"/, "Missing metric-services testId");
  assert.match(pageSrc, /testId="metric-news"/, "Missing metric-news testId");

  // Shortcut links testids
  assert.match(pageSrc, /data-testid="link-quick-inbox"/, "Missing link-quick-inbox testid");
  assert.match(pageSrc, /data-testid="link-dashboard-products"/, "Missing link-dashboard-products testid");
  assert.match(pageSrc, /data-testid="link-dashboard-services"/, "Missing link-dashboard-services testid");
  assert.match(pageSrc, /data-testid="link-dashboard-news"/, "Missing link-dashboard-news testid");

  // DevOps diagnostic accordion
  assert.match(pageSrc, /data-testid="accordion-data-readiness"/, "Missing accordion-data-readiness testid");
});

test("Frontend TestID Integrity: AdminPrimitives.tsx retains panel testids", async () => {
  const primSrc = await readSource("components", "admin", "AdminPrimitives.tsx");

  // Panel testids
  assert.match(primSrc, /data-testid="panel-data-readiness"/, "Missing panel-data-readiness testid");
  assert.match(primSrc, /data-testid="panel-operations-queue"/, "Missing panel-operations-queue testid");

  // Link targets inside AdminOperationsQueue
  assert.match(primSrc, /href="\/admin\/yeu-cau"/, "Missing /admin/yeu-cau link");
  assert.match(primSrc, /href="\/admin\/yeu-cau\?status=new"/, "Missing /admin/yeu-cau?status=new link");
  assert.match(primSrc, /href=\{`\/admin\/yeu-cau\?id=\$\{lead\.id\}`\}/, "Missing per-lead detail link");
  assert.match(primSrc, /href="\/admin\/san-pham\?status=draft"/, "Missing /admin/san-pham?status=draft link");
  assert.match(primSrc, /href="\/admin\/san-pham"/, "Missing /admin/san-pham link");
  assert.match(primSrc, /href="\/admin\/tin-tuc"/, "Missing /admin/tin-tuc link");
});

/* ========================================================================== */
/* SECTION 4: Role-Based Access Isolation Audit                               */
/* ========================================================================== */

test("Role Permission Contracts: Only authorized owner role has administrative access in Lean V1", async () => {
  const pageSrc = await readSource("app", "admin", "page.tsx");

  // DataReadiness diagnostic is strictly owner-only
  assert.match(pageSrc, /session\.role === "owner" && data\.dataReadiness/, "DataReadiness must be restricted to owner role");

  // Owner has full control
  assert.equal(canManage("owner", "leads.read"), true);
  assert.equal(canManage("owner", "catalog.read"), true);
  assert.equal(canManage("owner", "services.read"), true);
  assert.equal(canManage("owner", "news.read"), true);

  // Unaudited or arbitrary roles are strictly denied
  assert.equal(canManage("operator", "leads.read"), false);
  assert.equal(canManage("editor", "leads.read"), false);
  assert.equal(canManage("viewer", "leads.read"), false);
  assert.equal(canManage("editor", "catalog.read"), false);
});

/* ========================================================================== */
/* SECTION 5: CSS & Responsive Layout Audit                                    */
/* ========================================================================== */

test("CSS Verification: Operations Queue classes, status pulse and mobile media queries exist", async () => {
  const css = await readSource("styles", "admin.css");

  // Core queue styling classes
  assert.match(css, /\.admin-operations-queue/, "Missing .admin-operations-queue in CSS");
  assert.match(css, /\.admin-queue-section/, "Missing .admin-queue-section in CSS");
  assert.match(css, /\.admin-queue-lead-row/, "Missing .admin-queue-lead-row in CSS");
  assert.match(css, /\.admin-queue-lead-name/, "Missing .admin-queue-lead-name in CSS");
  assert.match(css, /\.admin-queue-lead-meta/, "Missing .admin-queue-lead-meta in CSS");
  assert.match(css, /\.admin-queue-empty/, "Missing .admin-queue-empty in CSS");
  assert.match(css, /\.admin-queue-pipeline-card/, "Missing .admin-queue-pipeline-card in CSS");
  assert.match(css, /\.admin-badge-pulse/, "Missing .admin-badge-pulse in CSS");

  // Readiness accordion styling
  assert.match(css, /\.admin-readiness-accordion/, "Missing .admin-readiness-accordion in CSS");
  assert.match(css, /\.admin-readiness-summary/, "Missing .admin-readiness-summary in CSS");

  // Responsive padding rules
  assert.match(css, /\.admin-queue-section\s*\{\s*padding:\s*16px;\s*\}/, "Missing responsive padding for queue section");
});
