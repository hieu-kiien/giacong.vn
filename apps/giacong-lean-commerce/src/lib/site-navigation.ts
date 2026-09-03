import { getCloudflareContext } from "@opennextjs/cloudflare";

import type { D1DatabaseLike, D1PreparedStatementLike } from "./admin-data";

export type NavigationMenuKey = "primary" | "footer";

export interface PublishedNavigationItem {
  id: string;
  capturedMenuId: string | null;
  href: string;
  isActive: boolean;
  label: string;
  menuKey: NavigationMenuKey;
  sortOrder: number;
}

export interface AdminNavigationItem {
  id: string;
  capturedMenuId: string | null;
  draftHref: string;
  draftIsActive: boolean;
  draftLabel: string;
  draftSortOrder: number;
  publishedHref: string;
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
}

export const MAX_NAVIGATION_BULK_ITEMS = 100;

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
  { id: "home", capturedMenuId: "menu-item-4618", href: "/", isActive: true, label: "Home", menuKey: "primary", sortOrder: 10 },
  { id: "about", capturedMenuId: "menu-item-5498", href: "/gioi-thieu-ve-gia-cong/", isActive: true, label: "Về Giacong.vn", menuKey: "primary", sortOrder: 20 },
  { id: "products", capturedMenuId: "menu-item-1742", href: "/san-pham/", isActive: true, label: "Mua hàng", menuKey: "primary", sortOrder: 30 },
  { id: "services", capturedMenuId: "menu-item-5166", href: "/thue-gia-cong/", isActive: true, label: "Thuê gia công", menuKey: "primary", sortOrder: 40 },
  { id: "news", capturedMenuId: "menu-item-1541", href: "/tin-tuc/", isActive: true, label: "Tin tức", menuKey: "primary", sortOrder: 50 },
  { id: "contact", capturedMenuId: "menu-item-1542", href: "/lien-he/", isActive: true, label: "Liên hệ", menuKey: "primary", sortOrder: 60 },
];

const capturedNavigationAliases: Readonly<Record<string, readonly string[]>> = {
  "menu-item-4618": ["menu-item-5465"],
  "menu-item-5498": ["menu-item-5496"],
  "menu-item-5166": ["menu-item-5466"],
  "menu-item-1541": ["menu-item-5477"],
  "menu-item-1542": ["menu-item-5478"],
};

