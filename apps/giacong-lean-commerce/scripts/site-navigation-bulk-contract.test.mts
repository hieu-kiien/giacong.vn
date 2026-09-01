import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MAX_NAVIGATION_BULK_ITEMS,
  SiteNavigationBatchLimitError,
  SiteNavigationConflictError,
  SiteNavigationIdempotencyConflictError,
  createAdminSiteNavigation,
  publishAdminSiteNavigation,
  publishAllAdminSiteNavigation,
  updateAdminSiteNavigation,
} from "../src/lib/site-navigation.ts";
import type { D1DatabaseLike, D1PreparedStatementLike } from "../src/lib/admin-data.ts";

test("navigation bulk publish has a request-scoped audit contract", async () => {
  const [migration, createMigration, source, bulkRoute, createRoute, manager, detailRoute, publishRoute] = await Promise.all([
    readFile(new URL("../migrations/0017_navigation_bulk_publish_contract.sql", import.meta.url), "utf8"),
    readFile(new URL("../migrations/0018_navigation_create_contract.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/site-navigation.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/navigation/publish-all/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/navigation/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/admin/AdminNavigationManager.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/navigation/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/navigation/[id]/publish/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(migration, /CREATE TABLE IF NOT EXISTS admin_navigation_bulk_audit/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS admin_navigation_audit/);
  assert.match(createMigration, /CREATE TABLE IF NOT EXISTS admin_navigation_create_audit/);
  assert.match(createMigration, /action TEXT NOT NULL CHECK \(action = 'create'\)/);
  assert.match(migration, /selected_ids_json/);
  assert.match(migration, /ALTER TABLE site_navigation_items\s+ADD COLUMN last_request_id/);
  assert.match(source, /admin_navigation_bulk_audit/);
  assert.match(source, /admin_navigation_audit/);
  assert.match(source, /databaseWithBatch\.batch/);
  assert.match(source, /LIMIT 101/);
  assert.match(source, /SiteNavigationBatchLimitError/);
  assert.match(source, /findNavigationCreateMutation/);
  assert.match(source, /admin_navigation_create_audit/);
  assert.match(bulkRoute, /readBoundedAdminJson/);
  assert.match(createRoute, /hasOnlyKeys\(body, \["requestId", "menuKey", "label", "href", "capturedMenuId", "sortOrder", "isActive"\]\)/);
  assert.match(createRoute, /isAdminRequestId\(body\.requestId\)/);
  assert.match(createRoute, /SiteNavigationIdempotencyConflictError/);
  assert.match(bulkRoute, /hasOnlyKeys\(body, \["requestId"\]\)/);
  assert.match(bulkRoute, /SiteNavigationValidationError/);
  assert.match(bulkRoute, /publishAllAdminSiteNavigation[\s\S]*requestId/);
  assert.match(bulkRoute, /adminSuccess\(requestId, result\)/);
  assert.match(manager, /publishAllRequestId/);
  assert.match(manager, /body: \{ requestId \}/);
  assert.match(manager, /result\.skipped\.map/);
  assert.match(detailRoute, /hasOnlyKeys\(body, \["requestId", "expectedVersion", "label", "href", "sortOrder", "isActive"\]\)/);
  assert.match(detailRoute, /requestId/);
  assert.match(publishRoute, /hasOnlyKeys\(body, \["requestId", "expectedVersion"\]\)/);
  assert.match(publishRoute, /requestId/);
  assert.match(source, /applyAtomicNavigationMutation/);
});

test("navigation create is atomic, request-scoped and replayable", async () => {
  const database = new FakeNavigationDatabase([]);
  const input = {
    actorSubject: "qtu1053@gmail.com",
    capturedMenuId: "menu-custom",
    href: "/custom/",
    isActive: true,
    label: "Mục mới",
    menuKey: "primary",
    requestId: "99999999-9999-4999-8999-999999999999",
    sortOrder: 70,
  } as Parameters<typeof createAdminSiteNavigation>[1];

  const created = await createAdminSiteNavigation(database, input);
  assert.equal(created.version, 1);
  assert.equal(created.dirty, false);
  assert.equal(database.rows.length, 1);
  assert.equal(database.createAudits.size, 1);
  assert.equal(database.batchCalls, 1);

  const replay = await createAdminSiteNavigation(database, input);
  assert.deepEqual(replay, created);
  assert.equal(database.rows.length, 1);
  assert.equal(database.createAudits.size, 1);
  assert.equal(database.batchCalls, 1);

  await assert.rejects(
    () => createAdminSiteNavigation(database, { ...input, label: "Mục khác" }),
    SiteNavigationIdempotencyConflictError,
  );
  assert.equal(database.rows.length, 1);
  assert.equal(database.batchCalls, 1);
});

test("navigation create rolls back the item when specialized audit fails", async () => {
  const database = new FakeNavigationDatabase([]);
  database.failOnQuery = "INSERT INTO admin_navigation_create_audit";

  await assert.rejects(
    () => createAdminSiteNavigation(database, {
      actorSubject: "qtu1053@gmail.com",
      href: "/rollback/",
      label: "Rollback",
      menuKey: "primary",
      requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    } as Parameters<typeof createAdminSiteNavigation>[1]),
  );
  assert.equal(database.rows.length, 0);
  assert.equal(database.createAudits.size, 0);
  assert.equal(database.batchCalls, 1);
});

test("navigation bulk publish is atomic, bounded by the query and replayable", async () => {
  const database = new FakeNavigationDatabase([
    navigationRow({ id: "home", draftLabel: "Trang chủ mới" }),
    navigationRow({ id: "footer-contact", menuKey: "footer", draftLabel: "Liên hệ mới" }),
    navigationRow({ id: "about" }),
  ]);
  const requestId = "11111111-1111-4111-8111-111111111111";

  const first = await publishAllAdminSiteNavigation(database, { actorSubject: "qtu1053@gmail.com", requestId });
  assert.equal(first.selectedCount, 2);
  assert.equal(first.changedCount, 2);
  assert.deepEqual(first.published.map((item) => item.id), ["footer-contact", "home"]);
  assert.deepEqual(first.skipped, []);
  assert.equal(database.batchCalls, 1);
  assert.equal(database.items.length, 2);
  assert.equal(database.navigationAuditCount, 2);

  const replay = await publishAllAdminSiteNavigation(database, { actorSubject: "qtu1053@gmail.com", requestId });
  assert.deepEqual(replay, first);
  assert.equal(database.batchCalls, 1);
  assert.equal(database.navigationAuditCount, 2);
});

test("navigation bulk publish returns stable per-item stale results and replays them", async () => {
  const database = new FakeNavigationDatabase([
    navigationRow({ id: "home", draftLabel: "Trang chủ mới" }),
    navigationRow({ id: "about", draftLabel: "Giới thiệu mới" }),
  ]);
  database.skipUpdateIds.add("about");

  const first = await publishAllAdminSiteNavigation(database, {
    actorSubject: "qtu1053@gmail.com",
    requestId: "22222222-2222-4222-8222-222222222222",
  });

  assert.equal(first.selectedCount, 2);
  assert.equal(first.changedCount, 1);
  assert.deepEqual(first.published.map((item) => item.id), ["home"]);
  assert.deepEqual(first.skipped, [{ id: "about", reason: "stale" }]);
  assert.equal(database.items.length, 1);
  assert.equal(database.navigationAuditCount, 1);

  const replay = await publishAllAdminSiteNavigation(database, {
    actorSubject: "qtu1053@gmail.com",
    requestId: "22222222-2222-4222-8222-222222222222",
  });
  assert.deepEqual(replay, first);
  assert.equal(database.batchCalls, 1);
});

test("navigation bulk publish rejects the 101st dirty item before mutation", async () => {
  const database = new FakeNavigationDatabase(
    Array.from({ length: MAX_NAVIGATION_BULK_ITEMS + 1 }, (_, index) => navigationRow({
      id: `item-${index}`,
      draftLabel: `Nhãn mới ${index}`,
    })),
  );
  await assert.rejects(
    () => publishAllAdminSiteNavigation(database, {
      actorSubject: "qtu1053@gmail.com",
      requestId: "33333333-3333-4333-8333-333333333333",
    }),
    SiteNavigationBatchLimitError,
  );
  assert.equal(database.batchCalls, 0);
  assert.equal(database.audits.size, 0);
  assert.equal(database.items.length, 0);
  assert.equal(database.navigationAuditCount, 0);
  assert.equal(database.rows.every((row) => row.version === 1), true);
});

test("navigation bulk publish rolls back when a per-item audit statement fails", async () => {
  const database = new FakeNavigationDatabase([navigationRow({ id: "home", draftLabel: "Trang chủ mới" })]);
  database.failOnQuery = "INSERT INTO admin_navigation_audit";

  await assert.rejects(
    () => publishAllAdminSiteNavigation(database, {
      actorSubject: "qtu1053@gmail.com",
      requestId: "44444444-4444-4444-8444-444444444444",
    }),
  );
  assert.equal(database.audits.size, 0);
  assert.equal(database.items.length, 0);
  assert.equal(database.navigationAuditCount, 0);
  assert.equal(database.rows[0]?.version, 1);
  assert.equal(database.rows[0]?.published_label, "Nhãn cũ");
});

test("navigation bulk publish rejects request ID reuse with a different stored fingerprint", async () => {
  const database = new FakeNavigationDatabase([navigationRow({ id: "home", draftLabel: "Trang chủ mới" })]);
  database.audits.set("55555555-5555-4555-8555-555555555555", {
    operation: "publish_all",
    payload_sha256: "0".repeat(64),
    published_count: 0,
    selected_count: 1,
    selected_ids_json: '["home"]',
  });

  await assert.rejects(
    () => publishAllAdminSiteNavigation(database, {
      actorSubject: "qtu1053@gmail.com",
      requestId: "55555555-5555-4555-8555-555555555555",
    }),
    SiteNavigationIdempotencyConflictError,
  );
});

test("single navigation draft and publish mutations are atomic and replayable", async () => {
  const database = new FakeNavigationDatabase([navigationRow({ id: "home", draftLabel: "Trang chủ mới" })]);
  const updated = await updateAdminSiteNavigation(database, {
    actorSubject: "qtu1053@gmail.com",
    expectedVersion: 1,
    href: "/gioi-thieu/",
    id: "home",
    isActive: true,
    label: "Trang chủ đã lưu",
    requestId: "66666666-6666-4666-8666-666666666666",
    sortOrder: 20,
  });
  assert.equal(updated.version, 2);
  assert.equal(updated.dirty, true);
  assert.equal(database.singleAudits.size, 1);

  const updateReplay = await updateAdminSiteNavigation(database, {
    actorSubject: "qtu1053@gmail.com",
    expectedVersion: 1,
    href: "/gioi-thieu/",
    id: "home",
    isActive: true,
    label: "Trang chủ đã lưu",
    requestId: "66666666-6666-4666-8666-666666666666",
    sortOrder: 20,
  });
  assert.deepEqual(updateReplay, updated);
  assert.equal(database.batchCalls, 1);

  const published = await publishAdminSiteNavigation(database, {
    actorSubject: "qtu1053@gmail.com",
    expectedVersion: 2,
    id: "home",
    requestId: "77777777-7777-4777-8777-777777777777",
  });
  assert.equal(published.version, 3);
  assert.equal(published.dirty, false);
  assert.equal(database.singleAudits.size, 2);

  const publishReplay = await publishAdminSiteNavigation(database, {
    actorSubject: "qtu1053@gmail.com",
    expectedVersion: 2,
    id: "home",
    requestId: "77777777-7777-4777-8777-777777777777",
  });
  assert.deepEqual(publishReplay, published);
  assert.equal(database.batchCalls, 2);
});

test("single navigation mutation keeps stale writes out of the audit", async () => {
  const database = new FakeNavigationDatabase([navigationRow({ id: "home", draftLabel: "Trang chủ mới" })]);
  database.skipUpdateIds.add("home");
  await assert.rejects(
    () => updateAdminSiteNavigation(database, {
      actorSubject: "qtu1053@gmail.com",
      expectedVersion: 1,
      href: "/",
      id: "home",
      isActive: true,
      label: "Trang chủ mới",
      requestId: "88888888-8888-4888-8888-888888888888",
      sortOrder: 10,
    }),
    SiteNavigationConflictError,
  );
  assert.equal(database.singleAudits.size, 0);
});

function navigationRow(input: { draftLabel?: string; id: string; menuKey?: "primary" | "footer" }): NavigationRow {
  return {
    id: input.id,
    menu_key: input.menuKey ?? "primary",
    captured_menu_id: `menu-${input.id}`,
    draft_label: input.draftLabel ?? "Nhãn hiện tại",
    draft_href: "/",
    draft_sort_order: 10,
    draft_is_active: 1,
    published_label: input.draftLabel ? "Nhãn cũ" : "Nhãn hiện tại",
    published_href: "/",
    published_sort_order: 10,
    published_is_active: 1,
    version: 1,
    updated_by: null,
    updated_at: "2026-09-01T00:00:00.000Z",
    published_by: null,
    published_at: null,
    last_request_id: null,
  };
}

interface NavigationRow {
  id: string;
  menu_key: "primary" | "footer";
  captured_menu_id: string | null;
  draft_label: string;
  draft_href: string;
  draft_sort_order: number;
  draft_is_active: number;
  published_label: string;
  published_href: string;
  published_sort_order: number;
  published_is_active: number;
  version: number;
  updated_by: string | null;
  updated_at: string;
  published_by: string | null;
  published_at: string | null;
  last_request_id: string | null;
}

interface BulkAudit {
  operation: "publish_all";
  payload_sha256: string;
  published_count: number;
  selected_count: number;
  selected_ids_json: string;
}

interface BulkAuditItem {
  bulk_request_id: string;
  navigation_id: string;
}

interface SingleAudit {
  entity_key: string;
  operation: "draft" | "publish";
  payload_sha256: string;
}

interface CreateAudit {
  entity_key: string;
  operation: "create";
  payload_sha256: string;
}

class FakeNavigationDatabase implements D1DatabaseLike {
  readonly rows: NavigationRow[];
  readonly audits = new Map<string, BulkAudit>();
  readonly createAudits = new Map<string, CreateAudit>();
  readonly singleAudits = new Map<string, SingleAudit>();
  readonly items: BulkAuditItem[] = [];
  batchCalls = 0;
  navigationAuditCount = 0;
  readonly skipUpdateIds = new Set<string>();
  failOnQuery: string | null = null;

  constructor(rows: NavigationRow[]) {
    this.rows = rows;
  }

  prepare(query: string): D1PreparedStatementLike {
    return new FakeNavigationStatement(this, query);
  }

  async batch(statements: D1PreparedStatementLike[]): Promise<unknown[]> {
    this.batchCalls++;
    const snapshot = structuredClone({ audits: [...this.audits.entries()], createAudits: [...this.createAudits.entries()], items: this.items, navigationAuditCount: this.navigationAuditCount, rows: this.rows, singleAudits: [...this.singleAudits.entries()] });
    try {
      const results: unknown[] = [];
      for (const statement of statements) {
        results.push(await (statement as FakeNavigationStatement).execute());
      }
      return results;
    } catch (error) {
      this.audits.clear();
      snapshot.audits.forEach(([key, value]) => this.audits.set(key, value));
      this.createAudits.clear();
      snapshot.createAudits.forEach(([key, value]) => this.createAudits.set(key, value));
      this.singleAudits.clear();
      snapshot.singleAudits.forEach(([key, value]) => this.singleAudits.set(key, value));
      this.items.splice(0, this.items.length, ...snapshot.items);
      this.navigationAuditCount = snapshot.navigationAuditCount;
      this.rows.splice(0, this.rows.length, ...snapshot.rows);
      throw error;
    }
  }
}

class FakeNavigationStatement implements D1PreparedStatementLike {
  private values: unknown[] = [];
  private readonly database: FakeNavigationDatabase;
  private readonly query: string;

  constructor(database: FakeNavigationDatabase, query: string) {
    this.database = database;
    this.query = query;
  }

  bind(...values: unknown[]): D1PreparedStatementLike {
    this.values = values;
    return this;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
    if (this.query.includes("FROM admin_navigation_audit")) {
      return {
        results: this.database.items
          .filter((item) => item.bulk_request_id === String(this.values[0]))
          .map((item) => ({ navigation_id: item.navigation_id }) as T),
      };
    }
    if (this.query.includes("draft_label <> published_label")) {
      return {
        results: this.database.rows
          .filter((row) => row.draft_label !== row.published_label
            || row.draft_href !== row.published_href
            || row.draft_sort_order !== row.published_sort_order
            || row.draft_is_active !== row.published_is_active)
          .slice()
          .sort((left, right) => left.menu_key.localeCompare(right.menu_key)
            || left.draft_sort_order - right.draft_sort_order
            || left.id.localeCompare(right.id))
          .slice(0, 101)
          .map((row) => ({ ...row }) as T),
      };
    }
    if (this.query.includes("FROM site_navigation_items")) {
      return { results: this.database.rows.map((row) => ({ ...row }) as T) };
    }
    throw new Error(`Unexpected all query: ${this.query}`);
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    if (this.query.includes("FROM admin_navigation_bulk_audit")) {
      return (this.database.audits.get(String(this.values[0])) ?? null) as T | null;
    }
    if (this.query.includes("FROM admin_navigation_create_audit")) {
      return (this.database.createAudits.get(String(this.values[0])) ?? null) as T | null;
    }
    if (this.query.includes("FROM admin_navigation_audit")) {
      return (this.database.singleAudits.get(String(this.values[0])) ?? null) as T | null;
    }
    if (this.query.includes("FROM site_navigation_items")) {
      return (this.database.rows.find((row) => row.id === String(this.values[0])) ?? null) as T | null;
    }
    throw new Error(`Unexpected first query: ${this.query}`);
  }

  async run(): Promise<unknown> {
    return this.execute();
  }

  async execute(): Promise<unknown> {
    if (this.database.failOnQuery && this.query.includes(this.database.failOnQuery)) {
      throw new Error("forced fake D1 failure");
    }
    if (this.query.includes("INSERT INTO site_navigation_items")) {
      const [id, menuKey, capturedMenuId, draftLabel, draftHref, draftSortOrder, draftIsActive, publishedLabel, publishedHref, publishedSortOrder, publishedIsActive, updatedBy, lastRequestId] = this.values;
      this.database.rows.push({
        id: String(id),
        menu_key: String(menuKey) as "primary" | "footer",
        captured_menu_id: (capturedMenuId as string | null) ?? null,
        draft_label: String(draftLabel),
        draft_href: String(draftHref),
        draft_sort_order: Number(draftSortOrder),
        draft_is_active: Number(draftIsActive),
        published_label: String(publishedLabel),
        published_href: String(publishedHref),
        published_sort_order: Number(publishedSortOrder),
        published_is_active: Number(publishedIsActive),
        version: 1,
        updated_by: String(updatedBy),
        updated_at: "2026-09-01T00:00:00.000Z",
        published_by: null,
        published_at: null,
        last_request_id: String(lastRequestId),
      });
      return { meta: { changes: 1 } };
    }
    if (this.query.includes("INSERT INTO admin_navigation_create_audit")) {
      const [requestId, actorSubject, entityKey, payloadSha256] = this.values;
      this.database.createAudits.set(String(requestId), {
        entity_key: String(entityKey),
        operation: "create",
        payload_sha256: String(payloadSha256),
      });
      return { meta: { changes: 1 } };
    }
    if (this.query.includes("INSERT INTO admin_navigation_audit")) {
      if (this.query.includes("SELECT ?, ?, 'update', ?, 'site_navigation'")) {
        const [requestId, , operation, previousRevision, payloadSha256, navigationId, resultingRevision, marker] = this.values;
        const row = this.database.rows.find((candidate) => candidate.id === String(navigationId));
        if (!row || row.last_request_id !== String(marker)
          || row.version !== Number(resultingRevision)
          || Number(resultingRevision) !== Number(previousRevision) + 1) return { meta: { changes: 0 } };
        this.database.singleAudits.set(String(requestId), {
          entity_key: row.id,
          operation: String(operation) as "draft" | "publish",
          payload_sha256: String(payloadSha256),
        });
        return { meta: { changes: 1 } };
      }
      const [, , previousRevision, , bulkRequestId, navigationId, resultingRevision, itemRequestId] = this.values;
      const row = this.database.rows.find((candidate) => candidate.id === String(navigationId));
      if (!row || row.last_request_id !== String(itemRequestId)
        || row.version !== Number(resultingRevision)
        || Number(resultingRevision) !== Number(previousRevision) + 1) return { meta: { changes: 0 } };
      this.database.items.push({ bulk_request_id: String(bulkRequestId), navigation_id: row.id });
      this.database.navigationAuditCount++;
      return { meta: { changes: 1 } };
    }
    if (this.query.includes("INSERT INTO admin_navigation_bulk_audit (")) {
      const [requestId, , payloadSha256, selectedCount] = this.values;
      this.database.audits.set(String(requestId), {
        operation: "publish_all",
        payload_sha256: String(payloadSha256),
        published_count: 0,
        selected_count: Number(selectedCount),
        selected_ids_json: String(this.values[4]),
      });
      return { meta: { changes: 1 } };
    }
    if (this.query.includes("UPDATE site_navigation_items")) {
      if (this.values.length === 8) {
        const [draftLabel, draftHref, draftSortOrder, draftIsActive, actorSubject, requestId, navigationId, expectedVersion] = this.values;
        const row = this.database.rows.find((candidate) => candidate.id === String(navigationId));
        if (!row || this.database.skipUpdateIds.has(row.id) || row.version !== Number(expectedVersion)) return { meta: { changes: 0 } };
        row.draft_label = String(draftLabel);
        row.draft_href = String(draftHref);
        row.draft_sort_order = Number(draftSortOrder);
        row.draft_is_active = Number(draftIsActive);
        row.version += 1;
        row.updated_by = String(actorSubject);
        row.last_request_id = String(requestId);
        return { meta: { changes: 1 } };
      }
      const [, , itemRequestId, navigationId, expectedVersion] = this.values;
      const row = this.database.rows.find((candidate) => candidate.id === String(navigationId));
      if (!row || this.database.skipUpdateIds.has(row.id) || row.version !== Number(expectedVersion)) return { meta: { changes: 0 } };
      row.published_label = row.draft_label;
      row.published_href = row.draft_href;
      row.published_sort_order = row.draft_sort_order;
      row.published_is_active = row.draft_is_active;
      row.version += 1;
      row.last_request_id = String(itemRequestId);
      return { meta: { changes: 1 } };
    }
    if (this.query.includes("UPDATE admin_navigation_bulk_audit")) {
      const [requestId] = this.values;
      const audit = this.database.audits.get(String(requestId));
      if (!audit) return { meta: { changes: 0 } };
      audit.published_count = this.database.items.filter((item) => item.bulk_request_id === String(requestId)).length;
      return { meta: { changes: 1 } };
    }
    throw new Error(`Unexpected execute query: ${this.query}`);
  }
}
