import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { legacyMegaMenuItems } from "../src/data/legacy-mega-menu.ts";
import type { D1DatabaseLike, D1PreparedStatementLike } from "../src/lib/admin-data.ts";
import {
  SiteNavigationValidationError,
  createAdminSiteNavigation,
  listAdminSiteNavigation,
  publishAllAdminSiteNavigation,
  publishAdminSiteNavigation,
  updateAdminSiteNavigation,
} from "../src/lib/site-navigation.ts";

const actorSubject = "qtu1053@gmail.com";

test("navigation create persists as draft-only until explicit publish", async () => {
  const database = new SqliteNavigationDatabase();
  const created = await createAdminSiteNavigation(database, {
    actorSubject,
    href: "/draft/",
    isActive: true,
    label: "Bản nháp",
    menuKey: "primary",
    parentId: null,
    requestId: "11111111-1111-4111-8111-111111111111",
    sortOrder: 70,
  });

  assert.equal(created.dirty, true);
  assert.equal(created.publishedIsActive, false);
  assert.equal(created.publishedParentId, null);

  const published = await publishAdminSiteNavigation(database, {
    actorSubject,
    expectedVersion: created.version,
    id: created.id,
    requestId: "22222222-2222-4222-8222-222222222222",
  });
  assert.equal(published.dirty, false);
  assert.equal(published.publishedIsActive, true);
  database.close();
});

test("navigation mutation rolls back when the graph becomes cyclic inside its batch", async () => {
  const database = new SqliteNavigationDatabase();
  database.insertRow("parent", "Parent");
  database.insertRow("child", "Child");
  database.beforeBatch = () => {
    database.sqlite.prepare("UPDATE site_navigation_items SET draft_parent_id = 'parent' WHERE id = 'child'").run();
    database.beforeBatch = null;
  };

  await assert.rejects(
    () => updateAdminSiteNavigation(database, {
      actorSubject,
      expectedVersion: 1,
      href: "/parent/",
      id: "parent",
      isActive: true,
      label: "Parent",
      parentId: "child",
      requestId: "33333333-3333-4333-8333-333333333333",
      sortOrder: 10,
    }),
    /navigation|cycle|audit/i,
  );

  assert.equal(database.scalar("SELECT draft_parent_id FROM site_navigation_items WHERE id = 'parent'"), null);
  assert.equal(database.scalar("SELECT draft_parent_id FROM site_navigation_items WHERE id = 'child'"), null);
  assert.equal(database.scalar("SELECT version FROM site_navigation_items WHERE id = 'parent'"), 1);
  assert.equal(database.scalar("SELECT COUNT(*) FROM admin_navigation_audit"), 0);
  database.close();
});

test("bulk publish reads a changed item beyond the first 100 navigation rows", async () => {
  const database = new SqliteNavigationDatabase();
  for (let index = 0; index < 101; index += 1) database.insertRow(`item-${String(index).padStart(3, "0")}`, `Item ${index}`);
  database.sqlite.prepare("UPDATE site_navigation_items SET draft_label = 'Dirty last' WHERE id = 'item-100'").run();

  const result = await publishAllAdminSiteNavigation(database, {
    actorSubject,
    requestId: "44444444-4444-4444-8444-444444444444",
  });

  assert.deepEqual(result.published.map((item) => item.id), ["item-100"]);
  assert.equal(result.changedCount, 1);
  database.close();
});

test("navigation draft validation sees a parent beyond the bounded admin list", async () => {
  const database = new SqliteNavigationDatabase();
  for (let index = 0; index < 101; index += 1) database.insertRow(`item-${String(index).padStart(3, "0")}`, `Item ${index}`);

  const created = await createAdminSiteNavigation(database, {
    actorSubject,
    href: "/child/",
    isActive: true,
    label: "Child",
    menuKey: "primary",
    parentId: "item-100",
    requestId: "45454545-4545-4454-8454-454545454545",
    sortOrder: 20,
  });
  assert.equal(created.draftParentId, "item-100");

  const updated = await updateAdminSiteNavigation(database, {
    actorSubject,
    expectedVersion: 1,
    href: "/item-000/",
    id: "item-000",
    isActive: true,
    label: "Item 0",
    parentId: "item-100",
    requestId: "46464646-4646-4464-8464-464646464646",
    sortOrder: 10,
  });
  assert.equal(updated.draftParentId, "item-100");
  database.close();
});

