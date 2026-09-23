import { cache } from "react";
import { unstable_cache } from "next/cache.js";
import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getLegacyMegaMenuItem, legacyMegaMenuItems } from "../data/legacy-mega-menu.ts";
import type { D1DatabaseLike, D1PreparedStatementLike } from "./admin-data";

export type NavigationMenuKey = "primary" | "footer";

export interface PublishedNavigationItem {
  id: string;
  capturedMenuId: string | null;
  parentId?: string | null;
  href: string;
  isActive: boolean;
  label: string;
  menuKey: NavigationMenuKey;
  sortOrder: number;
}

export interface AdminNavigationItem {
  id: string;
  capturedMenuId: string | null;
  draftParentId?: string | null;
  draftHref: string;
  draftIsActive: boolean;
  draftLabel: string;
  draftSortOrder: number;
  publishedHref: string;
  publishedParentId?: string | null;
  publishedIsActive: boolean;
  publishedLabel: string;
  publishedSortOrder: number;
  menuKey: NavigationMenuKey;
  version: number;
  updatedBy: string | null;
  updatedAt: string;
  publishedBy: string | null;
  publishedAt: string | null;
  dirty: boolean;
  virtual?: boolean;
}

export const MAX_NAVIGATION_BULK_ITEMS = 100;
const MAX_NAVIGATION_RENDER_DEPTH = 64;
const legacyMegaMenuSqlIds = legacyMegaMenuItems
  .map((item) => `'${item.id.replace(/'/g, "''")}'`)
  .join(", ");

export type AdminNavigationBulkSkipReason = "stale";

export interface AdminNavigationBulkSkip {
  id: string;
  reason: AdminNavigationBulkSkipReason;
}

export interface AdminNavigationBulkResult {
  changedCount: number;
  published: AdminNavigationItem[];
  selectedCount: number;
  skipped: AdminNavigationBulkSkip[];
}

export class SiteNavigationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SiteNavigationValidationError";
  }
}

export class SiteNavigationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SiteNavigationConflictError";
  }
}

export class SiteNavigationNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SiteNavigationNotFoundError";
  }
}

export const defaultPrimaryNavigation: readonly PublishedNavigationItem[] = [
  { id: "home", capturedMenuId: "menu-item-4618", href: "/", isActive: true, label: "Home", menuKey: "primary", parentId: null, sortOrder: 10 },
  { id: "about", capturedMenuId: "menu-item-5498", href: "/gioi-thieu-ve-gia-cong/", isActive: true, label: "Về Kienhieu", menuKey: "primary", parentId: null, sortOrder: 20 },
  { id: "products", capturedMenuId: "menu-item-1742", href: "/san-pham/", isActive: true, label: "Mua hàng", menuKey: "primary", parentId: null, sortOrder: 30 },
  { id: "services", capturedMenuId: "menu-item-5166", href: "/thue-gia-cong/", isActive: true, label: "Thuê gia công", menuKey: "primary", parentId: null, sortOrder: 40 },
  { id: "news", capturedMenuId: "menu-item-1541", href: "/tin-tuc/", isActive: true, label: "Tin tức", menuKey: "primary", parentId: null, sortOrder: 50 },
  { id: "contact", capturedMenuId: "menu-item-1542", href: "/lien-he/", isActive: true, label: "Liên hệ", menuKey: "primary", parentId: null, sortOrder: 60 },
];

const capturedNavigationAliases: Readonly<Record<string, readonly string[]>> = {
  "menu-item-4618": ["menu-item-5465"],
  "menu-item-5498": ["menu-item-5496"],
  "menu-item-1742": ["menu-item-5467"],
  "menu-item-5166": ["menu-item-5466"],
  "menu-item-1541": ["menu-item-5477"],
  "menu-item-1542": ["menu-item-5478"],
};

export async function listAdminSiteNavigation(database: D1DatabaseLike): Promise<AdminNavigationItem[]> {
  const rows = await database.prepare(`
    SELECT id, menu_key, captured_menu_id,
      draft_label, draft_href, draft_sort_order, draft_is_active,
      draft_parent_id,
      published_label, published_href, published_sort_order, published_is_active,
      published_parent_id,
      version, updated_by, updated_at, published_by, published_at, last_request_id
    FROM site_navigation_items
    ORDER BY menu_key ASC, draft_sort_order ASC, id ASC
    LIMIT 100
  `).all<SiteNavigationRow>();
  return mergeLegacyMegaMenuItems(rows.results.map(toAdminNavigationItem));
}

async function listAdminSiteNavigationByIds(
  database: D1DatabaseLike,
  ids: readonly string[],
): Promise<AdminNavigationItem[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(", ");
  const rows = await database.prepare(`
    SELECT id, menu_key, captured_menu_id,
      draft_label, draft_href, draft_sort_order, draft_is_active,
      draft_parent_id,
      published_label, published_href, published_sort_order, published_is_active,
      published_parent_id,
      version, updated_by, updated_at, published_by, published_at, last_request_id
    FROM site_navigation_items
    WHERE id IN (${placeholders})
    ORDER BY menu_key ASC, draft_sort_order ASC, id ASC
    LIMIT ${MAX_NAVIGATION_BULK_ITEMS}
  `).bind(...ids).all<SiteNavigationRow>();
  return rows.results.map(toAdminNavigationItem);
}

async function listAdminSiteNavigationGraph(database: D1DatabaseLike): Promise<AdminNavigationItem[]> {
  const rows = await database.prepare(`
    SELECT id, menu_key, captured_menu_id,
      draft_label, draft_href, draft_sort_order, draft_is_active,
      draft_parent_id,
      published_label, published_href, published_sort_order, published_is_active,
      published_parent_id,
      version, updated_by, updated_at, published_by, published_at, last_request_id
    FROM site_navigation_items
  `).all<SiteNavigationRow>();
  return rows.results.map(toAdminNavigationItem);
}

export async function getAdminSiteNavigation(
  database: D1DatabaseLike,
  id: string,
): Promise<AdminNavigationItem | null> {
  const normalizedId = normalizeNavigationId(id);
  const row = await database.prepare(`
    SELECT id, menu_key, captured_menu_id,
      draft_label, draft_href, draft_sort_order, draft_is_active,
      draft_parent_id,
      published_label, published_href, published_sort_order, published_is_active,
      published_parent_id,
      version, updated_by, updated_at, published_by, published_at, last_request_id
    FROM site_navigation_items
    WHERE id = ?
    LIMIT 1
  `).bind(normalizedId).first<SiteNavigationRow>();
  return row ? toAdminNavigationItem(row) : null;
}

