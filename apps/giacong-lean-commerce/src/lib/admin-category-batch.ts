import type { D1DatabaseLike, D1PreparedStatementLike } from "./admin-data.ts";
import { isAdminRequestId } from "./admin-request.ts";

export const MAX_CATEGORY_BATCH_ITEMS = 100;
const CATEGORY_BATCH_OPERATION = "archive_batch";
const CATEGORY_BATCH_ENTITY_KEY_PREFIX = "bulk-category-archive:";

export type AdminCategoryBatchSkipReason = "already_archived" | "not_found" | "stale";

export interface AdminCategoryBatchItem {
  expectedRevision: number;
  id: number;
}

export interface AdminCategoryBatchSnapshot {
  id: number;
  isActive: boolean;
  revision: number;
}

export interface AdminCategoryBatchResult {
  changedCount: number;
  replayed: boolean;
  selectedCount: number;
  skipped: Array<{ id: number; reason: AdminCategoryBatchSkipReason }>;
}

export class AdminCategoryBatchValidationError extends Error {}
export class AdminCategoryBatchConflictError extends Error {}
export class AdminCategoryBatchIdempotencyConflictError extends Error {}
export class AdminCategoryBatchStorageError extends Error {}

export function parseAdminCategoryBatchItems(value: unknown): AdminCategoryBatchItem[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_CATEGORY_BATCH_ITEMS) return null;
  const items: AdminCategoryBatchItem[] = [];
  for (const entry of value) {
    if (!isRecord(entry)
      || Object.keys(entry).length !== 2
      || typeof entry.id !== "number"
      || !Number.isSafeInteger(entry.id)
      || entry.id < 1
      || typeof entry.expectedRevision !== "number"
      || !Number.isSafeInteger(entry.expectedRevision)
      || entry.expectedRevision < 1) {
      return null;
    }
    items.push({ expectedRevision: entry.expectedRevision, id: entry.id });
  }
  if (new Set(items.map((item) => item.id)).size !== items.length) return null;
  return items.sort((left, right) => left.id - right.id);
}

export async function listAdminCategoryBatchSnapshots(
  database: D1DatabaseLike,
  ids: readonly number[],
): Promise<AdminCategoryBatchSnapshot[]> {
  const normalizedIds = normalizeCategoryIds(ids);
  const placeholders = normalizedIds.map(() => "?").join(", ");
  const result = await database.prepare(`
    SELECT id, revision, is_active
    FROM categories
    WHERE id IN (${placeholders})
    ORDER BY id ASC
  `).bind(...normalizedIds).all<CategorySnapshotRow>();
  return result.results.map((row) => {
    if (!Number.isSafeInteger(row.id) || row.id < 1 || !Number.isSafeInteger(row.revision) || row.revision < 1) {
      throw new AdminCategoryBatchStorageError("Danh mục chưa có revision hợp lệ cho thao tác an toàn.");
    }
    return { id: row.id, isActive: row.is_active === 1, revision: row.revision };
  });
}