test("navigation rejects captured children and nested footer items at the persistence boundary", async () => {
  const database = new SqliteNavigationDatabase();
  database.insertRow("captured-parent", "Captured parent", "primary", "menu-parent");
  database.insertRow("footer-parent", "Footer parent", "footer");

  await assert.rejects(
    () => createAdminSiteNavigation(database, {
      actorSubject,
      capturedMenuId: "menu-child",
      href: "/captured-child/",
      label: "Captured child",
      menuKey: "primary",
      parentId: "captured-parent",
      requestId: "55555555-5555-4555-8555-555555555555",
    }),
    SiteNavigationValidationError,
  );
  await assert.rejects(
    () => createAdminSiteNavigation(database, {
      actorSubject,
      href: "/footer-child/",
      label: "Footer child",
      menuKey: "footer",
      parentId: "footer-parent",
      requestId: "66666666-6666-4666-8666-666666666666",
    }),
    SiteNavigationValidationError,
  );
  assert.equal(database.scalar("SELECT COUNT(*) FROM site_navigation_items"), 2);
  database.close();
});

test("navigation allows a known service hub under its managed parent", async () => {
  const database = new SqliteNavigationDatabase();
  const sourceItem = legacyMegaMenuItems.find((item) => item.owner === "services" && item.href === "/gia-cong-sua/");
  assert.ok(sourceItem);
  database.insertRow("services", "Thuê gia công", "primary", "menu-item-5166");

  const created = await createAdminSiteNavigation(database, {
    actorSubject,
    capturedMenuId: sourceItem.id,
    href: "/demo-gia-cong-sua/",
    isActive: true,
    label: "Gia công sữa demo",
    menuKey: "primary",
    parentId: "services",
    requestId: "77777777-7777-4777-8777-777777777777",
    sortOrder: sourceItem.sortOrder,
  });

  assert.equal(created.capturedMenuId, sourceItem.id);
  assert.equal(created.draftParentId, "services");
  assert.equal(created.dirty, true);
  const published = await publishAdminSiteNavigation(database, {
    actorSubject,
    expectedVersion: created.version,
    id: created.id,
    requestId: "88888888-8888-4888-8888-888888888888",
  });
  assert.equal(published.publishedParentId, "services");
  assert.equal(published.publishedIsActive, true);
  database.close();
});

test("navigation admin list exposes service hubs until they are persisted", async () => {
  const database = new SqliteNavigationDatabase();
  database.insertRow("products", "Mua hàng", "primary", "menu-item-1742");
  database.insertRow("services", "Thuê gia công", "primary", "menu-item-5166");

  const items = await listAdminSiteNavigation(database);
  const managedSource = legacyMegaMenuItems.find((item) => item.owner === "services" && item.href === "/gia-cong-sua/");
  const serviceSources = legacyMegaMenuItems.filter((item) => item.owner === "services");
  assert.ok(managedSource);
  assert.ok(serviceSources.length > 0);
  assert.equal(items.find((item) => item.capturedMenuId === managedSource.id)?.virtual, true);
  assert.equal(items.filter((item) => item.virtual && item.draftParentId === "services").length, serviceSources.length);
  assert.equal(items.find((item) => item.id === "products")?.virtual, undefined);
  database.close();
});

interface BeforeBatchDatabase extends D1DatabaseLike {
  beforeBatch: (() => void) | null;
  close(): void;
  insertRow(id: string, label: string, menuKey?: "primary" | "footer", capturedMenuId?: string): void;
  scalar(query: string): unknown;
  sqlite: DatabaseSync;
}

