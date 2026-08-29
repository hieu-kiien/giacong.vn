import type { D1DatabaseLike, D1PreparedStatementLike } from "./admin-data.ts";
import { isAdminRequestId } from "./admin-request.ts";

const MAX_SERVICE_BATCH_ITEMS = 100;
const SERVICE_BATCH_OPERATION = "archive_batch";
const SERVICE_BATCH_ENTITY_KEY_PREFIX = "bulk-service-archive:";

export const ADMIN_SERVICE_BATCH_IDEMPOTENCY_CONFLICT = "IDEMPOTENCY_CONFLICT";

export type AdminServiceBatchSkipReason = "already_archived" | "not_found" | "stale";

export interface AdminServiceBatchItem {
  expectedRevision: number;
  id: number;
}

export interface AdminServiceBatchSnapshot {
  id: number;
  isActive: boolean;
  revision: number;
}

export interface AdminServiceBatchResult {
  changedCount: number;
  replayed: boolean;
  selectedCount: number;
  skipped: Array<{ id: number; reason: AdminServiceBatchSkipReason }>;
}

export class AdminServiceBatchValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminServiceBatchValidationError";
  }
}

export class AdminServiceBatchConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminServiceBatchConflictError";
  }
}

export class AdminServiceBatchIdempotencyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminServiceBatchIdempotencyConflictError";
  }
}

export class AdminServiceBatchStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminServiceBatchStorageError";
  }
}

export function parseAdminServiceBatchItems(value: unknown): AdminServiceBatchItem[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_SERVICE_BATCH_ITEMS) return null;
  const items: AdminServiceBatchItem[] = [];
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

export async function listAdminServiceBatchSnapshots(
  database: D1DatabaseLike,
  ids: readonly number[],
): Promise<AdminServiceBatchSnapshot[]> {
  const normalizedIds = normalizeServiceIds(ids);
  const placeholders = normalizedIds.map(() => "?").join(", ");
  const result = await database.prepare(`
    SELECT id, revision, is_active
    FROM services
    WHERE id IN (${placeholders})
    ORDER BY id ASC
  `).bind(...normalizedIds).all<ServiceSnapshotRow>();

  return result.results.map((row) => {
    if (!Number.isSafeInteger(row.id) || row.id < 1 || !Number.isSafeInteger(row.revision) || row.revision < 1) {
      throw new AdminServiceBatchStorageError("Dịch vụ chưa có revision hợp lệ cho thao tác an toàn.");
    }
    return { id: row.id, isActive: row.is_active === 1, revision: row.revision };
  });
}