export async function archiveAdminCategoriesAtomically(
  database: D1DatabaseLike,
  input: { actorSubject: string; items: readonly AdminCategoryBatchItem[]; requestId: string },
): Promise<AdminCategoryBatchResult> {
  const items = normalizeBatchItems(input.items);
  const requestId = normalizeRequestId(input.requestId);
  const payloadSha256 = await fingerprint({ items, operation: CATEGORY_BATCH_OPERATION });
  const existingMutation = await findCategoryBatchMutation(database, requestId);
  if (existingMutation) {
    assertMatchingMutation(existingMutation, requestId, payloadSha256);
    return readCategoryBatchReplay(database, requestId, existingMutation, items.length);
  }

  const snapshots = await listAdminCategoryBatchSnapshots(database, items.map((item) => item.id));
  const snapshotsById = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  const skipped: Array<{ id: number; reason: AdminCategoryBatchSkipReason }> = [];
  for (const item of items) {
    const snapshot = snapshotsById.get(item.id);
    if (!snapshot) skipped.push({ id: item.id, reason: "not_found" });
    else if (snapshot.revision !== item.expectedRevision) skipped.push({ id: item.id, reason: "stale" });
    else if (!snapshot.isActive) skipped.push({ id: item.id, reason: "already_archived" });
  }
  const skippedIds = new Set(skipped.map((entry) => entry.id));
  const eligible = items.filter((item) => !skippedIds.has(item.id));

  const [hasAuditMarker, hasAuditLog] = await Promise.all([
    tableExists(database, "admin_audit_log"),
    tableExists(database, "audit_logs"),
  ]);
  if (!hasAuditMarker || !hasAuditLog) {
    throw new AdminCategoryBatchStorageError("Các bảng audit cần thiết cho ẩn hàng loạt danh mục chưa được triển khai.");
  }

  const databaseWithBatch = requireBatch(database);
  const envelopeId = categoryBatchEntityKey(requestId);
  const result: AdminCategoryBatchResult = {
    changedCount: eligible.length,
    replayed: false,
    selectedCount: items.length,
    skipped,
  };
  const statements: D1PreparedStatementLike[] = [buildAuditMarker(database, input.actorSubject, requestId, envelopeId, payloadSha256)];
  for (const item of eligible) {
    statements.push(buildArchiveUpdate(database, item));
    statements.push(buildArchiveGuard(database, input.actorSubject, requestId, envelopeId, payloadSha256, item));
    statements.push(buildCategoryAudit(database, input.actorSubject, requestId, item));
  }
  statements.push(buildBatchAuditEnvelope(database, input.actorSubject, envelopeId, result));

  let batchResults: D1BatchResultLike[];
  try {
    batchResults = await databaseWithBatch.batch(statements);
  } catch (error) {
    const racedMutation = await findCategoryBatchMutation(database, requestId);
    if (racedMutation) {
      assertMatchingMutation(racedMutation, requestId, payloadSha256);
      return readCategoryBatchReplay(database, requestId, racedMutation, items.length);
    }
    if (isCategoryBatchStaleConstraint(error)) {
      throw new AdminCategoryBatchConflictError("Danh mục đã thay đổi ở phiên khác. Hãy tải lại rồi thử lại.");
    }
    throw error;
  }
  assertBatchResults(batchResults, statements.length, eligible.length);
  return result;
}

interface CategorySnapshotRow {
  id: number;
  is_active: number;
  revision: number;
}

interface CategoryBatchMutationRow {
  action: string;
  entity_key: string;
  entity_type: string;
  payload_sha256: string;
}

interface CategoryBatchReplayMetadata {
  changedCount: number;
  requestId: string;
  selectedCount: number;
  skipped: Array<{ id: number; reason: AdminCategoryBatchSkipReason }>;
}

interface D1BatchResultLike {
  results?: unknown[];
}

interface D1DatabaseWithBatch extends D1DatabaseLike {
  batch(statements: D1PreparedStatementLike[]): Promise<D1BatchResultLike[]>;
}

function normalizeBatchItems(items: readonly AdminCategoryBatchItem[]): AdminCategoryBatchItem[] {
  const parsed = parseAdminCategoryBatchItems(items);
  if (!parsed) throw new AdminCategoryBatchValidationError("Danh sách danh mục hoặc revision không hợp lệ.");
  return parsed;
}

function normalizeCategoryIds(ids: readonly number[]): number[] {
  if (ids.length === 0 || ids.length > MAX_CATEGORY_BATCH_ITEMS) {
    throw new AdminCategoryBatchValidationError("Mỗi lần chỉ được đọc tối đa 100 danh mục.");
  }
  const normalized = [...ids].sort((left, right) => left - right);
  if (normalized.some((id) => !Number.isSafeInteger(id) || id < 1)
    || new Set(normalized).size !== normalized.length) {
    throw new AdminCategoryBatchValidationError("Danh sách danh mục không hợp lệ hoặc bị trùng.");
  }
  return normalized;
}

function normalizeRequestId(value: string): string {
  const requestId = value.trim().toLowerCase();
  if (!isAdminRequestId(requestId)) throw new AdminCategoryBatchValidationError("requestId phải là UUID hợp lệ.");
  return requestId;
}