class SqliteNavigationDatabase implements BeforeBatchDatabase {
  readonly sqlite = new DatabaseSync(":memory:");
  beforeBatch: (() => void) | null = null;

  constructor() {
    this.sqlite.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE site_navigation_items (
        id TEXT PRIMARY KEY,
        menu_key TEXT NOT NULL,
        captured_menu_id TEXT,
        draft_label TEXT NOT NULL,
        draft_href TEXT NOT NULL,
        draft_sort_order INTEGER NOT NULL,
        draft_is_active INTEGER NOT NULL,
        draft_parent_id TEXT,
        published_label TEXT NOT NULL,
        published_href TEXT NOT NULL,
        published_sort_order INTEGER NOT NULL,
        published_is_active INTEGER NOT NULL,
        published_parent_id TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        updated_by TEXT,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        published_by TEXT,
        published_at TEXT,
        last_request_id TEXT,
        UNIQUE (menu_key, captured_menu_id)
      );
      CREATE TABLE admin_navigation_create_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT NOT NULL UNIQUE,
        actor_subject TEXT NOT NULL,
        action TEXT NOT NULL,
        operation TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_key TEXT NOT NULL,
        previous_revision INTEGER NOT NULL,
        resulting_revision INTEGER NOT NULL,
        payload_sha256 TEXT NOT NULL
      );
      CREATE TABLE admin_navigation_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT NOT NULL UNIQUE,
        actor_subject TEXT NOT NULL,
        action TEXT NOT NULL,
        operation TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_key TEXT NOT NULL,
        previous_revision INTEGER NOT NULL,
        resulting_revision INTEGER NOT NULL,
        payload_sha256 TEXT NOT NULL,
        bulk_request_id TEXT
      );
      CREATE TABLE admin_navigation_bulk_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT NOT NULL UNIQUE,
        actor_subject TEXT NOT NULL,
        action TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload_sha256 TEXT NOT NULL,
        selected_count INTEGER NOT NULL,
        published_count INTEGER NOT NULL,
        selected_ids_json TEXT NOT NULL
      );
    `);
  }

  prepare(query: string): D1PreparedStatementLike {
    return new SqliteNavigationStatement(query, this.sqlite);
  }

  async batch(statements: D1PreparedStatementLike[]): Promise<unknown[]> {
    this.sqlite.exec("BEGIN");
    try {
      this.beforeBatch?.();
      const results: unknown[] = [];
      for (const statement of statements) results.push(await statement.run());
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      this.sqlite.exec("ROLLBACK");
      throw error;
    }
  }

  insertRow(id: string, label: string, menuKey: "primary" | "footer" = "primary", capturedMenuId?: string): void {
    this.sqlite.prepare(`
      INSERT INTO site_navigation_items (
        id, menu_key, captured_menu_id, draft_label, draft_href, draft_sort_order, draft_is_active,
        published_label, published_href, published_sort_order, published_is_active, version
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 1, 1)
    `).run(id, menuKey, capturedMenuId ?? null, label, `/${id}/`, 10, label, `/${id}/`, 10);
  }

  scalar(query: string): unknown {
    const row = this.sqlite.prepare(query).get() as { [key: string]: unknown } | undefined;
    return row ? Object.values(row)[0] : undefined;
  }

  close(): void {
    this.sqlite.close();
  }
}

class SqliteNavigationStatement implements D1PreparedStatementLike {
  private values: unknown[] = [];
  private readonly query: string;
  private readonly sqlite: DatabaseSync;

  constructor(query: string, sqlite: DatabaseSync) {
    this.query = query;
    this.sqlite = sqlite;
  }

  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
    return { results: this.sqlite.prepare(this.query).all(...(this.values as never[])) as T[] };
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    return (this.sqlite.prepare(this.query).get(...(this.values as never[])) as T | undefined) ?? null;
  }

  async run(): Promise<unknown> {
    return this.sqlite.prepare(this.query).run(...(this.values as never[]));
  }
}