export async function listAdminSiteNavigation(database: D1DatabaseLike): Promise<AdminNavigationItem[]> {
  const rows = await database.prepare(`
    SELECT id, menu_key, captured_menu_id,
      draft_label, draft_href, draft_sort_order, draft_is_active,
      published_label, published_href, published_sort_order, published_is_active,
      version, updated_by, updated_at, published_by, published_at
    FROM site_navigation_items
    ORDER BY menu_key ASC, draft_sort_order ASC, id ASC
    LIMIT 100
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
      published_label, published_href, published_sort_order, published_is_active,
      version, updated_by, updated_at, published_by, published_at
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
    requestId: string;
    sortOrder?: unknown;
  },
): Promise<AdminNavigationItem> {
  const menuKey = normalizeMenuKey(input.menuKey);
  const label = normalizeText(input.label, "label", 120);
  const href = normalizeHref(input.href);
  const capturedMenuId = normalizeCapturedMenuId(input.capturedMenuId);
  const sortOrder = normalizeSortOrder(input.sortOrder);
  const isActive = normalizeBoolean(input.isActive, true);
  const requestId = normalizeNavigationRequestId(input.requestId);
  const payloadSha256 = await fingerprintNavigationMutation({
    capturedMenuId,
    href,
    isActive,
    label,
    menuKey,
    operation: "create",
    sortOrder,
  });
  const existingMutation = await findNavigationCreateMutation(database, requestId);
  if (existingMutation) {
    assertMatchingNavigationCreateMutation(existingMutation, payloadSha256);
    return readNavigationCreateMutationResult(database, existingMutation);
  }
  const id = crypto.randomUUID();

  const insert = database.prepare(`
    INSERT INTO site_navigation_items (
      id, menu_key, captured_menu_id,
      draft_label, draft_href, draft_sort_order, draft_is_active,
      published_label, published_href, published_sort_order, published_is_active,
      updated_by, last_request_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    isActive ? 1 : 0,
    input.actorSubject,
    requestId,
  );
  const audit = database.prepare(`
    INSERT INTO admin_navigation_create_audit (
      request_id, actor_subject, action, operation, entity_type, entity_key,
      previous_revision, resulting_revision, payload_sha256
    ) VALUES (?, ?, 'create', 'create', 'site_navigation', ?, 0, 1, ?)
  `).bind(requestId, input.actorSubject, id, payloadSha256);
  try {
    const changed = await applyAtomicNavigationMutation(database, insert, audit);
    if (!changed) throw new SiteNavigationStorageError("Không ghi được mục điều hướng mới.");
  } catch (error) {
    const racedMutation = await findNavigationCreateMutation(database, requestId);
    if (racedMutation) {
      assertMatchingNavigationCreateMutation(racedMutation, payloadSha256);
      return readNavigationCreateMutationResult(database, racedMutation);
    }
    throw error;
  }
  const mutation = await findNavigationCreateMutation(database, requestId);
  if (!mutation) throw new SiteNavigationStorageError("Không đọc được audit mục điều hướng vừa tạo.");
  assertMatchingNavigationCreateMutation(mutation, payloadSha256);
  return readNavigationCreateMutationResult(database, mutation);
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
    requestId: string;
    sortOrder: unknown;
  },
): Promise<AdminNavigationItem> {
  const id = normalizeNavigationId(input.id);
  const label = normalizeText(input.label, "label", 120);
  const href = normalizeHref(input.href);
  const sortOrder = normalizeSortOrder(input.sortOrder);
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
    operation: "draft",
    sortOrder,
  });
  const existingMutation = await findNavigationMutation(database, requestId);
  if (existingMutation) {
    assertMatchingNavigationMutation(existingMutation, "draft", payloadSha256);
    return readNavigationMutationResult(database, existingMutation);
  }
  const current = await getAdminSiteNavigation(database, id);
  if (!current) throw new SiteNavigationNotFoundError("Không tìm thấy mục điều hướng.");
  if (current.version !== input.expectedVersion) {
    throw new SiteNavigationConflictError("Mục điều hướng đã thay đổi ở phiên khác. Hãy tải lại trước khi lưu.");
  }

  const update = database.prepare(`
    UPDATE site_navigation_items
    SET draft_label = ?, draft_href = ?, draft_sort_order = ?, draft_is_active = ?,
      version = version + 1, updated_by = ?, updated_at = CURRENT_TIMESTAMP,
      last_request_id = ?
    WHERE id = ? AND version = ?
  `).bind(
    label,
    href,
    sortOrder,
    isActive ? 1 : 0,
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
    const changed = await applyAtomicNavigationMutation(database, update, audit);
    if (!changed) throw new SiteNavigationConflictError("Mục điều hướng đã thay đổi ở phiên khác. Hãy tải lại trước khi lưu.");
  } catch (error) {
    const racedMutation = await findNavigationMutation(database, requestId);
    if (racedMutation) {
      assertMatchingNavigationMutation(racedMutation, "draft", payloadSha256);
      return readNavigationMutationResult(database, racedMutation);
    }
    throw error;
  }
  const updated = await getAdminSiteNavigation(database, id);
  if (!updated) throw new SiteNavigationNotFoundError("Không thể đọc mục điều hướng vừa cập nhật.");
  return updated;
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
  const existingMutation = await findNavigationMutation(database, requestId);
  if (existingMutation) {
    assertMatchingNavigationMutation(existingMutation, "publish", payloadSha256);
    return readNavigationMutationResult(database, existingMutation);
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
    const changed = await applyAtomicNavigationMutation(database, update, audit);
    if (!changed) throw new SiteNavigationConflictError("Mục điều hướng đã thay đổi ở phiên khác. Hãy tải lại trước khi phát hành.");
  } catch (error) {
    const racedMutation = await findNavigationMutation(database, requestId);
    if (racedMutation) {
      assertMatchingNavigationMutation(racedMutation, "publish", payloadSha256);
      return readNavigationMutationResult(database, racedMutation);
    }
    throw error;
  }
  const published = await getAdminSiteNavigation(database, id);
  if (!published) throw new SiteNavigationNotFoundError("Không thể đọc mục điều hướng vừa phát hành.");
  return published;
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
      published_label, published_href, published_sort_order, published_is_active,
      version, updated_by, updated_at, published_by, published_at
    FROM site_navigation_items
    WHERE draft_label <> published_label
      OR draft_href <> published_href
      OR draft_sort_order <> published_sort_order
      OR draft_is_active <> published_is_active
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
  }

  statements.push(database.prepare(`
    UPDATE admin_navigation_bulk_audit
    SET published_count = (
      SELECT COUNT(*) FROM admin_navigation_audit WHERE bulk_request_id = ?
    )
    WHERE request_id = ?
  `).bind(requestId, requestId));

  const databaseWithBatch = database as D1DatabaseWithBatch;
  if (typeof databaseWithBatch.batch !== "function") {
    throw new SiteNavigationStorageError("D1 atomic batch chưa sẵn sàng cho bulk publish điều hướng.");
  }
  try {
    const results = await databaseWithBatch.batch(statements);
    if (results.length !== statements.length) {
      throw new SiteNavigationStorageError("D1 bulk batch điều hướng trả về kết quả không hợp lệ.");
    }
    if (!hasChanged(results[0]) || !hasChanged(results.at(-1))) {
      throw new SiteNavigationStorageError("Bulk publish điều hướng chưa ghi được audit envelope.");
    }
    for (let index = 1; index < results.length - 1; index += 2) {
      const updateChanged = hasChanged(results[index]);
      const itemAuditChanged = hasChanged(results[index + 1]);
      if (updateChanged !== itemAuditChanged) {
        throw new SiteNavigationStorageError("Bulk publish điều hướng có mục thiếu audit đồng bộ.");
      }
    }
  } catch (error) {
    const racedMutation = await findNavigationBulkMutation(database, requestId);
    if (racedMutation) {
      assertMatchingNavigationBulkMutation(racedMutation, payloadSha256);
      return readBulkNavigationResult(database, requestId, racedMutation);
    }
    throw error;
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

async function applyAtomicNavigationMutation(
  database: D1DatabaseLike,
  update: D1PreparedStatementLike,
  audit: D1PreparedStatementLike,
): Promise<boolean> {
  const databaseWithBatch = database as D1DatabaseWithBatch;
  if (typeof databaseWithBatch.batch !== "function") {
    throw new SiteNavigationStorageError("D1 atomic batch chưa sẵn sàng cho thay đổi điều hướng.");
  }
  const results = await databaseWithBatch.batch([update, audit]);
  if (results.length !== 2) throw new SiteNavigationStorageError("D1 navigation mutation trả về kết quả không hợp lệ.");
  const updateChanged = hasChanged(results[0]);
  const auditChanged = hasChanged(results[1]);
  if (updateChanged !== auditChanged) throw new SiteNavigationStorageError("Thay đổi điều hướng chưa ghép được với audit.");
  return updateChanged;
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
): Promise<AdminNavigationItem> {
  const item = await getAdminSiteNavigation(database, mutation.entity_key);
  if (!item) throw new SiteNavigationStorageError("Không đọc được mục điều hướng sau khi replay.");
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
): Promise<AdminNavigationItem> {
  const item = await getAdminSiteNavigation(database, mutation.entity_key);
  if (!item) throw new SiteNavigationStorageError("Không đọc được mục điều hướng sau khi replay.");
  return item;
}

interface NavigationBulkMutationRow {
  operation: "publish_all";
  payload_sha256: string;
  published_count: number;
  selected_count: number;
  selected_ids_json: string;
}

interface NavigationBulkAuditItemRow {
  navigation_id: string;
}

async function findNavigationBulkMutation(
  database: D1DatabaseLike,
  requestId: string,
): Promise<NavigationBulkMutationRow | null> {
  return database.prepare(`
    SELECT operation, payload_sha256, selected_count, published_count, selected_ids_json
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
    SELECT entity_key AS navigation_id
    FROM admin_navigation_audit
    WHERE bulk_request_id = ?
    ORDER BY id ASC
  `).bind(requestId).all<NavigationBulkAuditItemRow>();
  if (auditRows.results.length !== mutation.published_count) {
    throw new SiteNavigationStorageError("Bulk audit điều hướng không khớp số mục đã phát hành.");
  }

  const selectedIds = parseNavigationBulkSelectedIds(mutation.selected_ids_json, mutation.selected_count);
  const navigationItems = await listAdminSiteNavigation(database);
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

export class SiteNavigationIdempotencyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SiteNavigationIdempotencyConflictError";
  }
}