export async function createAdminSiteNavigation(
  database: D1DatabaseLike,
  input: {
    actorSubject: string;
    capturedMenuId?: unknown;
    href: unknown;
    isActive?: unknown;
    label: unknown;
    menuKey: unknown;
    parentId?: unknown;
    requestId: string;
    sortOrder?: unknown;
  },
): Promise<AdminNavigationItem> {
  const menuKey = normalizeMenuKey(input.menuKey);
  const label = normalizeText(input.label, "label", 120);
  const href = normalizeHref(input.href);
  const capturedMenuId = normalizeCapturedMenuId(input.capturedMenuId);
  const parentId = normalizeOptionalNavigationId(input.parentId);
  const sortOrder = normalizeSortOrder(input.sortOrder);
  const isActive = normalizeBoolean(input.isActive, true);
  assertNavigationParentSemantics({ capturedMenuId, href, isActive, menuKey, parentId });
  const requestId = normalizeNavigationRequestId(input.requestId);
  const payloadSha256 = await fingerprintNavigationMutation({
    capturedMenuId,
    href,
    isActive,
    label,
    menuKey,
    parentId,
    operation: "create",
    sortOrder,
  });
  const postcondition: NavigationCreatePostcondition = {
    actorSubject: input.actorSubject,
    capturedMenuId,
    entityId: "",
    href,
    isActive,
    label,
    menuKey,
    parentId,
    payloadSha256,
    requestId,
    sortOrder,
  };
  const existingMutation = await findNavigationCreateMutation(database, requestId);
  if (existingMutation) {
    assertMatchingNavigationCreateMutation(existingMutation, payloadSha256);
    postcondition.entityId = existingMutation.entity_key;
    return readNavigationCreateMutationResult(database, existingMutation, postcondition);
  }
  const id = crypto.randomUUID();
  postcondition.entityId = id;
  await assertNavigationDraftTree(database, {
    id,
    parentId,
    menuKey,
    label,
    href,
    isActive,
    sortOrder,
  });

  const insert = database.prepare(`
    INSERT INTO site_navigation_items (
      id, menu_key, captured_menu_id,
      draft_label, draft_href, draft_sort_order, draft_is_active,
      published_label, published_href, published_sort_order, published_is_active,
      updated_by, last_request_id, draft_parent_id, published_parent_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    menuKey,
    capturedMenuId,
    label,
    href,
    sortOrder,
    isActive ? 1 : 0,
    label,
    href,
    sortOrder,
    0,
    input.actorSubject,
    requestId,
    parentId,
    null,
  );
  const audit = database.prepare(`
    INSERT INTO admin_navigation_create_audit (
      request_id, actor_subject, action, operation, entity_type, entity_key,
      previous_revision, resulting_revision, payload_sha256
    ) VALUES (?, ?, 'create', 'create', 'site_navigation', ?, 0, 1, ?)
  `).bind(requestId, input.actorSubject, id, payloadSha256);
  try {
    await applyAtomicNavigationMutation(
      database,
      insert,
      audit,
      buildNavigationGraphPostcondition(database, "draft"),
      buildNavigationCreatePostcondition(database, postcondition),
    );
  } catch (error) {
    const racedMutation = await findNavigationCreateMutation(database, requestId);
    if (racedMutation) {
      assertMatchingNavigationCreateMutation(racedMutation, payloadSha256);
      return readNavigationCreateMutationResult(database, racedMutation, postcondition);
    }
    throw normalizeNavigationWriteError(error);
  }
  const mutation = await findNavigationCreateMutation(database, requestId);
  if (!mutation) throw new SiteNavigationStorageError("Không đọc được audit mục điều hướng vừa tạo.");
  assertMatchingNavigationCreateMutation(mutation, payloadSha256);
  return readNavigationCreateMutationResult(database, mutation, postcondition);
}

export async function updateAdminSiteNavigation(
  database: D1DatabaseLike,
  input: {
    actorSubject: string;
    expectedVersion: number;
    href: unknown;
    id: string;
    isActive: unknown;
    label: unknown;
    parentId?: unknown;
    requestId: string;
    sortOrder: unknown;
  },
): Promise<AdminNavigationItem> {
  const id = normalizeNavigationId(input.id);
  const label = normalizeText(input.label, "label", 120);
  const href = normalizeHref(input.href);
  const sortOrder = normalizeSortOrder(input.sortOrder);
  const parentId = normalizeOptionalNavigationId(input.parentId);
  const isActive = normalizeBoolean(input.isActive);
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
    throw new SiteNavigationValidationError("expectedVersion không hợp lệ.");
  }
  const requestId = normalizeNavigationRequestId(input.requestId);
  const payloadSha256 = await fingerprintNavigationMutation({
    expectedVersion: input.expectedVersion,
    href,
    id,
    isActive,
    label,
    parentId,
    operation: "draft",
    sortOrder,
  });
  const postcondition: NavigationMutationPostcondition = {
    actorSubject: input.actorSubject,
    draftHref: href,
    draftIsActive: isActive,
    draftLabel: label,
    draftParentId: parentId,
    draftSortOrder: sortOrder,
    entityId: id,
    expectedVersion: input.expectedVersion,
    operation: "draft",
    payloadSha256,
    requestId,
  };
  const existingMutation = await findNavigationMutation(database, requestId);
  if (existingMutation) {
    assertMatchingNavigationMutation(existingMutation, "draft", payloadSha256);
    return readNavigationMutationResult(database, existingMutation, postcondition);
  }
  const current = await getAdminSiteNavigation(database, id);
  if (!current) throw new SiteNavigationNotFoundError("Không tìm thấy mục điều hướng.");
  if (current.version !== input.expectedVersion) {
    throw new SiteNavigationConflictError("Mục điều hướng đã thay đổi ở phiên khác. Hãy tải lại trước khi lưu.");
  }
  assertNavigationParentSemantics({ capturedMenuId: current.capturedMenuId, href, isActive, menuKey: current.menuKey, parentId });
  await assertNavigationDraftTree(database, {
    id,
    parentId,
    menuKey: current.menuKey,
    label,
    href,
    isActive,
    sortOrder,
  });

  const update = database.prepare(`
    UPDATE site_navigation_items
    SET draft_label = ?, draft_href = ?, draft_sort_order = ?, draft_is_active = ?, draft_parent_id = ?,
      version = version + 1, updated_by = ?, updated_at = CURRENT_TIMESTAMP,
      last_request_id = ?
    WHERE id = ? AND version = ?
  `).bind(
    label,
    href,
    sortOrder,
    isActive ? 1 : 0,
    parentId,
    input.actorSubject,
    requestId,
    id,
    input.expectedVersion,
  );
  const audit = buildNavigationAuditStatement(database, {
    actorSubject: input.actorSubject,
    entityId: id,
    expectedRevision: input.expectedVersion,
    operation: "draft",
    payloadSha256,
    requestId,
  });
  try {
    await applyAtomicNavigationMutation(
      database,
      update,
      audit,
      buildNavigationGraphPostcondition(database, "draft"),
      buildNavigationPostconditionAssertion(database, postcondition),
    );
  } catch (error) {
    const racedMutation = await findNavigationMutation(database, requestId);
    if (racedMutation) {
      assertMatchingNavigationMutation(racedMutation, "draft", payloadSha256);
      return readNavigationMutationResult(database, racedMutation, postcondition);
    }
    const latest = await getAdminSiteNavigation(database, id);
    if (latest && latest.version !== input.expectedVersion) {
      throw new SiteNavigationConflictError("Mục điều hướng đã thay đổi ở phiên khác. Hãy tải lại trước khi lưu.");
    }
    throw normalizeNavigationWriteError(error);
  }
  const mutation = await findNavigationMutation(database, requestId);
  if (!mutation) throw new SiteNavigationConflictError("Mục điều hướng đã thay đổi ở phiên khác. Hãy tải lại trước khi lưu.");
  assertMatchingNavigationMutation(mutation, "draft", payloadSha256);
  return readNavigationMutationResult(database, mutation, postcondition);
}

export async function publishAdminSiteNavigation(
  database: D1DatabaseLike,
  input: { actorSubject: string; expectedVersion: number; id: string; requestId: string },
): Promise<AdminNavigationItem> {
  const id = normalizeNavigationId(input.id);
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
    throw new SiteNavigationValidationError("expectedVersion không hợp lệ.");
  }
  const requestId = normalizeNavigationRequestId(input.requestId);
  const payloadSha256 = await fingerprintNavigationMutation({
    expectedVersion: input.expectedVersion,
    id,
    operation: "publish",
  });
  const postcondition: NavigationMutationPostcondition = {
    actorSubject: input.actorSubject,
    entityId: id,
    expectedVersion: input.expectedVersion,
    operation: "publish",
    payloadSha256,
    requestId,
  };
  const existingMutation = await findNavigationMutation(database, requestId);
  if (existingMutation) {
    assertMatchingNavigationMutation(existingMutation, "publish", payloadSha256);
    return readNavigationMutationResult(database, existingMutation, postcondition);
  }
  const current = await getAdminSiteNavigation(database, id);
  if (!current) throw new SiteNavigationNotFoundError("Không tìm thấy mục điều hướng.");
  if (current.version !== input.expectedVersion) {
    throw new SiteNavigationConflictError("Mục điều hướng đã thay đổi ở phiên khác. Hãy tải lại trước khi phát hành.");
  }

  const update = database.prepare(`
    UPDATE site_navigation_items
    SET published_label = draft_label, published_href = draft_href,
      published_sort_order = draft_sort_order, published_is_active = draft_is_active,
      published_parent_id = draft_parent_id,
      version = version + 1,
      published_by = ?, published_at = CURRENT_TIMESTAMP,
      updated_by = ?, updated_at = CURRENT_TIMESTAMP,
      last_request_id = ?
    WHERE id = ? AND version = ?
  `).bind(input.actorSubject, input.actorSubject, requestId, id, input.expectedVersion);
  const audit = buildNavigationAuditStatement(database, {
    actorSubject: input.actorSubject,
    entityId: id,
    expectedRevision: input.expectedVersion,
    operation: "publish",
    payloadSha256,
    requestId,
  });
  try {
    await applyAtomicNavigationMutation(
      database,
      update,
      audit,
      buildNavigationGraphPostcondition(database, "published"),
      buildNavigationPostconditionAssertion(database, postcondition),
    );
  } catch (error) {
    const racedMutation = await findNavigationMutation(database, requestId);
    if (racedMutation) {
      assertMatchingNavigationMutation(racedMutation, "publish", payloadSha256);
      return readNavigationMutationResult(database, racedMutation, postcondition);
    }
    const latest = await getAdminSiteNavigation(database, id);
    if (latest && latest.version !== input.expectedVersion) {
      throw new SiteNavigationConflictError("Mục điều hướng đã thay đổi ở phiên khác. Hãy tải lại trước khi phát hành.");
    }
    throw normalizeNavigationWriteError(error);
  }
  const mutation = await findNavigationMutation(database, requestId);
  if (!mutation) throw new SiteNavigationConflictError("Mục điều hướng đã thay đổi ở phiên khác. Hãy tải lại trước khi phát hành.");
  assertMatchingNavigationMutation(mutation, "publish", payloadSha256);
  return readNavigationMutationResult(database, mutation, postcondition);
}

export async function publishAllAdminSiteNavigation(
  database: D1DatabaseLike,
  input: { actorSubject: string; requestId?: string },
): Promise<AdminNavigationBulkResult> {
  const requestId = normalizeNavigationRequestId(input.requestId);
  const payloadSha256 = await fingerprintNavigationBulkPublish();
  const existingMutation = await findNavigationBulkMutation(database, requestId);
  if (existingMutation) {
    assertMatchingNavigationBulkMutation(existingMutation, payloadSha256);
    return readBulkNavigationResult(database, requestId, existingMutation);
  }

  const rows = await database.prepare(`
    SELECT id, menu_key, captured_menu_id,
      draft_label, draft_href, draft_sort_order, draft_is_active,
      draft_parent_id,
      published_label, published_href, published_sort_order, published_is_active,
      published_parent_id,
      version, updated_by, updated_at, published_by, published_at, last_request_id
    FROM site_navigation_items
    WHERE draft_label <> published_label
      OR draft_href <> published_href
      OR draft_sort_order <> published_sort_order
      OR draft_is_active <> published_is_active
      OR draft_parent_id IS NOT published_parent_id
    ORDER BY menu_key ASC, draft_sort_order ASC, id ASC
    LIMIT 101
  `).all<SiteNavigationRow>();
  if (rows.results.length > MAX_NAVIGATION_BULK_ITEMS) {
    throw new SiteNavigationBatchLimitError("Mỗi lần chỉ được phát hành tối đa 100 mục điều hướng.");
  }
  const selectedIdsJson = JSON.stringify(rows.results.map((row) => row.id));

  const statements: D1PreparedStatementLike[] = [database.prepare(`
    INSERT INTO admin_navigation_bulk_audit (
      request_id, actor_subject, action, operation, payload_sha256,
      selected_count, published_count, selected_ids_json
    ) VALUES (?, ?, 'update', 'publish_all', ?, ?, 0, ?)
  `).bind(requestId, input.actorSubject, payloadSha256, rows.results.length, selectedIdsJson)];

  for (const row of rows.results) {
    const itemRequestId = crypto.randomUUID();
    const itemPayloadSha256 = await fingerprintNavigationMutation({
      expectedVersion: row.version,
      id: row.id,
      operation: "publish",
    });
    statements.push(database.prepare(`
      UPDATE site_navigation_items
        SET published_label = draft_label, published_href = draft_href,
          published_sort_order = draft_sort_order, published_is_active = draft_is_active,
          published_parent_id = draft_parent_id,
          version = version + 1,
          published_by = ?, published_at = CURRENT_TIMESTAMP,
          updated_by = ?, updated_at = CURRENT_TIMESTAMP,
          last_request_id = ?
      WHERE id = ? AND version = ?
    `).bind(input.actorSubject, input.actorSubject, itemRequestId, row.id, row.version));
    statements.push(database.prepare(`
      INSERT INTO admin_navigation_audit (
        request_id, actor_subject, action, operation, entity_type, entity_key,
        previous_revision, resulting_revision, payload_sha256, bulk_request_id
      )
      SELECT ?, ?, 'update', 'publish', 'site_navigation', id,
        ?, version, ?, ?
      FROM site_navigation_items
      WHERE id = ? AND version = ? AND last_request_id = ?
    `).bind(
      itemRequestId,
      input.actorSubject,
      row.version,
      itemPayloadSha256,
      requestId,
      row.id,
      row.version + 1,
      itemRequestId,
    ));
    statements.push(buildNavigationBulkItemPostcondition(database, {
      actorSubject: input.actorSubject,
      bulkRequestId: requestId,
      entityId: row.id,
      expectedVersion: row.version,
      operation: "publish",
      payloadSha256: itemPayloadSha256,
      requestId: itemRequestId,
    }));
  }

  statements.push(database.prepare(`
    UPDATE admin_navigation_bulk_audit
    SET published_count = (
      SELECT COUNT(*) FROM admin_navigation_audit WHERE bulk_request_id = ?
    )
    WHERE request_id = ?
  `).bind(requestId, requestId));
  statements.push(buildNavigationGraphPostcondition(database, "published"));
  statements.push(buildNavigationBulkEnvelopePostcondition(database, {
    actorSubject: input.actorSubject,
    operation: "publish_all",
    payloadSha256,
    requestId,
    selectedCount: rows.results.length,
  }));

  const databaseWithBatch = database as D1DatabaseWithBatch;
  if (typeof databaseWithBatch.batch !== "function") {
    throw new SiteNavigationStorageError("D1 atomic batch chưa sẵn sàng cho bulk publish điều hướng.");
  }
  try {
    await databaseWithBatch.batch(statements);
  } catch (error) {
    const racedMutation = await findNavigationBulkMutation(database, requestId);
    if (racedMutation) {
      assertMatchingNavigationBulkMutation(racedMutation, payloadSha256);
      return readBulkNavigationResult(database, requestId, racedMutation);
    }
    throw normalizeNavigationWriteError(error);
  }

  const mutation = await findNavigationBulkMutation(database, requestId);
  if (!mutation) throw new SiteNavigationStorageError("Không đọc được audit bulk publish điều hướng vừa ghi.");
  return readBulkNavigationResult(database, requestId, mutation);
}

export class SiteNavigationStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SiteNavigationStorageError";
  }
}

export class SiteNavigationBatchLimitError extends SiteNavigationValidationError {
  constructor(message: string) {
    super(message);
    this.name = "SiteNavigationBatchLimitError";
  }
}

interface D1DatabaseWithBatch extends D1DatabaseLike {
  batch(statements: D1PreparedStatementLike[]): Promise<unknown[]>;
}

type NavigationMutationOperation = "draft" | "publish";

interface NavigationMutationPostcondition {
  actorSubject: string;
  draftHref?: string;
  draftIsActive?: boolean;
  draftLabel?: string;
  draftParentId?: string | null;
  draftSortOrder?: number;
  entityId: string;
  expectedVersion: number;
  operation: NavigationMutationOperation;
  payloadSha256: string;
  requestId: string;
}

interface NavigationCreatePostcondition {
  actorSubject: string;
  capturedMenuId: string | null;
  entityId: string;
  href: string;
  isActive: boolean;
  label: string;
  menuKey: NavigationMenuKey;
  parentId: string | null;
  payloadSha256: string;
  requestId: string;
  sortOrder: number;
}

export interface NavigationTreeItem {
  id: string;
  parentId: string | null;
  menuKey: NavigationMenuKey;
  label: string;
  href: string;
  isActive: boolean;
  sortOrder: number;
}

/** Validates and flattens the canonical parent/child model without changing legacy readers. */
export function validateNavigationTree(items: readonly NavigationTreeItem[]): NavigationTreeItem[] {
  const byId = new Map<string, NavigationTreeItem>();
  for (const item of items) {
    const id = normalizeNavigationId(item.id);
    if (byId.has(id)) throw new SiteNavigationValidationError("id điều hướng bị trùng.");
    const normalized = {
      ...item,
      id,
      parentId: item.parentId === null ? null : normalizeNavigationId(item.parentId),
      menuKey: normalizeMenuKey(item.menuKey),
      label: normalizeText(item.label, "label", 120),
      href: normalizeHref(item.href),
      sortOrder: normalizeSortOrder(item.sortOrder),
    };
    byId.set(id, normalized);
  }
  for (const item of byId.values()) {
    if (item.parentId === null) continue;
    const parent = byId.get(item.parentId);
    if (!parent) throw new SiteNavigationValidationError("Mục cha không tồn tại.");
    if (parent.menuKey !== item.menuKey) throw new SiteNavigationValidationError("Mục cha phải cùng vị trí menu.");
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(item: NavigationTreeItem): void {
    if (visiting.has(item.id)) throw new SiteNavigationValidationError("Cây menu có cycle.");
    if (visited.has(item.id)) return;
    visiting.add(item.id);
    if (item.parentId) visit(byId.get(item.parentId)!);
    visiting.delete(item.id);
    visited.add(item.id);
  }
  for (const item of byId.values()) visit(item);
  const children = new Map<string | null, NavigationTreeItem[]>();
  for (const item of byId.values()) children.set(item.parentId, [...(children.get(item.parentId) ?? []), item]);
  for (const siblings of children.values()) siblings.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const flattened: NavigationTreeItem[] = [];
  function append(parentId: string | null): void {
    for (const item of children.get(parentId) ?? []) { flattened.push(item); append(item.id); }
  }
  append(null);
  return flattened;
}

async function assertNavigationDraftTree(
  database: D1DatabaseLike,
  candidate: NavigationTreeItem,
): Promise<void> {
  const current = await listAdminSiteNavigationGraph(database);
  const next = current
    .filter((item) => item.id !== candidate.id)
    .map((item) => ({
      id: item.id,
      parentId: item.draftParentId ?? null,
      menuKey: item.menuKey,
      label: item.draftLabel,
      href: item.draftHref,
      isActive: item.draftIsActive,
      sortOrder: item.draftSortOrder,
    }));
  validateNavigationTree([...next, candidate]);
}

interface NavigationBulkItemPostcondition extends NavigationMutationPostcondition {
  bulkRequestId: string;
}

interface NavigationBulkEnvelopePostcondition {
  actorSubject: string;
  operation: "publish_all";
  payloadSha256: string;
  requestId: string;
  selectedCount: number;
}

interface NavigationMutationRow {
  entity_key: string;
  operation: NavigationMutationOperation;
  payload_sha256: string;
}

interface NavigationCreateMutationRow {
  entity_key: string;
  operation: "create";
  payload_sha256: string;
}

interface NavigationAuditStatementInput {
  actorSubject: string;
  entityId: string;
  expectedRevision: number;
  operation: NavigationMutationOperation;
  payloadSha256: string;
  requestId: string;
}

function buildNavigationAuditStatement(
  database: D1DatabaseLike,
  input: NavigationAuditStatementInput,
): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO admin_navigation_audit (
      request_id, actor_subject, action, operation, entity_type, entity_key,
      previous_revision, resulting_revision, payload_sha256, bulk_request_id
    )
    SELECT ?, ?, 'update', ?, 'site_navigation', id,
      ?, version, ?, NULL
    FROM site_navigation_items
    WHERE id = ? AND version = ? AND last_request_id = ?
  `).bind(
    input.requestId,
    input.actorSubject,
    input.operation,
    input.expectedRevision,
    input.payloadSha256,
    input.entityId,
    input.expectedRevision + 1,
    input.requestId,
  );
}

