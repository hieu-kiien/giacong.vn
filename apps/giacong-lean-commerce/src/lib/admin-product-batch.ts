import type { D1DatabaseLike, D1PreparedStatementLike } from "./admin-data.ts";
import { isAdminRequestId } from "./admin-request.ts";

export const MAX_PRODUCT_BATCH_ITEMS = 100;
const PRODUCT_BATCH_ENTITY_PREFIX = "bulk-product-archive:";

export type AdminProductBatchSkipReason = "already_archived" | "not_found" | "stale";

export interface AdminProductBatchItem {
  expectedRevision: number;
  id: number;
}

export interface AdminProductBatchSnapshot {
  id: number;
  isActive: boolean;
  revision: number;
}

export interface AdminProductBatchResult {
  changedCount: number;
  replayed: boolean;
  selectedCount: number;
  skipped: Array<{ id: number; reason: AdminProductBatchSkipReason }>;
}

export class AdminProductBatchValidationError extends Error {}
export class AdminProductBatchConflictError extends Error {}
export class AdminProductBatchIdempotencyConflictError extends Error {}
export class AdminProductBatchStorageError extends Error {}

export function parseAdminProductBatchItems(value: unknown): AdminProductBatchItem[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_PRODUCT_BATCH_ITEMS) return null;
  const items: AdminProductBatchItem[] = [];
  for (const entry of value) {
    if (!isRecord(entry)
      || Object.keys(entry).length !== 2
      || typeof entry.id !== "number"
      || !Number.isSafeInteger(entry.id)
      || entry.id < 1
      || typeof entry.expectedRevision !== "number"
      || !Number.isSafeInteger(entry.expectedRevision)
      || entry.expectedRevision < 1) return null;
    items.push({ id: entry.id, expectedRevision: entry.expectedRevision });
  }
  if (new Set(items.map((item) => item.id)).size !== items.length) return null;
  return items.sort((left, right) => left.id - right.id);
}

export async function listAdminProductBatchSnapshots(
  database: D1DatabaseLike,
  ids: readonly number[],
): Promise<AdminProductBatchSnapshot[]> {
  const normalizedIds = normalizeProductIds(ids);
  const placeholders = normalizedIds.map(() => "?").join(", ");
  const result = await database.prepare(`
    SELECT id, revision, is_active
    FROM products
    WHERE id IN (${placeholders})
    ORDER BY id ASC
  `).bind(...normalizedIds).all<ProductSnapshotRow>();
  return result.results.map((row) => {
    if (!Number.isSafeInteger(row.id) || row.id < 1 || !Number.isSafeInteger(row.revision) || row.revision < 1) {
      throw new AdminProductBatchStorageError("Sản phẩm chưa có revision hợp lệ cho thao tác an toàn.");
    }
    return { id: row.id, isActive: row.is_active === 1, revision: row.revision };
  });
}

export async function archiveAdminProductsAtomically(
  database: D1DatabaseLike,
  input: { actorSubject: string; items: readonly AdminProductBatchItem[]; requestId: string },
): Promise<AdminProductBatchResult> {
  const items = normalizeBatchItems(input.items);
  const requestId = normalizeRequestId(input.requestId);
  const payloadSha256 = await fingerprint({ items, operation: "archive_batch" });
  const existingMutation = await findProductBatchMutation(database, requestId);
  if (existingMutation) {
    assertMatchingMutation(existingMutation, requestId, payloadSha256);
    return readProductBatchReplay(database, requestId, existingMutation, items);
  }

  const snapshots = await listAdminProductBatchSnapshots(database, items.map((item) => item.id));
  const byId = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  const skipped: Array<{ id: number; reason: AdminProductBatchSkipReason }> = [];
  for (const item of items) {
    const snapshot = byId.get(item.id);
    if (!snapshot) skipped.push({ id: item.id, reason: "not_found" });
    else if (snapshot.revision !== item.expectedRevision) skipped.push({ id: item.id, reason: "stale" });
    else if (!snapshot.isActive) skipped.push({ id: item.id, reason: "already_archived" });
  }
  const skippedIds = new Set(skipped.map((entry) => entry.id));
  const eligible = items.filter((item) => !skippedIds.has(item.id));
  const [hasAuditMarker, hasAuditLog, hasProductMeta] = await Promise.all([
    tableExists(database, "admin_audit_log"),
    tableExists(database, "audit_logs"),
    tableExists(database, "product_admin_meta"),
  ]);
  if (!hasAuditMarker || !hasAuditLog) throw new AdminProductBatchStorageError("Các bảng audit cần thiết cho ẩn sản phẩm hàng loạt chưa được triển khai.");

  const databaseWithBatch = requireBatch(database);
  const entityKey = `${PRODUCT_BATCH_ENTITY_PREFIX}${requestId}`;
  const result: AdminProductBatchResult = { changedCount: eligible.length, replayed: false, selectedCount: items.length, skipped };
  const statements: D1PreparedStatementLike[] = [buildAuditMarker(database, input.actorSubject, requestId, entityKey, payloadSha256)];
  for (const item of eligible) {
    statements.push(buildArchiveUpdate(database, item));
    statements.push(buildArchiveGuard(database, input.actorSubject, requestId, entityKey, payloadSha256, item));
    if (hasProductMeta) statements.push(buildProductMetaArchive(database, input.actorSubject, item));
    statements.push(buildProductAudit(database, input.actorSubject, requestId, item));
    statements.push(buildProductBatchItemPostcondition(
      database,
      input.actorSubject,
      requestId,
      entityKey,
      payloadSha256,
      item,
      hasProductMeta,
    ));
  }
  statements.push(buildBatchAuditEnvelope(database, input.actorSubject, entityKey, result));
  statements.push(buildProductBatchEnvelopePostcondition(database, requestId, entityKey, payloadSha256));

  try {
    await databaseWithBatch.batch(statements);
  } catch (error) {
    const racedMutation = await findProductBatchMutation(database, requestId);
    if (racedMutation) {
      assertMatchingMutation(racedMutation, requestId, payloadSha256);
      return readProductBatchReplay(database, requestId, racedMutation, items);
    }
    if (isStaleConstraint(error)) throw new AdminProductBatchConflictError("Sản phẩm đã thay đổi ở phiên khác. Hãy tải lại rồi thử lại.");
    throw normalizeProductBatchError(error);
  }
  return result;
}