export async function getPublishedSiteNavigation(): Promise<PublishedNavigationItem[]> {
  try {
    const database = await getSiteDatabase();
    const rows = await database.prepare(`
      SELECT id, captured_menu_id, published_href, published_is_active,
        published_label, published_sort_order, menu_key
      FROM site_navigation_items
      ORDER BY menu_key ASC, published_sort_order ASC, id ASC
    `).all<PublishedNavigationRow>();
    return rows.results.map((row) => ({
      capturedMenuId: row.captured_menu_id,
      href: row.published_href,
      id: row.id,
      isActive: row.published_is_active === 1,
      label: row.published_label,
      menuKey: normalizeMenuKey(row.menu_key),
      sortOrder: row.published_sort_order,
    }));
  } catch (error) {
    console.warn("Published site navigation unavailable; using committed defaults.", error);
    return [...defaultPrimaryNavigation];
  }
}

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

  const customItems = primaryItems.filter((item) => item.isActive && !item.capturedMenuId);
  if (customItems.length > 0) {
    const customMarkup = customItems.map((item) => (
      `<li class="menu-item menu-item-design-default managed-navigation-item"><a href="${escapeAttribute(item.href)}" class="nav-top-link">${escapeHtml(item.label)}</a></li>`
    )).join("\n");
    result = result.replace(/(<ul\b[^>]*class=["'][^"']*header-nav-main[^"']*["'][^>]*>)([\s\S]*?)(<\/ul>)/i, `$1$2${customMarkup}$3`);
    result = result.replace(/(<ul\b[^>]*class=["'][^"']*\bnav-sidebar\b[^"']*["'][^>]*>)([\s\S]*?)(<\/ul>)/i, `$1$2${customMarkup}$3`);
  }
  return reorderManagedNavigationLists(result, primaryItems);
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
      || row.draft_is_active !== row.published_is_active,
    draftHref: row.draft_href,
    draftIsActive: row.draft_is_active === 1,
    draftLabel: row.draft_label,
    draftSortOrder: row.draft_sort_order,
    id: row.id,
    menuKey: normalizeMenuKey(row.menu_key),
    publishedAt: row.published_at,
    publishedBy: row.published_by,
    publishedHref: row.published_href,
    publishedIsActive: row.published_is_active === 1,
    publishedLabel: row.published_label,
    publishedSortOrder: row.published_sort_order,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
    version: row.version,
  };
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
  published_label: string;
  published_href: string;
  published_sort_order: number;
  published_is_active: number;
  version: number;
  updated_by: string | null;
  updated_at: string;
  published_by: string | null;
  published_at: string | null;
}

interface PublishedNavigationRow {
  id: string;
  menu_key: NavigationMenuKey;
  captured_menu_id: string | null;
  published_label: string;
  published_href: string;
  published_sort_order: number;
  published_is_active: number;
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
  if (typeof result !== "object" || result === null) return true;
  const meta = (result as { meta?: { changes?: unknown } }).meta;
  return meta?.changes === undefined || Number(meta.changes) > 0;
}