function buildNavigationGraphPostcondition(
  database: D1DatabaseLike,
  revision: "draft" | "published",
): D1PreparedStatementLike {
  const parentColumn = revision === "draft" ? "draft_parent_id" : "published_parent_id";
  return database.prepare(`
    /* navigation-${revision}-graph-postcondition */
    WITH RECURSIVE parent_chain(id, ancestor, path, cycle) AS (
      SELECT id, ${parentColumn}, '|' || id || '|', 0
      FROM site_navigation_items
      UNION ALL
      SELECT chain.id, parent.${parentColumn}, chain.path || parent.id || '|',
        CASE WHEN instr(chain.path, '|' || parent.id || '|') > 0 THEN 1 ELSE 0 END
      FROM parent_chain chain
      JOIN site_navigation_items parent ON parent.id = chain.ancestor
      WHERE chain.cycle = 0
    )
    INSERT INTO admin_navigation_audit (
      request_id, actor_subject, action, operation, entity_type, entity_key,
      previous_revision, resulting_revision, payload_sha256, bulk_request_id
    )
    SELECT NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
    WHERE EXISTS (
      SELECT 1
      FROM site_navigation_items child
      LEFT JOIN site_navigation_items parent ON parent.id = child.${parentColumn}
      WHERE child.${parentColumn} IS NOT NULL
        AND (
          parent.id IS NULL
          OR parent.menu_key <> child.menu_key
          OR (
            child.captured_menu_id IS NOT NULL
            AND NOT (
              child.menu_key = 'primary'
              AND child.${parentColumn} IN ('products', 'services')
              AND child.captured_menu_id IN (${legacyMegaMenuSqlIds})
            )
          )
          OR child.menu_key = 'footer'
        )
    )
    OR EXISTS (SELECT 1 FROM parent_chain WHERE cycle = 1)
  `);
}