interface ProductSnapshotRow { id: number; is_active: number; revision: number }
interface MutationRow { action: string; entity_key: string; entity_type: string; payload_sha256: string }
interface ReplayMetadata { changedCount: number; requestId: string; selectedCount: number; skipped: Array<{ id: number; reason: AdminProductBatchSkipReason }> }
interface BatchResult { results?: unknown[] }
interface DatabaseWithBatch extends D1DatabaseLike { batch(statements: D1PreparedStatementLike[]): Promise<BatchResult[]> }

function normalizeBatchItems(items: readonly AdminProductBatchItem[]): AdminProductBatchItem[] {
  const parsed = parseAdminProductBatchItems(items);
  if (!parsed) throw new AdminProductBatchValidationError("Danh sách sản phẩm hoặc revision không hợp lệ.");
  return parsed;
}

function normalizeProductIds(ids: readonly number[]): number[] {
  if (ids.length === 0 || ids.length > MAX_PRODUCT_BATCH_ITEMS) throw new AdminProductBatchValidationError("Mỗi lần chỉ được đọc tối đa 100 sản phẩm.");
  const normalized = [...ids].sort((left, right) => left - right);
  if (normalized.some((id) => !Number.isSafeInteger(id) || id < 1) || new Set(normalized).size !== normalized.length) {
    throw new AdminProductBatchValidationError("Danh sách sản phẩm không hợp lệ hoặc bị trùng.");
  }
  return normalized;
}

function normalizeRequestId(value: string): string {
  const requestId = value.trim().toLowerCase();
  if (!isAdminRequestId(requestId)) throw new AdminProductBatchValidationError("requestId phải là UUID hợp lệ.");
  return requestId;
}

async function findProductBatchMutation(database: D1DatabaseLike, requestId: string): Promise<MutationRow | null> {
  return database.prepare("SELECT action, entity_key, entity_type, payload_sha256 FROM admin_audit_log WHERE request_id = ? LIMIT 1").bind(requestId).first<MutationRow>();
}

function assertMatchingMutation(mutation: MutationRow, requestId: string, payloadSha256: string): void {
  if (mutation.action !== "delete" || mutation.entity_type !== "product" || mutation.entity_key !== `${PRODUCT_BATCH_ENTITY_PREFIX}${requestId}` || mutation.payload_sha256 !== payloadSha256) {
    throw new AdminProductBatchIdempotencyConflictError("requestId đã được dùng cho một payload khác.");
  }
}