export async function archiveAdminServicesAtomically(
  database: D1DatabaseLike,
  input: {
    actorSubject: string;
    items: readonly AdminServiceBatchItem[];
    requestId: string;
  },
): Promise<AdminServiceBatchResult> {
  const items = normalizeBatchItems(input.items);
  const requestId = normalizeRequestId(input.requestId);
  const payloadSha256 = await fingerprint({ items, operation: SERVICE_BATCH_OPERATION });
  const existingMutation = await findServiceBatchMutation(database, requestId);
  if (existingMutation) {
    assertMatchingMutation(existingMutation, requestId, payloadSha256);
    return readServiceBatchReplay(database, requestId, existingMutation, items.length);
  }

  const snapshots = await listAdminServiceBatchSnapshots(database, items.map((item) => item.id));
  const snapshotsById = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  const skipped: Array<{ id: number; reason: AdminServiceBatchSkipReason }> = [];
  for (const item of items) {
    const snapshot = snapshotsById.get(item.id);
    if (!snapshot) skipped.push({ id: item.id, reason: "not_found" });
    else if (snapshot.revision !== item.expectedRevision) skipped.push({ id: item.id, reason: "stale" });
    else if (!snapshot.isActive) skipped.push({ id: item.id, reason: "already_archived" });
  }
  const eligible = items.filter((item) => !skipped.some((entry) => entry.id === item.id));

  const [hasAuditMarker, hasAuditLog, hasServiceMeta] = await Promise.all([
    tableExists(database, "admin_audit_log"),
    tableExists(database, "audit_logs"),
    tableExists(database, "service_admin_meta"),
  ]);
  if (!hasAuditMarker || !hasAuditLog) {
    throw new AdminServiceBatchStorageError("Các bảng audit cần thiết cho ẩn hàng loạt chưa được triển khai.");
  }

  const databaseWithBatch = requireBatch(database);
  const envelopeId = serviceBatchEntityKey(requestId);
  const result: AdminServiceBatchResult = {
    changedCount: eligible.length,
    replayed: false,
    selectedCount: items.length,
    skipped,
  };
  const statements: D1PreparedStatementLike[] = [buildAuditMarker(database, input.actorSubject, requestId, envelopeId, payloadSha256)];

  for (const item of eligible) {
    statements.push(buildArchiveUpdate(database, item));
    statements.push(buildArchiveGuard(database, input.actorSubject, requestId, envelopeId, payloadSha256, item));
    if (hasServiceMeta) statements.push(buildServiceMetaArchive(database, input.actorSubject, item));
    statements.push(buildServiceAudit(database, input.actorSubject, requestId, item));
  }
  statements.push(buildBatchAuditEnvelope(database, input.actorSubject, envelopeId, result));

  let batchResults: D1BatchResultLike[];
  try {
    batchResults = await databaseWithBatch.batch(statements);
  } catch (error) {
    const racedMutation = await findServiceBatchMutation(database, requestId);
    if (racedMutation) {
      assertMatchingMutation(racedMutation, requestId, payloadSha256);
      return readServiceBatchReplay(database, requestId, racedMutation, items.length);
    }
    throw error;
  }
  assertBatchResults(batchResults, statements.length, eligible.length, hasServiceMeta);

  return result;
}

interface ServiceSnapshotRow {
  id: number;
  is_active: number;
  revision: number;
}

interface ServiceBatchMutationRow {
  action: string;
  entity_key: string;
  entity_type: string;
  payload_sha256: string;
}

interface ServiceBatchReplayMetadata {
  changedCount: number;
  requestId: string;
  selectedCount: number;
  skipped: Array<{ id: number; reason: AdminServiceBatchSkipReason }>;
}

interface D1BatchResultLike {
  results?: unknown[];
}

interface D1DatabaseWithBatch extends D1DatabaseLike {
  batch(statements: D1PreparedStatementLike[]): Promise<D1BatchResultLike[]>;
}

function normalizeBatchItems(items: readonly AdminServiceBatchItem[]): AdminServiceBatchItem[] {
  const parsed = parseAdminServiceBatchItems(items);
  if (!parsed) throw new AdminServiceBatchValidationError("Danh sách dịch vụ hoặc revision không hợp lệ.");
  return parsed;
}

function normalizeServiceIds(ids: readonly number[]): number[] {
  if (ids.length === 0 || ids.length > MAX_SERVICE_BATCH_ITEMS) {
    throw new AdminServiceBatchValidationError("Mỗi lần chỉ được đọc tối đa 100 dịch vụ.");
  }
  const normalized = [...ids].sort((left, right) => left - right);
  if (normalized.some((id) => !Number.isSafeInteger(id) || id < 1)
    || new Set(normalized).size !== normalized.length) {
    throw new AdminServiceBatchValidationError("Danh sách dịch vụ không hợp lệ hoặc bị trùng.");
  }
  return normalized;
}

function normalizeRequestId(value: string): string {
  const requestId = value.trim().toLowerCase();
  if (!isAdminRequestId(requestId)) throw new AdminServiceBatchValidationError("requestId phải là UUID hợp lệ.");
  return requestId;
}

async function findServiceBatchMutation(
  database: D1DatabaseLike,
  requestId: string,
): Promise<ServiceBatchMutationRow | null> {
  return database.prepare(`
    SELECT action, entity_key, entity_type, payload_sha256
    FROM admin_audit_log
    WHERE request_id = ?
    LIMIT 1
  `).bind(requestId).first<ServiceBatchMutationRow>();
}