async function applyAtomicNavigationMutation(
  database: D1DatabaseLike,
  update: D1PreparedStatementLike,
  audit: D1PreparedStatementLike,
  graphPostcondition: D1PreparedStatementLike,
  postcondition: D1PreparedStatementLike,
): Promise<void> {
  const databaseWithBatch = database as D1DatabaseWithBatch;
  if (typeof databaseWithBatch.batch !== "function") {
    throw new SiteNavigationStorageError("D1 atomic batch chưa sẵn sàng cho thay đổi điều hướng.");
  }
  try {
    await databaseWithBatch.batch([update, audit, graphPostcondition, postcondition]);
  } catch (error) {
    throw normalizeNavigationWriteError(error);
  }
}

async function ensureNavigationMutationComplete(
  database: D1DatabaseLike,
  postcondition: NavigationMutationPostcondition,
): Promise<void> {
  const { expression, values } = buildNavigationMutationPostconditionExpression(postcondition);
  const row = await database.prepare(`
    /* navigation-write-postcondition-read */
    SELECT CASE WHEN (${expression}) THEN 1 ELSE 0 END AS complete
  `).bind(...values).first<{ complete?: unknown }>();
  if (Number(row?.complete) !== 1) {
    throw new SiteNavigationStorageError(
      "Không thể xác nhận đầy đủ trạng thái mục điều hướng và audit; thao tác bị khóa để tránh báo thành công sai.",
    );
  }
}

function buildNavigationPostconditionAssertion(
  database: D1DatabaseLike,
  postcondition: NavigationMutationPostcondition,
): D1PreparedStatementLike {
  const { expression, values } = buildNavigationMutationPostconditionExpression(postcondition);
  return database.prepare(`
    /* navigation-write-postcondition */
    INSERT INTO admin_navigation_audit (
      request_id, actor_subject, action, operation, entity_type, entity_key,
      previous_revision, resulting_revision, payload_sha256, bulk_request_id
    )
    SELECT NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
    WHERE NOT (${expression})
  `).bind(...values);
}

async function ensureNavigationCreateMutationComplete(
  database: D1DatabaseLike,
  postcondition: NavigationCreatePostcondition,
): Promise<void> {
  const { expression, values } = buildNavigationCreatePostconditionExpression(postcondition);
  const row = await database.prepare(`
    /* navigation-write-postcondition-read */
    SELECT CASE WHEN (${expression}) THEN 1 ELSE 0 END AS complete
  `).bind(...values).first<{ complete?: unknown }>();
  if (Number(row?.complete) !== 1) {
    throw new SiteNavigationStorageError(
      "Không thể xác nhận đầy đủ trạng thái mục điều hướng mới và audit; thao tác bị khóa để tránh báo thành công sai.",
    );
  }
}

function buildNavigationCreatePostcondition(
  database: D1DatabaseLike,
  postcondition: NavigationCreatePostcondition,
): D1PreparedStatementLike {
  const { expression, values } = buildNavigationCreatePostconditionExpression(postcondition);
  return database.prepare(`
    /* navigation-write-postcondition */
    INSERT INTO admin_navigation_create_audit (
      request_id, actor_subject, action, operation, entity_type, entity_key,
      previous_revision, resulting_revision, payload_sha256
    )
    SELECT NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
    WHERE NOT (${expression})
  `).bind(...values);
}

function buildNavigationBulkItemPostcondition(
  database: D1DatabaseLike,
  postcondition: NavigationBulkItemPostcondition,
): D1PreparedStatementLike {
  return database.prepare(`
    /* navigation-bulk-postcondition */
    INSERT INTO admin_navigation_audit (
      request_id, actor_subject, action, operation, entity_type, entity_key,
      previous_revision, resulting_revision, payload_sha256, bulk_request_id
    )
    SELECT NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
    WHERE NOT (
      EXISTS (
        SELECT 1
        FROM admin_navigation_audit marker
        JOIN site_navigation_items navigation_row ON navigation_row.id = marker.entity_key
        WHERE marker.request_id = ?
          AND marker.actor_subject = ?
          AND marker.action = 'update'
          AND marker.operation = 'publish'
          AND marker.entity_type = 'site_navigation'
          AND marker.entity_key = ?
          AND marker.previous_revision = ?
          AND marker.resulting_revision = ?
          AND marker.payload_sha256 = ?
          AND marker.bulk_request_id = ?
          AND navigation_row.version = ?
          AND navigation_row.last_request_id = ?
          AND navigation_row.published_label = navigation_row.draft_label
          AND navigation_row.published_href = navigation_row.draft_href
          AND navigation_row.published_sort_order = navigation_row.draft_sort_order
          AND navigation_row.published_is_active = navigation_row.draft_is_active
          AND navigation_row.published_parent_id IS navigation_row.draft_parent_id
          AND navigation_row.published_by = ?
          AND navigation_row.published_at IS NOT NULL
      )
      OR (
        NOT EXISTS (
          SELECT 1 FROM admin_navigation_audit marker
          WHERE marker.request_id = ?
        )
        AND NOT EXISTS (
          SELECT 1 FROM site_navigation_items navigation_row
          WHERE navigation_row.id = ?
            AND navigation_row.version = ?
            AND navigation_row.last_request_id = ?
        )
      )
    )
  `).bind(
    postcondition.requestId,
    postcondition.actorSubject,
    postcondition.entityId,
    postcondition.expectedVersion,
    postcondition.expectedVersion + 1,
    postcondition.payloadSha256,
    postcondition.bulkRequestId,
    postcondition.expectedVersion + 1,
    postcondition.requestId,
    postcondition.actorSubject,
    postcondition.requestId,
    postcondition.entityId,
    postcondition.expectedVersion + 1,
    postcondition.requestId,
  );
}

function buildNavigationBulkEnvelopePostcondition(
  database: D1DatabaseLike,
  postcondition: NavigationBulkEnvelopePostcondition,
): D1PreparedStatementLike {
  return database.prepare(`
    /* navigation-bulk-postcondition */
    INSERT INTO admin_navigation_bulk_audit (
      request_id, actor_subject, action, operation, payload_sha256,
      selected_count, published_count, selected_ids_json
    )
    SELECT NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
    WHERE NOT (
      EXISTS (
        SELECT 1
        FROM admin_navigation_bulk_audit envelope
        WHERE envelope.request_id = ?
          AND envelope.actor_subject = ?
          AND envelope.action = 'update'
          AND envelope.operation = 'publish_all'
          AND envelope.payload_sha256 = ?
          AND envelope.selected_count = ?
      )
      AND (
        SELECT COUNT(*)
        FROM admin_navigation_audit item
        WHERE item.bulk_request_id = ?
          AND item.action = 'update'
          AND item.operation = 'publish'
          AND item.entity_type = 'site_navigation'
      ) = (
        SELECT envelope.published_count
        FROM admin_navigation_bulk_audit envelope
        WHERE envelope.request_id = ?
      )
      AND NOT EXISTS (
        SELECT 1
        FROM admin_navigation_audit item
        LEFT JOIN site_navigation_items navigation_row ON navigation_row.id = item.entity_key
        WHERE item.bulk_request_id = ?
          AND (
            item.actor_subject <> ?
            OR item.action <> 'update'
            OR item.operation <> 'publish'
            OR item.entity_type <> 'site_navigation'
            OR item.previous_revision < 1
            OR item.resulting_revision <> item.previous_revision + 1
            OR navigation_row.id IS NULL
            OR navigation_row.version <> item.resulting_revision
            OR navigation_row.last_request_id <> item.request_id
            OR navigation_row.draft_label <> navigation_row.published_label
            OR navigation_row.draft_href <> navigation_row.published_href
            OR navigation_row.draft_sort_order <> navigation_row.published_sort_order
            OR navigation_row.draft_is_active <> navigation_row.published_is_active
            OR navigation_row.published_by <> item.actor_subject
            OR navigation_row.published_at IS NULL
          )
      )
    )
  `).bind(
    postcondition.requestId,
    postcondition.actorSubject,
    postcondition.payloadSha256,
    postcondition.selectedCount,
    postcondition.requestId,
    postcondition.requestId,
    postcondition.requestId,
    postcondition.actorSubject,
  );
}

function buildNavigationMutationPostconditionExpression(
  postcondition: NavigationMutationPostcondition,
): { expression: string; values: unknown[] } {
  const contentCheck = postcondition.operation === "draft"
    ? `
          AND navigation_row.draft_label = ?
          AND navigation_row.draft_href = ?
          AND navigation_row.draft_sort_order = ?
          AND navigation_row.draft_is_active = ?
          AND navigation_row.draft_parent_id IS ?
      `
    : `
          AND navigation_row.published_label = navigation_row.draft_label
          AND navigation_row.published_href = navigation_row.draft_href
          AND navigation_row.published_sort_order = navigation_row.draft_sort_order
          AND navigation_row.published_is_active = navigation_row.draft_is_active
          AND navigation_row.published_parent_id IS navigation_row.draft_parent_id
          AND navigation_row.published_by = ?
          AND navigation_row.published_at IS NOT NULL
      `;
  const contentValues = postcondition.operation === "draft"
    ? [
      postcondition.draftLabel ?? "",
      postcondition.draftHref ?? "",
      postcondition.draftSortOrder ?? 0,
      postcondition.draftIsActive ? 1 : 0,
      postcondition.draftParentId ?? null,
    ]
    : [postcondition.actorSubject];
  return {
    expression: `
      EXISTS (
        SELECT 1
        FROM admin_navigation_audit marker
        JOIN site_navigation_items navigation_row ON navigation_row.id = marker.entity_key
        WHERE marker.request_id = ?
          AND marker.actor_subject = ?
          AND marker.action = 'update'
          AND marker.operation = ?
          AND marker.entity_type = 'site_navigation'
          AND marker.entity_key = ?
          AND marker.previous_revision = ?
          AND marker.resulting_revision = ?
          AND marker.payload_sha256 = ?
          AND marker.bulk_request_id IS NULL
          AND navigation_row.version = ?
          AND navigation_row.last_request_id = ?
          ${contentCheck}
      )
    `,
    values: [
      postcondition.requestId,
      postcondition.actorSubject,
      postcondition.operation,
      postcondition.entityId,
      postcondition.expectedVersion,
      postcondition.expectedVersion + 1,
      postcondition.payloadSha256,
      postcondition.expectedVersion + 1,
      postcondition.requestId,
      ...contentValues,
    ],
  };
}