async function findCategoryBatchMutation(
  database: D1DatabaseLike,
  requestId: string,
): Promise<CategoryBatchMutationRow | null> {
  return database.prepare(`
    SELECT action, entity_key, entity_type, payload_sha256
    FROM admin_audit_log
    WHERE request_id = ?
    LIMIT 1
  `).bind(requestId).first<CategoryBatchMutationRow>();
}

function assertMatchingMutation(
  mutation: CategoryBatchMutationRow,
  requestId: string,
  payloadSha256: string,
): void {
  if (mutation.action !== "delete"
    || mutation.entity_type !== "category"
    || mutation.entity_key !== categoryBatchEntityKey(requestId)
    || mutation.payload_sha256 !== payloadSha256) {
    throw new AdminCategoryBatchIdempotencyConflictError("requestId đã được dùng cho một payload khác.");
  }
}

async function readCategoryBatchReplay(
  database: D1DatabaseLike,
  requestId: string,
  mutation: CategoryBatchMutationRow,
  selectedCount: number,
): Promise<AdminCategoryBatchResult> {
  const envelope = await database.prepare(`
    SELECT metadata_json
    FROM audit_logs
    WHERE id = ? AND action = 'category.bulk_archived_batch' AND entity_type = 'category'
    LIMIT 1
  `).bind(mutation.entity_key).first<{ metadata_json: string }>();
  if (!envelope) throw new AdminCategoryBatchStorageError("Không đọc lại được kết quả ẩn danh mục hàng loạt.");

  let metadata: unknown;
  try {
    metadata = JSON.parse(envelope.metadata_json);
  } catch {
    throw new AdminCategoryBatchStorageError("Audit ẩn danh mục hàng loạt chứa metadata không hợp lệ.");
  }
  if (!isReplayMetadata(metadata)
    || metadata.requestId !== requestId
    || metadata.selectedCount !== selectedCount) {
    throw new AdminCategoryBatchStorageError("Audit ẩn danh mục hàng loạt không khớp request.");
  }
  return {
    changedCount: metadata.changedCount,
    replayed: true,
    selectedCount: metadata.selectedCount,
    skipped: metadata.skipped,
  };
}

function buildAuditMarker(
  database: D1DatabaseLike,
  actorSubject: string,
  requestId: string,
  entityKey: string,
  payloadSha256: string,
): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO admin_audit_log (
      request_id, actor_subject, action, entity_type, entity_key,
      previous_revision, resulting_revision, payload_sha256
    ) VALUES (?, ?, 'delete', 'category', ?, NULL, NULL, ?)
    RETURNING request_id
  `).bind(requestId, actorSubject, entityKey, payloadSha256);
}

function buildArchiveUpdate(
  database: D1DatabaseLike,
  item: AdminCategoryBatchItem,
): D1PreparedStatementLike {
  return database.prepare(`
    UPDATE categories
    SET is_active = 0, updated_at = CURRENT_TIMESTAMP, revision = revision + 1
    WHERE id = ? AND revision = ? AND is_active = 1
    RETURNING id, revision
  `).bind(item.id, item.expectedRevision);
}

function buildArchiveGuard(
  database: D1DatabaseLike,
  actorSubject: string,
  requestId: string,
  entityKey: string,
  payloadSha256: string,
  item: AdminCategoryBatchItem,
): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO admin_audit_log (
      request_id, actor_subject, action, entity_type, entity_key,
      previous_revision, resulting_revision, payload_sha256
    )
    SELECT ?, ?, 'delete', 'category', ?, ?, ?, ?
    WHERE NOT EXISTS (
      SELECT 1 FROM categories
      WHERE id = ? AND revision = ? AND is_active = 0
    ) OR changes() <> 1
  `).bind(
    requestId,
    actorSubject,
    entityKey,
    item.expectedRevision,
    item.expectedRevision + 1,
    payloadSha256,
    item.id,
    item.expectedRevision + 1,
  );
}