function assertMatchingMutation(
  mutation: ServiceBatchMutationRow,
  requestId: string,
  payloadSha256: string,
): void {
  if (mutation.action !== "delete"
    || mutation.entity_type !== "service"
    || mutation.entity_key !== serviceBatchEntityKey(requestId)
    || mutation.payload_sha256 !== payloadSha256) {
    throw new AdminServiceBatchIdempotencyConflictError("requestId đã được dùng cho một payload khác.");
  }
}

async function readServiceBatchReplay(
  database: D1DatabaseLike,
  requestId: string,
  mutation: ServiceBatchMutationRow,
  selectedCount: number,
): Promise<AdminServiceBatchResult> {
  const envelope = await database.prepare(`
    SELECT metadata_json
    FROM audit_logs
    WHERE id = ? AND action = 'service.bulk_archived_batch' AND entity_type = 'service'
    LIMIT 1
  `).bind(mutation.entity_key).first<{ metadata_json: string }>();
  if (!envelope) throw new AdminServiceBatchStorageError("Không đọc lại được kết quả ẩn dịch vụ hàng loạt.");

  let metadata: unknown;
  try {
    metadata = JSON.parse(envelope.metadata_json);
  } catch {
    throw new AdminServiceBatchStorageError("Audit ẩn dịch vụ hàng loạt chứa metadata không hợp lệ.");
  }
  if (!isReplayMetadata(metadata)
    || metadata.requestId !== requestId
    || metadata.selectedCount !== selectedCount) {
    throw new AdminServiceBatchStorageError("Audit ẩn dịch vụ hàng loạt không khớp request.");
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
    ) VALUES (?, ?, 'delete', 'service', ?, NULL, NULL, ?)
    RETURNING request_id
  `).bind(requestId, actorSubject, entityKey, payloadSha256);
}

function buildArchiveUpdate(
  database: D1DatabaseLike,
  item: AdminServiceBatchItem,
): D1PreparedStatementLike {
  return database.prepare(`
    UPDATE services
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
  item: AdminServiceBatchItem,
): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO admin_audit_log (
      request_id, actor_subject, action, entity_type, entity_key,
      previous_revision, resulting_revision, payload_sha256
    )
    SELECT ?, ?, 'delete', 'service', ?, ?, ?, ?
    WHERE NOT EXISTS (
      SELECT 1 FROM services
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

function buildServiceMetaArchive(
  database: D1DatabaseLike,
  actorSubject: string,
  item: AdminServiceBatchItem,
): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO service_admin_meta (service_id, status, updated_by, updated_at)
    SELECT ?, 'archived', ?, CURRENT_TIMESTAMP
    WHERE EXISTS (
      SELECT 1 FROM services
      WHERE id = ? AND revision = ? AND is_active = 0
    )
    ON CONFLICT(service_id) DO UPDATE SET
      status = 'archived', updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP
    RETURNING service_id
  `).bind(item.id, actorSubject, item.id, item.expectedRevision + 1);
}

function buildServiceAudit(
  database: D1DatabaseLike,
  actorSubject: string,
  requestId: string,
  item: AdminServiceBatchItem,
): D1PreparedStatementLike {
  const childAuditId = `${serviceBatchEntityKey(requestId)}:${item.id}`;
  const metadata = JSON.stringify({
    expectedRevision: item.expectedRevision,
    requestId,
    resultingRevision: item.expectedRevision + 1,
    source: "service_batch_archive",
  });
  return database.prepare(`
    INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
    SELECT ?, ?, 'service.bulk_archived', 'service', CAST(id AS TEXT), ?
    FROM services
    WHERE id = ? AND revision = ? AND is_active = 0
    RETURNING id
  `).bind(childAuditId, actorSubject, metadata, item.id, item.expectedRevision + 1);
}

function buildBatchAuditEnvelope(
  database: D1DatabaseLike,
  actorSubject: string,
  entityKey: string,
  result: AdminServiceBatchResult,
): D1PreparedStatementLike {
  const metadata = JSON.stringify({
    changedCount: result.changedCount,
    requestId: entityKey.slice(SERVICE_BATCH_ENTITY_KEY_PREFIX.length),
    selectedCount: result.selectedCount,
    skipped: result.skipped,
  } satisfies ServiceBatchReplayMetadata);
  return database.prepare(`
    INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
    VALUES (?, ?, 'service.bulk_archived_batch', 'service', NULL, ?)
    RETURNING id
  `).bind(entityKey, actorSubject, metadata);
}

function assertBatchResults(
  results: D1BatchResultLike[],
  expectedLength: number,
  eligibleCount: number,
  hasServiceMeta: boolean,
): void {
  if (results.length !== expectedLength) throw new AdminServiceBatchStorageError("D1 service batch trả về kết quả không hợp lệ.");
  if (resultRowCount(results[0]) !== 1) throw new AdminServiceBatchStorageError("Không ghi được audit idempotency dịch vụ.");

  let index = 1;
  for (let item = 0; item < eligibleCount; item += 1) {
    if (resultRowCount(results[index]) !== 1) throw new AdminServiceBatchConflictError("Dịch vụ đã thay đổi ở phiên khác. Hãy tải lại rồi thử lại.");
    index += 1;
    if (resultRowCount(results[index]) !== 0) throw new AdminServiceBatchConflictError("Dịch vụ đã thay đổi ở phiên khác. Hãy tải lại rồi thử lại.");
    index += 1;
    if (hasServiceMeta) {
      if (resultRowCount(results[index]) !== 1) throw new AdminServiceBatchStorageError("Không đồng bộ được trạng thái dịch vụ.");
      index += 1;
    }
    if (resultRowCount(results[index]) !== 1) throw new AdminServiceBatchStorageError("Không ghi đủ audit dịch vụ.");
    index += 1;
  }
  if (resultRowCount(results[index]) !== 1) throw new AdminServiceBatchStorageError("Không ghi được audit envelope dịch vụ.");
}

function resultRowCount(result: D1BatchResultLike | undefined): number {
  return Array.isArray(result?.results) ? result.results.length : 0;
}

async function tableExists(database: D1DatabaseLike, tableName: string): Promise<boolean> {
  const row = await database.prepare(`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1
  `).bind(tableName).first<{ name: string }>();
  return Boolean(row?.name);
}

function requireBatch(database: D1DatabaseLike): D1DatabaseWithBatch {
  const candidate = database as D1DatabaseWithBatch;
  if (typeof candidate.batch !== "function") {
    throw new AdminServiceBatchStorageError("D1 batch() là bắt buộc để ẩn dịch vụ an toàn.");
  }
  return candidate;
}

function serviceBatchEntityKey(requestId: string): string {
  return `${SERVICE_BATCH_ENTITY_KEY_PREFIX}${requestId}`;
}

async function fingerprint(input: Record<string, unknown>): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(input));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isReplayMetadata(value: unknown): value is ServiceBatchReplayMetadata {
  if (!isRecord(value)
    || typeof value.changedCount !== "number"
    || !Number.isSafeInteger(value.changedCount)
    || value.changedCount < 0
    || typeof value.requestId !== "string"
    || typeof value.selectedCount !== "number"
    || !Number.isSafeInteger(value.selectedCount)
    || value.selectedCount < 1
    || !Array.isArray(value.skipped)
    || value.changedCount + value.skipped.length !== value.selectedCount) {
    return false;
  }
  return value.skipped.every(isReplaySkip);
}

function isReplaySkip(value: unknown): value is { id: number; reason: AdminServiceBatchSkipReason } {
  return isRecord(value)
    && typeof value.id === "number"
    && Number.isSafeInteger(value.id)
    && value.id > 0
    && (value.reason === "already_archived" || value.reason === "not_found" || value.reason === "stale");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