function buildNavigationCreatePostconditionExpression(
  postcondition: NavigationCreatePostcondition,
): { expression: string; values: unknown[] } {
  return {
    expression: `
      EXISTS (
        SELECT 1
        FROM admin_navigation_create_audit marker
        JOIN site_navigation_items navigation_row ON navigation_row.id = marker.entity_key
        WHERE marker.request_id = ?
          AND marker.actor_subject = ?
          AND marker.action = 'create'
          AND marker.operation = 'create'
          AND marker.entity_type = 'site_navigation'
          AND marker.entity_key = ?
          AND marker.previous_revision = 0
          AND marker.resulting_revision = 1
          AND marker.payload_sha256 = ?
          AND navigation_row.id = ?
          AND navigation_row.menu_key = ?
          AND navigation_row.captured_menu_id IS ?
          AND navigation_row.version = 1
          AND navigation_row.updated_by = ?
          AND navigation_row.last_request_id = ?
          AND navigation_row.draft_label = ?
          AND navigation_row.draft_href = ?
          AND navigation_row.draft_sort_order = ?
          AND navigation_row.draft_is_active = ?
          AND navigation_row.draft_parent_id IS ?
          AND navigation_row.published_label = navigation_row.draft_label
          AND navigation_row.published_href = navigation_row.draft_href
          AND navigation_row.published_sort_order = navigation_row.draft_sort_order
          AND navigation_row.published_is_active = 0
          AND navigation_row.published_parent_id IS NULL
      )
    `,
    values: [
      postcondition.requestId,
      postcondition.actorSubject,
      postcondition.entityId,
      postcondition.payloadSha256,
      postcondition.entityId,
      postcondition.menuKey,
      postcondition.capturedMenuId,
      postcondition.actorSubject,
      postcondition.requestId,
      postcondition.label,
      postcondition.href,
      postcondition.sortOrder,
      postcondition.isActive ? 1 : 0,
      postcondition.parentId,
    ],
  };
}

async function findNavigationMutation(
  database: D1DatabaseLike,
  requestId: string,
): Promise<NavigationMutationRow | null> {
  return database.prepare(`
    SELECT entity_key, operation, payload_sha256
    FROM admin_navigation_audit
    WHERE request_id = ? AND bulk_request_id IS NULL
    LIMIT 1
  `).bind(requestId).first<NavigationMutationRow>();
}

async function findNavigationCreateMutation(
  database: D1DatabaseLike,
  requestId: string,
): Promise<NavigationCreateMutationRow | null> {
  return database.prepare(`
    SELECT entity_key, operation, payload_sha256
    FROM admin_navigation_create_audit
    WHERE request_id = ?
    LIMIT 1
  `).bind(requestId).first<NavigationCreateMutationRow>();
}

function assertMatchingNavigationMutation(
  mutation: NavigationMutationRow,
  operation: NavigationMutationOperation,
  payloadSha256: string,
): void {
  if (mutation.operation !== operation || mutation.payload_sha256 !== payloadSha256) {
    throw new SiteNavigationIdempotencyConflictError("requestId đã được dùng cho một payload điều hướng khác.");
  }
}

async function readNavigationMutationResult(
  database: D1DatabaseLike,
  mutation: NavigationMutationRow,
  postcondition: NavigationMutationPostcondition,
): Promise<AdminNavigationItem> {
  await ensureNavigationMutationComplete(database, postcondition);
  const item = await getAdminSiteNavigation(database, mutation.entity_key);
  if (!item) throw new SiteNavigationStorageError("Không đọc được mục điều hướng sau khi replay.");
  if (item.version !== postcondition.expectedVersion + 1) {
    throw new SiteNavigationStorageError("Revision mục điều hướng không khớp sau khi ghi.");
  }
  return item;
}

function assertMatchingNavigationCreateMutation(
  mutation: NavigationCreateMutationRow,
  payloadSha256: string,
): void {
  if (mutation.operation !== "create" || mutation.payload_sha256 !== payloadSha256) {
    throw new SiteNavigationIdempotencyConflictError("requestId đã được dùng cho một payload điều hướng khác.");
  }
}

async function readNavigationCreateMutationResult(
  database: D1DatabaseLike,
  mutation: NavigationCreateMutationRow,
  postcondition: NavigationCreatePostcondition,
): Promise<AdminNavigationItem> {
  await ensureNavigationCreateMutationComplete(database, postcondition);
  const item = await getAdminSiteNavigation(database, mutation.entity_key);
  if (!item) throw new SiteNavigationStorageError("Không đọc được mục điều hướng sau khi replay.");
  const shouldBeDirty = postcondition.isActive || postcondition.parentId !== null;
  if (item.version !== 1 || item.publishedIsActive || item.publishedParentId !== null || item.dirty !== shouldBeDirty) {
    throw new SiteNavigationStorageError("Trạng thái mục điều hướng mới tạo không khớp sau khi ghi.");
  }
  return item;
}

interface NavigationBulkMutationRow {
  actor_subject: string;
  operation: "publish_all";
  payload_sha256: string;
  published_count: number;
  selected_count: number;
  selected_ids_json: string;
}

interface NavigationBulkAuditItemRow {
  navigation_id: string;
  request_id: string;
  previous_revision: number;
  resulting_revision: number;
  payload_sha256: string;
  version: number;
  last_request_id: string | null;
  draft_label: string;
  draft_href: string;
  draft_sort_order: number;
  draft_is_active: number;
  draft_parent_id: string | null;
  published_label: string;
  published_href: string;
  published_sort_order: number;
  published_is_active: number;
  published_parent_id: string | null;
  published_by: string | null;
  published_at: string | null;
}

async function findNavigationBulkMutation(
  database: D1DatabaseLike,
  requestId: string,
): Promise<NavigationBulkMutationRow | null> {
  return database.prepare(`
    SELECT actor_subject, operation, payload_sha256, selected_count, published_count, selected_ids_json
    FROM admin_navigation_bulk_audit
    WHERE request_id = ?
    LIMIT 1
  `).bind(requestId).first<NavigationBulkMutationRow>();
}

function assertMatchingNavigationBulkMutation(
  mutation: NavigationBulkMutationRow,
  payloadSha256: string,
): void {
  if (mutation.operation !== "publish_all" || mutation.payload_sha256 !== payloadSha256) {
    throw new SiteNavigationIdempotencyConflictError("requestId đã được dùng cho một payload điều hướng khác.");
  }
}

async function readBulkNavigationResult(
  database: D1DatabaseLike,
  requestId: string,
  mutation: NavigationBulkMutationRow,
): Promise<AdminNavigationBulkResult> {
  const auditRows = await database.prepare(`
    SELECT audit.entity_key AS navigation_id,
      audit.request_id, audit.previous_revision, audit.resulting_revision, audit.payload_sha256,
      navigation_row.version, navigation_row.last_request_id,
      navigation_row.draft_label, navigation_row.draft_href,
      navigation_row.draft_sort_order, navigation_row.draft_is_active,
      navigation_row.draft_parent_id,
      navigation_row.published_label, navigation_row.published_href,
      navigation_row.published_sort_order, navigation_row.published_is_active,
      navigation_row.published_parent_id,
      navigation_row.published_by, navigation_row.published_at
    FROM admin_navigation_audit audit
    JOIN site_navigation_items navigation_row ON navigation_row.id = audit.entity_key
    WHERE audit.bulk_request_id = ?
      AND audit.action = 'update'
      AND audit.operation = 'publish'
      AND audit.entity_type = 'site_navigation'
    ORDER BY audit.id ASC
  `).bind(requestId).all<NavigationBulkAuditItemRow>();
  if (auditRows.results.length !== mutation.published_count) {
    throw new SiteNavigationStorageError("Bulk audit điều hướng không khớp số mục đã phát hành.");
  }
  const invalidAudit = auditRows.results.some((row) => (
    !isAdminRequestId(row.request_id)
    || !isSha256(row.payload_sha256)
    || row.previous_revision < 1
    || row.resulting_revision !== row.previous_revision + 1
    || row.version !== row.resulting_revision
    || row.last_request_id !== row.request_id
    || row.draft_label !== row.published_label
    || row.draft_href !== row.published_href
    || row.draft_sort_order !== row.published_sort_order
    || row.draft_is_active !== row.published_is_active
    || row.draft_parent_id !== row.published_parent_id
    || row.published_by !== mutation.actor_subject
    || row.published_at === null
  ));
  if (invalidAudit) {
    throw new SiteNavigationStorageError("Bulk publish có audit hoặc revision mục điều hướng không hợp lệ.");
  }

  const selectedIds = parseNavigationBulkSelectedIds(mutation.selected_ids_json, mutation.selected_count);
  const navigationItems = await listAdminSiteNavigationByIds(
    database,
    auditRows.results.map((row) => row.navigation_id),
  );
  const navigationById = new Map(navigationItems.map((item) => [item.id, item]));
  const published = auditRows.results.map((row) => navigationById.get(row.navigation_id) ?? null);
  if (published.some((item): item is null => item === null)) {
    throw new SiteNavigationStorageError("Không đọc được mục điều hướng vừa phát hành trong bulk.");
  }
  const publishedIds = new Set(auditRows.results.map((row) => row.navigation_id));
  const skipped = selectedIds
    .filter((id) => !publishedIds.has(id))
    .map((id) => ({ id, reason: "stale" as const }));
  if (published.length + skipped.length !== mutation.selected_count) {
    throw new SiteNavigationStorageError("Kết quả bulk publish điều hướng không khớp danh sách đã chọn.");
  }
  return {
    changedCount: published.length,
    published: published.filter((item): item is AdminNavigationItem => item !== null),
    selectedCount: mutation.selected_count,
    skipped,
  };
}

async function fingerprintNavigationBulkPublish(): Promise<string> {
  return fingerprintNavigationPayload({ operation: "publish_all" });
}