async function readProductBatchReplay(
  database: D1DatabaseLike,
  requestId: string,
  mutation: MutationRow,
  items: readonly AdminProductBatchItem[],
): Promise<AdminProductBatchResult> {
  const envelope = await database.prepare("SELECT metadata_json FROM audit_logs WHERE id = ? AND action = 'product.bulk_archived_batch' AND entity_type = 'product' LIMIT 1").bind(mutation.entity_key).first<{ metadata_json: string }>();
  if (!envelope) throw new AdminProductBatchStorageError("Không đọc lại được kết quả ẩn sản phẩm hàng loạt.");
  let metadata: unknown;
  try { metadata = JSON.parse(envelope.metadata_json); } catch { throw new AdminProductBatchStorageError("Audit ẩn sản phẩm hàng loạt chứa metadata không hợp lệ."); }
  if (!isReplayMetadata(metadata) || metadata.requestId !== requestId || metadata.selectedCount !== items.length) throw new AdminProductBatchStorageError("Audit ẩn sản phẩm hàng loạt không khớp request.");
  const skippedIds = new Set(metadata.skipped.map((entry) => entry.id));
  const eligibleIds = items.filter((item) => !skippedIds.has(item.id)).map((item) => item.id);
  if (eligibleIds.length > 0) {
    const childIds = eligibleIds.map((id) => `${mutation.entity_key}:${id}`);
    const childAudits = await database.prepare(`
      SELECT id
      FROM audit_logs
      WHERE id IN (${childIds.map(() => "?").join(", ")})
        AND action = 'product.bulk_archived'
        AND entity_type = 'product'
    `).bind(...childIds).all<{ id: string }>();
    if (childAudits.results.length !== childIds.length
      || new Set(childAudits.results.map((row) => row.id)).size !== childIds.length) {
      throw new AdminProductBatchStorageError("Audit ẩn sản phẩm hàng loạt chưa đủ dữ liệu để replay.");
    }
  }
  return { changedCount: metadata.changedCount, replayed: true, selectedCount: metadata.selectedCount, skipped: metadata.skipped };
}

function buildAuditMarker(database: D1DatabaseLike, actor: string, requestId: string, entityKey: string, hash: string): D1PreparedStatementLike {
  return database.prepare("INSERT INTO admin_audit_log (request_id, actor_subject, action, entity_type, entity_key, previous_revision, resulting_revision, payload_sha256) VALUES (?, ?, 'delete', 'product', ?, NULL, NULL, ?) RETURNING request_id").bind(requestId, actor, entityKey, hash);
}

function buildArchiveUpdate(database: D1DatabaseLike, item: AdminProductBatchItem): D1PreparedStatementLike {
  return database.prepare("UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP, revision = revision + 1 WHERE id = ? AND revision = ? AND is_active = 1 RETURNING id, revision").bind(item.id, item.expectedRevision);
}

function buildArchiveGuard(database: D1DatabaseLike, actor: string, requestId: string, entityKey: string, hash: string, item: AdminProductBatchItem): D1PreparedStatementLike {
  return database.prepare("INSERT INTO admin_audit_log (request_id, actor_subject, action, entity_type, entity_key, previous_revision, resulting_revision, payload_sha256) SELECT ?, ?, 'delete', 'product', ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM products WHERE id = ? AND revision = ? AND is_active = 0) OR changes() <> 1").bind(requestId, actor, entityKey, item.expectedRevision, item.expectedRevision + 1, hash, item.id, item.expectedRevision + 1);
}

function buildProductMetaArchive(database: D1DatabaseLike, actor: string, item: AdminProductBatchItem): D1PreparedStatementLike {
  return database.prepare("INSERT INTO product_admin_meta (product_id, status, updated_by, updated_at) SELECT ?, 'archived', ?, CURRENT_TIMESTAMP WHERE EXISTS (SELECT 1 FROM products WHERE id = ? AND revision = ? AND is_active = 0) ON CONFLICT(product_id) DO UPDATE SET status = 'archived', updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP RETURNING product_id").bind(item.id, actor, item.id, item.expectedRevision + 1);
}

function buildProductAudit(database: D1DatabaseLike, actor: string, requestId: string, item: AdminProductBatchItem): D1PreparedStatementLike {
  const childId = `${PRODUCT_BATCH_ENTITY_PREFIX}${requestId}:${item.id}`;
  const metadata = JSON.stringify({ expectedRevision: item.expectedRevision, requestId, resultingRevision: item.expectedRevision + 1, source: "product_batch_archive" });
  return database.prepare("INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json) SELECT ?, ?, 'product.bulk_archived', 'product', CAST(id AS TEXT), ? FROM products WHERE id = ? AND revision = ? AND is_active = 0 RETURNING id").bind(childId, actor, metadata, item.id, item.expectedRevision + 1);
}

function buildBatchAuditEnvelope(database: D1DatabaseLike, actor: string, entityKey: string, result: AdminProductBatchResult): D1PreparedStatementLike {
  const metadata: ReplayMetadata = { changedCount: result.changedCount, requestId: entityKey.slice(PRODUCT_BATCH_ENTITY_PREFIX.length), selectedCount: result.selectedCount, skipped: result.skipped };
  return database.prepare("INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json) VALUES (?, ?, 'product.bulk_archived_batch', 'product', NULL, ?) RETURNING id").bind(entityKey, actor, JSON.stringify(metadata));
}