function buildCategoryAudit(
  database: D1DatabaseLike,
  actorSubject: string,
  requestId: string,
  item: AdminCategoryBatchItem,
): D1PreparedStatementLike {
  const childId = `${CATEGORY_BATCH_ENTITY_KEY_PREFIX}${requestId}:${item.id}`;
  const metadata = JSON.stringify({
    expectedRevision: item.expectedRevision,
    requestId,
    resultingRevision: item.expectedRevision + 1,
    source: "category_batch_archive",
  });
  return database.prepare(`
    INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
    SELECT ?, ?, 'category.bulk_archived', 'category', CAST(id AS TEXT), ?
    FROM categories
    WHERE id = ? AND revision = ? AND is_active = 0
    RETURNING id
  `).bind(childId, actorSubject, metadata, item.id, item.expectedRevision + 1);
}

function buildBatchAuditEnvelope(
  database: D1DatabaseLike,
  actorSubject: string,
  entityKey: string,
  result: AdminCategoryBatchResult,
): D1PreparedStatementLike {
  const metadata: CategoryBatchReplayMetadata = {
    changedCount: result.changedCount,
    requestId: entityKey.slice(CATEGORY_BATCH_ENTITY_KEY_PREFIX.length),
    selectedCount: result.selectedCount,
    skipped: result.skipped,
  };
  return database.prepare(`
    INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
    VALUES (?, ?, 'category.bulk_archived_batch', 'category', NULL, ?)
    RETURNING id
  `).bind(entityKey, actorSubject, JSON.stringify(metadata));
}

function assertBatchResults(results: D1BatchResultLike[], expectedLength: number, eligibleCount: number): void {
  if (results.length !== expectedLength || resultRowCount(results[0]) !== 1) {
    throw new AdminCategoryBatchStorageError("Không ghi được audit idempotency danh mục.");
  }
  let index = 1;
  for (let item = 0; item < eligibleCount; item += 1) {
    if (resultRowCount(results[index++]) !== 1 || resultRowCount(results[index++]) !== 0) {
      throw new AdminCategoryBatchConflictError("Danh mục đã thay đổi ở phiên khác. Hãy tải lại rồi thử lại.");
    }
    if (resultRowCount(results[index++]) !== 1) {
      throw new AdminCategoryBatchStorageError("Không ghi đủ audit danh mục.");
    }
  }
  if (resultRowCount(results[index]) !== 1) {
    throw new AdminCategoryBatchStorageError("Không ghi được audit envelope danh mục.");
  }
}

function resultRowCount(result: D1BatchResultLike | undefined): number {
  return Array.isArray(result?.results) ? result.results.length : 0;
}

async function tableExists(database: D1DatabaseLike, tableName: string): Promise<boolean> {
  const row = await database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1").bind(tableName).first<{ name: string }>();
  return Boolean(row?.name);
}

function requireBatch(database: D1DatabaseLike): D1DatabaseWithBatch {
  const candidate = database as D1DatabaseWithBatch;
  if (typeof candidate.batch !== "function") throw new AdminCategoryBatchStorageError("D1 batch() là bắt buộc để ẩn danh mục an toàn.");
  return candidate;
}

function categoryBatchEntityKey(requestId: string): string {
  return `${CATEGORY_BATCH_ENTITY_KEY_PREFIX}${requestId}`;
}

function isCategoryBatchStaleConstraint(error: unknown): boolean {
  return error instanceof Error && /UNIQUE constraint failed:\s*admin_audit_log\.request_id/i.test(error.message);
}

function isReplayMetadata(value: unknown): value is CategoryBatchReplayMetadata {
  return isRecord(value)
    && Number.isSafeInteger(value.changedCount)
    && Number(value.changedCount) >= 0
    && typeof value.requestId === "string"
    && Number.isSafeInteger(value.selectedCount)
    && Number(value.selectedCount) >= 1
    && Array.isArray(value.skipped)
    && Number(value.changedCount) + value.skipped.length === Number(value.selectedCount)
    && value.skipped.every(isReplaySkip);
}

function isReplaySkip(value: unknown): value is { id: number; reason: AdminCategoryBatchSkipReason } {
  return isRecord(value)
    && typeof value.id === "number"
    && Number.isSafeInteger(value.id)
    && value.id > 0
    && (value.reason === "already_archived" || value.reason === "not_found" || value.reason === "stale");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function fingerprint(input: Record<string, unknown>): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(input));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