async function fingerprintNavigationMutation(input: Record<string, unknown>): Promise<string> {
  return fingerprintNavigationPayload(input);
}

async function fingerprintNavigationPayload(payload: Record<string, unknown>): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parseNavigationBulkSelectedIds(value: string, expectedCount: number): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new SiteNavigationStorageError("Danh sách mục điều hướng trong audit không hợp lệ.");
  }
  if (
    !Array.isArray(parsed)
    || parsed.length !== expectedCount
    || parsed.length > MAX_NAVIGATION_BULK_ITEMS
    || parsed.some((id) => typeof id !== "string" || id.length < 1 || id.length > 100)
    || new Set(parsed).size !== parsed.length
  ) {
    throw new SiteNavigationStorageError("Danh sách mục điều hướng trong audit không hợp lệ.");
  }
  return parsed as string[];
}

function normalizeNavigationRequestId(value: string | undefined): string {
  const requestId = value?.trim().toLowerCase() ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(requestId)) {
    throw new SiteNavigationValidationError("requestId phải là UUID hợp lệ.");
  }
  return requestId;
}

function isAdminRequestId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isSha256(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value);
}

export class SiteNavigationIdempotencyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SiteNavigationIdempotencyConflictError";
  }
}

const readPublishedSiteNavigation = unstable_cache(
  async (): Promise<PublishedNavigationItem[]> => {
    const database = await getSiteDatabase();
    const rows = await database.prepare(`
      SELECT id, captured_menu_id, published_href, published_is_active,
        published_label, published_sort_order, published_parent_id, menu_key
      FROM site_navigation_items
      ORDER BY menu_key ASC, published_sort_order ASC, id ASC
    `).all<PublishedNavigationRow>();
    const navigationItems = rows.results.map((row) => ({
      capturedMenuId: row.captured_menu_id,
      href: row.published_href,
      id: row.id,
      isActive: row.published_is_active === 1,
      label: row.published_label,
      menuKey: normalizeMenuKey(row.menu_key),
      parentId: row.published_parent_id ?? null,
      sortOrder: row.published_sort_order,
    }));
    for (const item of navigationItems) {
      assertNavigationParentSemantics({ capturedMenuId: item.capturedMenuId, href: item.href, isActive: item.isActive, menuKey: item.menuKey, parentId: item.parentId ?? null });
    }
    validateNavigationTree(navigationItems.map((item) => ({
      id: item.id,
      parentId: item.parentId ?? null,
      menuKey: item.menuKey,
      label: item.label,
      href: item.href,
      isActive: item.isActive,
      sortOrder: item.sortOrder,
    })));
    return navigationItems;
  },
  ["published-site-navigation"],
  { revalidate: 60, tags: ["published-site-navigation", "site-navigation"] }, /* { revalidate: 60 } */
);

export const getPublishedSiteNavigation = cache(async function getPublishedSiteNavigation(): Promise<PublishedNavigationItem[]> {
  try {
    return await readPublishedSiteNavigation();
  } catch (error) {
    console.warn("Published site navigation unavailable; using committed defaults.", error);
    return [...defaultPrimaryNavigation];
  }
});