function buildProductBatchItemPostcondition(
  database: D1DatabaseLike,
  actor: string,
  requestId: string,
  entityKey: string,
  hash: string,
  item: AdminProductBatchItem,
  hasProductMeta: boolean,
): D1PreparedStatementLike {
  const childId = `${entityKey}:${item.id}`;
  const metaClause = hasProductMeta
    ? "AND EXISTS (SELECT 1 FROM product_admin_meta WHERE product_id = ? AND status = 'archived' AND updated_by = ?)"
    : "";
  const values: unknown[] = [
    requestId,
    entityKey,
    hash,
    item.id,
    item.expectedRevision + 1,
  ];
  if (hasProductMeta) values.push(item.id, actor);
  values.push(childId, String(item.id));
  return database.prepare(`
    /* product batch postcondition */
    INSERT INTO admin_audit_log (
      request_id, actor_subject, action, entity_type, entity_key,
      previous_revision, resulting_revision, payload_sha256
    )
    SELECT NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
    WHERE NOT (
      EXISTS (
        SELECT 1 FROM admin_audit_log
        WHERE request_id = ?
          AND action = 'delete'
          AND entity_type = 'product'
          AND entity_key = ?
          AND payload_sha256 = ?
      )
      AND EXISTS (
        SELECT 1 FROM products
        WHERE id = ? AND revision = ? AND is_active = 0
      )
      ${metaClause}
      AND EXISTS (
        SELECT 1 FROM audit_logs
        WHERE id = ?
          AND action = 'product.bulk_archived'
          AND entity_type = 'product'
          AND entity_id = ?
      )
    )
  `).bind(...values);
}

function buildProductBatchEnvelopePostcondition(
  database: D1DatabaseLike,
  requestId: string,
  entityKey: string,
  hash: string,
): D1PreparedStatementLike {
  return database.prepare(`
    /* product batch postcondition */
    INSERT INTO admin_audit_log (
      request_id, actor_subject, action, entity_type, entity_key,
      previous_revision, resulting_revision, payload_sha256
    )
    SELECT NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
    WHERE NOT (
      EXISTS (
        SELECT 1 FROM admin_audit_log
        WHERE request_id = ?
          AND action = 'delete'
          AND entity_type = 'product'
          AND entity_key = ?
          AND payload_sha256 = ?
      )
      AND EXISTS (
        SELECT 1 FROM audit_logs
        WHERE id = ?
          AND action = 'product.bulk_archived_batch'
          AND entity_type = 'product'
      )
    )
  `).bind(requestId, entityKey, hash, entityKey);
}

async function tableExists(database: D1DatabaseLike, tableName: string): Promise<boolean> {
  const row = await database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1").bind(tableName).first<{ name: string }>();
  return Boolean(row?.name);
}

function requireBatch(database: D1DatabaseLike): DatabaseWithBatch {
  const candidate = database as DatabaseWithBatch;
  if (typeof candidate.batch !== "function") throw new AdminProductBatchStorageError("D1 batch() là bắt buộc để ẩn sản phẩm an toàn.");
  return candidate;
}

function isStaleConstraint(error: unknown): boolean { return error instanceof Error && /UNIQUE constraint failed:\s*admin_audit_log\.request_id/i.test(error.message); }
function normalizeProductBatchError(error: unknown): unknown {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("product batch postcondition")
    || (message.includes("admin_audit_log") && message.toLowerCase().includes("constraint failed"))) {
    return new AdminProductBatchStorageError("Không ghi đồng bộ được sản phẩm và audit; hệ thống đã rollback để tránh trạng thái dở dang.");
  }
  return error;
}
function isReplayMetadata(value: unknown): value is ReplayMetadata {
  return isRecord(value) && Number.isSafeInteger(value.changedCount) && Number(value.changedCount) >= 0 && typeof value.requestId === "string" && Number.isSafeInteger(value.selectedCount) && Number(value.selectedCount) >= 1 && Array.isArray(value.skipped) && Number(value.changedCount) + value.skipped.length === Number(value.selectedCount) && value.skipped.every(isReplaySkip);
}
function isReplaySkip(value: unknown): value is { id: number; reason: AdminProductBatchSkipReason } { return isRecord(value) && typeof value.id === "number" && Number.isSafeInteger(value.id) && value.id > 0 && (value.reason === "already_archived" || value.reason === "not_found" || value.reason === "stale"); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
async function fingerprint(input: Record<string, unknown>): Promise<string> { const bytes = new TextEncoder().encode(JSON.stringify(input)); const digest = await crypto.subtle.digest("SHA-256", bytes); return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(""); }