export function applyNavigationToMarkup(
  markup: string,
  items: readonly PublishedNavigationItem[],
  activeCapturedMenuId?: string,
): string {
  const primaryItems = items
    .filter((item) => item.menuKey === "primary")
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
  let result = markup;

  for (const item of primaryItems) {
    if (!item.capturedMenuId) continue;
    const id = escapeRegExp(item.capturedMenuId);
    const withActive = activeCapturedMenuId === item.capturedMenuId;
    const pattern = new RegExp(
      `(<li\\b[^>]*\\bid=["']${id}["'][^>]*>\\s*<a\\b)([^>]*)(>)([\\s\\S]*?)(</a>)`,
      "gi",
    );
    result = result.replace(pattern, (_match, opening: string, attributes: string, close: string, inner: string, anchorClose: string) => {
      const nextAttributes = replaceAttribute(attributes, "href", item.href);
      const nextInner = preserveNavigationIcons(inner) + escapeHtml(item.label);
      return `${opening}${nextAttributes}${close}${nextInner}${preserveDropdownIcon(inner)}${anchorClose}`;
    });
    const openingPattern = new RegExp(`(<li\\b[^>]*\\bid=["']${id}["'][^>]*)(>)`, "gi");
    result = result.replace(openingPattern, (_match, opening: string, close: string) => {
      let next = opening
        .replace(/\s(?:current-menu-item|current_page_item|current-menu-parent|active)\b/gi, "")
        .replace(/\saria-current=(['"])page\1/gi, "")
        .replace(/\shidden\b/gi, "");
      next = updateClassTokens(next, ["current-menu-item", "current_page_item", "current-menu-parent", "active", "hidden"], [
        ...(!item.isActive ? ["hidden"] : []),
        ...(withActive ? ["active", "current-menu-item"] : []),
      ]);
      if (withActive) next += ' aria-current="page"';
      return `${next}${close}`;
    });
  }

  // The captured desktop and mobile menus use different WordPress IDs. Reuse
  // the same sanitizer for mobile aliases so one published menu controls both.
  for (const item of primaryItems) {
    if (!item.capturedMenuId) continue;
    for (const alias of capturedNavigationAliases[item.capturedMenuId] ?? []) {
      result = applyNavigationToMarkup(
        result,
        [{ ...item, capturedMenuId: alias }],
        activeCapturedMenuId === item.capturedMenuId ? alias : undefined,
      );
    }
  }

  const legacyMegaMenuItemsForMarkup = primaryItems.filter((item) => (
    Boolean(item.capturedMenuId && item.parentId && getLegacyMegaMenuItem(item.capturedMenuId))
  ));
  if (legacyMegaMenuItemsForMarkup.length > 0) {
    result = applyLegacyMegaMenuNavigation(result, legacyMegaMenuItemsForMarkup);
    result = appendManagedLegacyServiceChildren(result, legacyMegaMenuItemsForMarkup);
  }

  const customItems = primaryItems.filter((item) => item.isActive && !item.capturedMenuId);
  const nestedItems = customItems.filter((item) => item.parentId);
  if (nestedItems.length > 0) result = appendNestedCustomNavigation(result, primaryItems, nestedItems);
  const topLevelCustomItems = customItems.filter((item) => !item.parentId);
  if (topLevelCustomItems.length > 0) {
    const customChildren = new Map<string, PublishedNavigationItem[]>();
    for (const item of nestedItems) {
      if (!item.parentId) continue;
      customChildren.set(item.parentId, [...(customChildren.get(item.parentId) ?? []), item]);
    }
    for (const children of customChildren.values()) children.sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
    const renderCustom = (item: PublishedNavigationItem, ancestors = new Set<string>(), depth = 0): string => {
      if (depth >= MAX_NAVIGATION_RENDER_DEPTH || ancestors.has(item.id)) return "";
      const nextAncestors = new Set(ancestors).add(item.id);
      const children = customChildren.get(item.id) ?? [];
      const childMarkup = children.length > 0
        ? `<ul class="sub-nav nested-navigation-children">${children.map((child) => renderCustom(child, nextAncestors, depth + 1)).join("")}</ul>`
        : "";
      return `<li class="menu-item menu-item-design-default managed-navigation-item"><a href="${escapeAttribute(item.href)}" class="nav-top-link">${escapeHtml(item.label)}</a>${childMarkup}</li>`;
    };
    const customMarkup = topLevelCustomItems.map((item) => renderCustom(item)).join("\n");
    result = result.replace(/(<ul\b[^>]*class=["'][^"']*header-nav-main[^"']*["'][^>]*>)([\s\S]*?)(<\/ul>)/i, `$1$2${customMarkup}$3`);
    result = result.replace(/(<ul\b[^>]*class=["'][^"']*\bnav-sidebar\b[^"']*["'][^>]*>)([\s\S]*?)(<\/ul>)/i, `$1$2${customMarkup}$3`);
  }
  return reorderManagedNavigationLists(result, primaryItems);
}

function applyLegacyMegaMenuNavigation(
  markup: string,
  items: readonly PublishedNavigationItem[],
): string {
  let result = markup;
  for (const item of items) {
    if (!item.capturedMenuId) continue;
    const id = escapeRegExp(item.capturedMenuId);
    const wrapperPattern = new RegExp(
      `(<div\\b[^>]*\\bdata-navigation-id=["']${id}["'][^>]*)(>)([\\s\\S]*?)(</div>)`,
      "gi",
    );
    result = result.replace(wrapperPattern, (_match, opening: string, close: string, inner: string, wrapperClose: string) => {
      let nextOpening = updateClassTokens(opening, ["hidden"], item.isActive ? [] : ["hidden"]);
      nextOpening = item.isActive
        ? removeAttribute(nextOpening, "aria-hidden")
        : replaceAttribute(nextOpening, "aria-hidden", "true");
      let nextInner = replaceLegacyMegaMenuLabel(inner, item.label);
      if (item.isActive) {
        const anchorPattern = /<a\b([^>]*\bux-menu-link__link\b[^>]*)>([\s\S]*?)<\/a>/i;
        if (anchorPattern.test(nextInner)) {
          nextInner = nextInner.replace(anchorPattern, (_anchor, attributes: string, anchorInner: string) => (
            `<a${replaceAttribute(attributes, "href", item.href)}>${anchorInner}</a>`
          ));
        } else {
          nextInner = nextInner.replace(
            /<span\b([^>]*\bux-menu-link__link\b[^>]*)>([\s\S]*?)<\/span>/i,
            `<a$1 href="${escapeAttribute(item.href)}">$2</a>`,
          );
        }
      } else {
        nextInner = nextInner.replace(
          /<a\b([^>]*\bux-menu-link__link\b[^>]*)>([\s\S]*?)<\/a>/i,
          `<span$1>$2</span>`,
        );
      }
      return `${nextOpening}${close}${nextInner}${wrapperClose}`;
    });
    const mobileItemPattern = new RegExp(
      "(<li\\b[^>]*\\bdata-navigation-id=[\"']" + id + "[\"'][^>]*)(>)([\\s\\S]*?)(</li>)",
      "gi",
    );
    result = result.replace(mobileItemPattern, (_match, opening: string, close: string, inner: string, itemClose: string) => {
      let nextOpening = updateClassTokens(opening, ["hidden"], item.isActive ? [] : ["hidden"]);
      nextOpening = item.isActive
        ? removeAttribute(nextOpening, "aria-hidden")
        : replaceAttribute(nextOpening, "aria-hidden", "true");
      const nextInner = inner.replace(
        /<a\b([^>]*)>[\s\S]*?<\/a>/i,
        (_anchor, attributes: string) => item.isActive
          ? "<a" + replaceAttribute(attributes, "href", item.href) + ">" + escapeHtml(item.label) + "</a>"
          : "<span" + attributes + ">" + escapeHtml(item.label) + "</span>",
      );
      return nextOpening + close + nextInner + itemClose;
    });
  }
  return result;
}

function replaceLegacyMegaMenuLabel(markup: string, label: string): string {
  return markup.replace(
    /(<span\b[^>]*\bclass=(['"])[^'"]*\bux-menu-link__text\b[^'"]*\2[^>]*>)([\s\S]*?)(<\/span>)/i,
    `$1${escapeHtml(label)}$4`,
  );
}

function appendManagedLegacyServiceChildren(
  markup: string,
  items: readonly PublishedNavigationItem[],
): string {
  const activeItems = items
    .filter((item) => item.parentId === "services" && item.isActive && item.capturedMenuId && getLegacyMegaMenuItem(item.capturedMenuId)?.owner === "services")
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
  if (activeItems.length === 0) return markup;

  const parentOpening = /<li\b[^>]*\bid=["']menu-item-5466["'][^>]*>/i.exec(markup);
  const parentItem = findMatchingListItem(markup, "menu-item-5466");
  if (!parentOpening || !parentItem) return markup;
  const parentOpeningEnd = parentOpening.index + parentOpening[0].length;
  const parentBody = markup.slice(parentOpeningEnd, parentItem.closeStart);
  const submenuOpening = /<ul\b[^>]*\bclass=["'][^"']*\bsub-menu\b[^"']*["'][^>]*>/i.exec(parentBody);
  if (!submenuOpening) return markup;
  const submenuOpeningStart = parentOpeningEnd + submenuOpening.index;
  const submenuOpeningEnd = submenuOpeningStart + submenuOpening[0].length;
  const submenu = findMatchingUl(markup, submenuOpeningEnd);
  if (!submenu || submenu.start > parentItem.closeStart) return markup;
  const body = markup.slice(submenuOpeningEnd, submenu.start);
  const additions = activeItems
    .filter((item) => item.capturedMenuId && !body.includes(`data-navigation-id="${item.capturedMenuId}"`))
    .map((item) => (
      '<li class="menu-item menu-item-type-custom menu-item-object-custom managed-legacy-navigation-child" data-navigation-id="' +
      escapeAttribute(item.capturedMenuId as string) +
      '"><a href="' +
      escapeAttribute(item.href) +
      '">' +
      escapeHtml(item.label) +
      "</a></li>"
    ))
    .join("\n");
  if (!additions) return markup;
  return markup.slice(0, submenuOpeningEnd) + body + additions + markup.slice(submenu.start);
}

function appendNestedCustomNavigation(
  markup: string,
  allItems: readonly PublishedNavigationItem[],
  nestedItems: readonly PublishedNavigationItem[],
): string {
  const children = new Map<string, PublishedNavigationItem[]>();
  for (const item of nestedItems) {
    if (!item.parentId) continue;
    children.set(item.parentId, [...(children.get(item.parentId) ?? []), item]);
  }
  for (const values of children.values()) values.sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
  const render = (parentId: string, ancestors = new Set<string>(), depth = 0): string => {
    if (depth >= MAX_NAVIGATION_RENDER_DEPTH || ancestors.has(parentId)) return "";
    const nextAncestors = new Set(ancestors).add(parentId);
    return (children.get(parentId) ?? []).map((item) => {
      const childMarkup = render(item.id, nextAncestors, depth + 1);
      return `<li class="menu-item menu-item-design-default managed-navigation-item nested-navigation-child"><a href="${escapeAttribute(item.href)}" class="nav-top-link">${escapeHtml(item.label)}</a>${childMarkup ? `<ul class="sub-nav">${childMarkup}</ul>` : ""}</li>`;
    }).join("");
  };
  let result = markup;
  for (const parent of allItems.filter((item) => item.capturedMenuId && children.has(item.id))) {
    const capturedIds = [parent.capturedMenuId as string, ...(capturedNavigationAliases[parent.capturedMenuId as string] ?? [])];
    for (const capturedId of capturedIds) {
      const match = findMatchingListItem(result, capturedId);
      if (!match) continue;
      const nestedMarkup = `<ul class="sub-nav nested-navigation-children">${render(parent.id, new Set(), 0)}</ul>`;
      result = `${result.slice(0, match.closeStart)}${nestedMarkup}${result.slice(match.closeStart)}`;
    }
  }
  return result;
}

function findMatchingListItem(markup: string, capturedId: string): { closeStart: number } | null {
  const opening = new RegExp(`<li\\b[^>]*\\bid=["']${escapeRegExp(capturedId)}["'][^>]*>`, "i").exec(markup);
  if (!opening) return null;
  const tagPattern = /<\/?li\b[^>]*>/gi;
  tagPattern.lastIndex = opening.index;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(markup))) {
    if (/^<li\b/i.test(match[0])) depth++;
    else if (--depth === 0) return { closeStart: match.index };
  }
  return null;
}

/**
 * Adds published, operator-managed links without rewriting the captured
 * legacy footer columns. The captured footer is the visual source of truth;
 * managed links get an explicit, inert section only when an active footer item
 * exists in D1.
 */
export function applyFooterNavigationToMarkup(
  markup: string,
  items: readonly PublishedNavigationItem[],
): string {
  const footerItems = items
    .filter((item) => item.menuKey === "footer" && item.isActive)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
  if (footerItems.length === 0) return markup;

  const footerNavigationMarkup = [
    '<div class="giacong-managed-footer-navigation" data-site-navigation="footer">',
    '  <div class="container">',
    '    <h2 class="giacong-managed-footer-navigation__title">Liên kết website</h2>',
    '    <ul class="giacong-managed-footer-navigation__list">',
    ...footerItems.map((item) => (
      `      <li><a href="${escapeAttribute(item.href)}">${escapeHtml(item.label)}</a></li>`
    )),
    "    </ul>",
    "  </div>",
    "</div>",
  ].join("\n");
  const footerSectionPattern = /(<section\b[^>]*\bclass=(['"])[^'\"]*\bfooter-section\b[^'\"]*\2[^>]*>)([\s\S]*?)(<\/section>)/i;
  return markup.replace(footerSectionPattern, (match, opening: string, _quote: string, content: string, closing: string) => {
    if (content.includes('data-site-navigation="footer"')) return match;
    return `${opening}${content}${footerNavigationMarkup}${closing}`;
  });
}

function reorderManagedNavigationLists(markup: string, items: readonly PublishedNavigationItem[]): string {
  const sortById = new Map(items.filter((item) => item.capturedMenuId).map((item) => [item.capturedMenuId as string, item]));
  if (sortById.size < 2) return markup;
  const openingPattern = /<ul\b[^>]*\bclass=(['"])[^'"]*\bheader-nav-main\b[^'"]*\1[^>]*>/gi;
  let cursor = 0;
  let result = "";
  let match: RegExpExecArray | null;
  while ((match = openingPattern.exec(markup))) {
    const openingEnd = openingPattern.lastIndex;
    const closing = findMatchingUl(markup, openingEnd);
    if (!closing) break;
    const body = markup.slice(openingEnd, closing.start);
    result += markup.slice(cursor, openingEnd);
    result += reorderDirectManagedItems(body, sortById);
    result += markup.slice(closing.start, closing.end);
    cursor = closing.end;
    openingPattern.lastIndex = closing.end;
  }
  return result ? result + markup.slice(cursor) : markup;
}

function reorderDirectManagedItems(body: string, sortById: Map<string, PublishedNavigationItem>): string {
  const listItems = extractDirectListItems(body);
  const managed = listItems
    .map((item) => ({ ...item, navigation: readCapturedMenuItem(item.markup, sortById) }))
    .filter((item): item is ListItem & { navigation: PublishedNavigationItem } => Boolean(item.navigation));
  if (managed.length < 2) return body;
  const sorted = [...managed].sort((left, right) => left.navigation.sortOrder - right.navigation.sortOrder || left.navigation.id.localeCompare(right.navigation.id));
  let cursor = 0;
  let result = "";
  managed.forEach((slot, index) => {
    result += body.slice(cursor, slot.start);
    result += sorted[index].markup;
    cursor = slot.end;
  });
  return result + body.slice(cursor);
}

function readCapturedMenuItem(markup: string, sortById: Map<string, PublishedNavigationItem>): PublishedNavigationItem | undefined {
  const id = markup.match(/^<li\b[^>]*\bid=(['"])([^'"]+)\1/i)?.[2];
  return id ? sortById.get(id) : undefined;
}

interface ListItem {
  end: number;
  markup: string;
  start: number;
}

function extractDirectListItems(body: string): ListItem[] {
  const items: ListItem[] = [];
  const tagPattern = /<\/?li\b[^>]*>/gi;
  let depth = 0;
  let start = -1;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(body))) {
    const tag = match[0];
    if (/^<li\b/i.test(tag)) {
      if (depth === 0) start = match.index;
      depth++;
    } else if (depth > 0) {
      depth--;
      if (depth === 0 && start >= 0) {
        items.push({ end: tagPattern.lastIndex, markup: body.slice(start, tagPattern.lastIndex), start });
        start = -1;
      }
    }
  }
  return items;
}

function findMatchingUl(markup: string, startAt: number): { end: number; start: number } | null {
  const tagPattern = /<\/?ul\b[^>]*>/gi;
  tagPattern.lastIndex = startAt;
  let depth = 1;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(markup))) {
    if (/^<ul\b/i.test(match[0])) {
      depth++;
    } else {
      depth--;
      if (depth === 0) return { end: tagPattern.lastIndex, start: match.index };
    }
  }
  return null;
}

function toAdminNavigationItem(row: SiteNavigationRow): AdminNavigationItem {
  return {
    capturedMenuId: row.captured_menu_id,
    dirty: row.draft_label !== row.published_label
      || row.draft_href !== row.published_href
      || row.draft_sort_order !== row.published_sort_order
      || row.draft_is_active !== row.published_is_active
      || (row.draft_parent_id ?? null) !== (row.published_parent_id ?? null),
    draftHref: row.draft_href,
    draftIsActive: row.draft_is_active === 1,
    draftLabel: row.draft_label,
    draftParentId: row.draft_parent_id ?? null,
    draftSortOrder: row.draft_sort_order,
    id: row.id,
    menuKey: normalizeMenuKey(row.menu_key),
    publishedAt: row.published_at,
    publishedBy: row.published_by,
    publishedHref: row.published_href,
    publishedIsActive: row.published_is_active === 1,
    publishedLabel: row.published_label,
    publishedParentId: row.published_parent_id ?? null,
    publishedSortOrder: row.published_sort_order,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    version: row.version,
  };
}

function mergeLegacyMegaMenuItems(items: AdminNavigationItem[]): AdminNavigationItem[] {
  const persistedCapturedIds = new Set(
    items
      .map((item) => item.capturedMenuId)
      .filter((capturedMenuId): capturedMenuId is string => Boolean(capturedMenuId)),
  );
  const virtualItems: AdminNavigationItem[] = legacyMegaMenuItems
    .filter((sourceItem) => !persistedCapturedIds.has(sourceItem.id))
    .map((sourceItem) => ({
      capturedMenuId: sourceItem.id,
      dirty: false,
      draftHref: sourceItem.href,
      draftIsActive: !sourceItem.isPlaceholder,
      draftLabel: sourceItem.label,
      draftParentId: sourceItem.owner,
      draftSortOrder: sourceItem.sortOrder,
      id: `legacy-${sourceItem.id}`,
      menuKey: "primary" as const,
      publishedAt: null,
      publishedBy: null,
      publishedHref: sourceItem.href,
      publishedIsActive: !sourceItem.isPlaceholder,
      publishedLabel: sourceItem.label,
      publishedParentId: sourceItem.owner,
      publishedSortOrder: sourceItem.sortOrder,
      updatedAt: "",
      updatedBy: null,
      version: 0,
      virtual: true,
    }));
  return [...items, ...virtualItems].sort((left, right) => (
    left.menuKey.localeCompare(right.menuKey)
    || left.draftSortOrder - right.draftSortOrder
    || left.id.localeCompare(right.id)
  ));
}

function normalizeNavigationId(value: string): string {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9_-]{0,99}$/i.test(value)) {
    throw new SiteNavigationValidationError("id điều hướng không hợp lệ.");
  }
  return value;
}

function normalizeMenuKey(value: unknown): NavigationMenuKey {
  if (value === "primary" || value === "footer") return value;
  throw new SiteNavigationValidationError("menuKey không hợp lệ.");
}

function normalizeText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") throw new SiteNavigationValidationError(`${field} phải là chuỗi.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[<>]/.test(normalized)) {
    throw new SiteNavigationValidationError(`${field} không hợp lệ.`);
  }
  return normalized;
}

function normalizeHref(value: unknown): string {
  if (typeof value !== "string") throw new SiteNavigationValidationError("href phải là URL.");
  const normalized = value.trim();
  if (!isSafeHref(normalized)) throw new SiteNavigationValidationError("href chỉ được dùng URL nội bộ hoặc http(s).");
  return normalized;
}

function isSafeHref(value: string): boolean {
  if (!value || value.startsWith("//")) return false;
  if (value.startsWith("/") || value.startsWith("#")) return true;
  try {
    return ["http:", "https:", "mailto:", "tel:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function normalizeCapturedMenuId(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^[a-z][a-z0-9-]{0,99}$/i.test(value)) {
    throw new SiteNavigationValidationError("capturedMenuId không hợp lệ.");
  }
  return value;
}

function normalizeSortOrder(value: unknown): number {
  if (value === undefined || value === null || value === "") return 0;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 100_000) {
    throw new SiteNavigationValidationError("sortOrder không hợp lệ.");
  }
  return number;
}

function normalizeBoolean(value: unknown, fallback?: boolean): boolean {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== "boolean") throw new SiteNavigationValidationError("isActive phải là boolean.");
  return value;
}

async function getSiteDatabase(): Promise<D1DatabaseLike> {
  const { env } = await getCloudflareContext({ async: true });
  const database = (env as unknown as { GIACONG_VN_CATALOG?: D1DatabaseLike }).GIACONG_VN_CATALOG;
  if (!database) throw new Error("Missing GIACONG_VN_CATALOG binding.");
  return database;
}

async function writeNavigationAudit(
  database: D1DatabaseLike,
  actorSubject: string,
  action: string,
  entityId: string,
  metadata: unknown,
): Promise<void> {
  await database.prepare(`
    INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
    VALUES (?, ?, ?, 'site_navigation', ?, ?)
  `).bind(crypto.randomUUID(), actorSubject, action, entityId, JSON.stringify(metadata)).run();
}

interface SiteNavigationRow {
  id: string;
  menu_key: NavigationMenuKey;
  captured_menu_id: string | null;
  draft_label: string;
  draft_href: string;
  draft_sort_order: number;
  draft_is_active: number;
  draft_parent_id: string | null;
  published_label: string;
  published_href: string;
  published_sort_order: number;
  published_is_active: number;
  published_parent_id: string | null;
  version: number;
  updated_by: string | null;
  updated_at: string;
  published_by: string | null;
  published_at: string | null;
  last_request_id: string | null;
}

function normalizeOptionalNavigationId(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  return normalizeNavigationId(value as string);
}

function assertNavigationParentSemantics(input: {
  capturedMenuId: string | null;
  href?: string;
  isActive?: boolean;
  menuKey: NavigationMenuKey;
  parentId: string | null;
}): void {
  const legacyItem = getLegacyMegaMenuItem(input.capturedMenuId);
  if (legacyItem) {
    if (input.menuKey !== "primary" || input.parentId !== legacyItem.owner) {
      throw new SiteNavigationValidationError("Mục con Sản phẩm/Dịch vụ phải nằm dưới đúng menu nguồn.");
    }
    if (input.isActive && legacyItem.isPlaceholder && isLegacyMegaMenuPlaceholderHref(input.href)) {
      throw new SiteNavigationValidationError("Mục con nguồn chưa có đường dẫn thật. Nhập đường dẫn trước khi bật hiển thị.");
    }
    return;
  }
  if (!input.parentId) return;
  if (input.capturedMenuId) {
    throw new SiteNavigationValidationError("Mục menu cũ phải ở cấp cao nhất; chỉ mục mới có thể làm mục con.");
  }
  if (input.menuKey === "footer") {
    throw new SiteNavigationValidationError("Mục cuối trang phải ở cấp cao nhất.");
  }
}

function isLegacyMegaMenuPlaceholderHref(value: string | undefined): boolean {
  return value === "#" || value === "/" || value === "/Hoa quả sấy";
}

interface PublishedNavigationRow {
  id: string;
  menu_key: NavigationMenuKey;
  captured_menu_id: string | null;
  published_label: string;
  published_href: string;
  published_sort_order: number;
  published_is_active: number;
  published_parent_id: string | null;
}

function preserveNavigationIcons(inner: string): string {
  return (inner.match(/<img\b[^>]*>/gi) ?? []).join("");
}

function preserveDropdownIcon(inner: string): string {
  return inner.match(/<i\b[^>]*icon-angle-down[^>]*>[\s\S]*?<\/i>/i)?.[0] ?? "";
}

function replaceAttribute(attributes: string, name: string, value: string): string {
  const escaped = escapeAttribute(value);
  const pattern = new RegExp(`\\s${name}=(['"])[^'"]*\\1`, "i");
  return pattern.test(attributes)
    ? attributes.replace(pattern, ` ${name}="${escaped}"`)
    : `${attributes} ${name}="${escaped}"`;
}

function removeAttribute(attributes: string, name: string): string {
  return attributes.replace(new RegExp(`\\s${name}=(['"])[^'"]*\\1`, "i"), "");
}

function updateClassTokens(attributes: string, remove: readonly string[], add: readonly string[]): string {
  const classPattern = /\sclass=(['"])([^'"]*)\1/i;
  const classMatch = attributes.match(classPattern);
  const removeSet = new Set(remove);
  const tokens = (classMatch?.[2] ?? "")
    .split(/\s+/)
    .filter((token) => token && !removeSet.has(token));
  for (const token of add) {
    if (token && !tokens.includes(token)) tokens.push(token);
  }
  const classValue = escapeAttribute(tokens.join(" "));
  if (classMatch) return attributes.replace(classPattern, ` class="${classValue}"`);
  return classValue ? `${attributes} class="${classValue}"` : attributes;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasChanged(result: unknown): boolean {
  if (typeof result !== "object" || result === null) return false;
  const record = result as { meta?: { changes?: unknown }; results?: unknown[] };
  if (Array.isArray(record.results)) return record.results.length > 0;
  const changes = record.meta?.changes;
  return changes !== undefined && Number(changes) > 0;
}

function normalizeNavigationWriteError(error: unknown): unknown {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  if (message.includes("navigation-write-postcondition")
    || message.includes("navigation-bulk-postcondition")
    || (normalized.includes("admin_navigation_audit") && normalized.includes("constraint"))
    || (normalized.includes("admin_navigation_create_audit") && normalized.includes("constraint"))
    || (normalized.includes("admin_navigation_bulk_audit") && normalized.includes("constraint"))) {
    return new SiteNavigationStorageError(
      "Không ghi đồng bộ được mục điều hướng và audit; hệ thống đã rollback để tránh báo thành công sai.",
    );
  }
  return error;
}
