import type {
  AdminServiceInput,
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "./admin-data.ts";
import { tableExists } from "./admin-data.ts";
import { isAdminRequestId } from "./admin-request.ts";

export class AdminServiceWriteConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminServiceWriteConflictError";
  }
}

export class AdminServiceWriteIdempotencyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminServiceWriteIdempotencyConflictError";
  }
}

export class AdminServiceWriteStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminServiceWriteStorageError";
  }
}

export class AdminServiceWriteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminServiceWriteValidationError";
  }
}

interface ServiceMutationRow {
  action: "create" | "delete" | "update";
  entity_key: string;
  entity_type: "service";
  payload_sha256: string;
  request_id: string;
}

interface ServiceRevisionRow {
  id: number;
  revision: number;
}

interface D1BatchResultLike {
  meta?: { changes?: unknown };
  results?: unknown[];
}

interface D1DatabaseWithBatch extends D1DatabaseLike {
  batch(statements: D1PreparedStatementLike[]): Promise<D1BatchResultLike[]>;
}

type ServiceMutationAction = "create" | "delete" | "update";
type ServiceLegacyAction = "service.archived" | "service.created" | "service.updated";

export async function createAdminServiceAtomically(
  database: D1DatabaseLike,
  input: AdminServiceInput,
  actorSubject: string,
  requestId: string,
): Promise<number> {
  const normalizedRequestId = normalizeRequestId(requestId);
  const payloadSha256 = await fingerprint({
    entityType: "service",
    input: canonicalServiceInput(input),
    operation: "create",
  });
  const hasMeta = await requireAuditTables(database);
  const existingMutation = await findMutation(database, normalizedRequestId);
  if (existingMutation) {
    assertMatchingMutation(existingMutation, normalizedRequestId, "create", undefined, payloadSha256);
    return readMutationId(existingMutation);
  }

  const databaseWithBatch = requireBatch(database);
  const statements: D1PreparedStatementLike[] = [
    buildServiceInsert(database, input),
    buildCreateMutation(database, normalizedRequestId, actorSubject, input.slug, payloadSha256),
    buildLegacyAudit(database, normalizedRequestId, actorSubject, "service.created", "create", input.slug, payloadSha256),
  ];
  if (hasMeta) statements.push(buildServiceMetaWrite(database, normalizedRequestId, actorSubject, input));

  try {
    const results = await databaseWithBatch.batch(statements);
    assertRows(results[0], "Không ghi được dịch vụ.");
    assertRows(results[1], "Không ghi được audit dịch vụ.");
    assertRows(results[2], "Không ghi được lịch sử dịch vụ.");
    if (hasMeta) assertRows(results[3], "Không đồng bộ được trạng thái dịch vụ.");
  } catch (error) {
    const racedMutation = await findMutation(database, normalizedRequestId);
    if (racedMutation) {
      assertMatchingMutation(racedMutation, normalizedRequestId, "create", undefined, payloadSha256);
      return readMutationId(racedMutation);
    }
    throw error;
  }

  const mutation = await findMutation(database, normalizedRequestId);
  if (!mutation) throw new AdminServiceWriteStorageError("Không đọc lại được audit dịch vụ vừa tạo.");
  assertMatchingMutation(mutation, normalizedRequestId, "create", undefined, payloadSha256);
  return readMutationId(mutation);
}

export async function updateAdminServiceAtomically(
  database: D1DatabaseLike,
  id: number,
  input: AdminServiceInput,
  expectedRevisionRaw: unknown,
  actorSubject: string,
  requestId: string,
): Promise<number | null> {
  const expectedRevision = requireRevision(expectedRevisionRaw, "cập nhật");
  const normalizedRequestId = normalizeRequestId(requestId);
  const payloadSha256 = await fingerprint({
    entityType: "service",
    expectedRevision,
    id,
    input: canonicalServiceInput(input),
    operation: "update",
  });
  const hasMeta = await requireAuditTables(database);
  const existingMutation = await findMutation(database, normalizedRequestId);
  if (existingMutation) {
    assertMatchingMutation(existingMutation, normalizedRequestId, "update", String(id), payloadSha256);
    return readMutationId(existingMutation);
  }

  const existing = await readServiceRevision(database, id);
  if (!existing) return null;
  assertExpectedRevision(existing.revision, expectedRevision, "Dịch vụ đã thay đổi. Hãy tải lại trước khi lưu.");

  const databaseWithBatch = requireBatch(database);
  const statements: D1PreparedStatementLike[] = [
    buildServiceUpdate(database, id, input, expectedRevision),
    buildRevisionMutation(database, normalizedRequestId, actorSubject, "update", id, expectedRevision, payloadSha256),
    buildLegacyAudit(database, normalizedRequestId, actorSubject, "service.updated", "id", id, payloadSha256, expectedRevision),
  ];
  if (hasMeta) statements.push(buildServiceMetaWrite(database, normalizedRequestId, actorSubject, input, id));

  try {
    const results = await databaseWithBatch.batch(statements);
    if (!hasRows(results[0])) return resolveServiceConflict(database, normalizedRequestId, payloadSha256, "update", id);
    assertRows(results[1], "Không ghi được audit dịch vụ.");
    assertRows(results[2], "Không ghi được lịch sử dịch vụ.");
    if (hasMeta) assertRows(results[3], "Không đồng bộ được trạng thái dịch vụ.");
  } catch (error) {
    const racedMutation = await findMutation(database, normalizedRequestId);
    if (racedMutation) {
      assertMatchingMutation(racedMutation, normalizedRequestId, "update", String(id), payloadSha256);
      return readMutationId(racedMutation);
    }
    throw error;
  }
  return id;
}

export async function archiveAdminServiceAtomically(
  database: D1DatabaseLike,
  id: number,
  expectedRevisionRaw: unknown,
  actorSubject: string,
  requestId: string,
): Promise<number | null> {
  const expectedRevision = requireRevision(expectedRevisionRaw, "ẩn");
  const normalizedRequestId = normalizeRequestId(requestId);
  const payloadSha256 = await fingerprint({
    entityType: "service",
    expectedRevision,
    id,
    operation: "archive",
  });
  const hasMeta = await requireAuditTables(database);
  const existingMutation = await findMutation(database, normalizedRequestId);
  if (existingMutation) {
    assertMatchingMutation(existingMutation, normalizedRequestId, "delete", String(id), payloadSha256);
    return readMutationId(existingMutation);
  }

  const existing = await readServiceRevision(database, id);
  if (!existing) return null;
  assertExpectedRevision(existing.revision, expectedRevision, "Dịch vụ đã thay đổi. Hãy tải lại trước khi ẩn.");

  const databaseWithBatch = requireBatch(database);
  const statements: D1PreparedStatementLike[] = [
    buildServiceArchive(database, id, expectedRevision),
    buildRevisionMutation(database, normalizedRequestId, actorSubject, "delete", id, expectedRevision, payloadSha256),
    buildLegacyAudit(database, normalizedRequestId, actorSubject, "service.archived", "id", id, payloadSha256, expectedRevision),
  ];
  if (hasMeta) statements.push(buildServiceArchiveMeta(database, normalizedRequestId, actorSubject, id));

  try {
    const results = await databaseWithBatch.batch(statements);
    if (!hasRows(results[0])) return resolveServiceConflict(database, normalizedRequestId, payloadSha256, "delete", id);
    assertRows(results[1], "Không ghi được audit ẩn dịch vụ.");
    assertRows(results[2], "Không ghi được lịch sử ẩn dịch vụ.");
    if (hasMeta) assertRows(results[3], "Không đồng bộ được trạng thái dịch vụ.");
  } catch (error) {
    const racedMutation = await findMutation(database, normalizedRequestId);
    if (racedMutation) {
      assertMatchingMutation(racedMutation, normalizedRequestId, "delete", String(id), payloadSha256);
      return readMutationId(racedMutation);
    }
    throw error;
  }
  return id;
}

async function requireAuditTables(database: D1DatabaseLike): Promise<boolean> {
  const [hasMarker, hasLegacyAudit] = await Promise.all([
    tableExists(database, "admin_audit_log"),
    tableExists(database, "audit_logs"),
  ]);
  if (!hasMarker || !hasLegacyAudit) {
    throw new AdminServiceWriteStorageError("Các bảng audit dịch vụ chưa được triển khai.");
  }
  return tableExists(database, "service_admin_meta");
}

async function findMutation(database: D1DatabaseLike, requestId: string): Promise<ServiceMutationRow | null> {
  return database.prepare(`
    SELECT action, entity_key, entity_type, payload_sha256, request_id
    FROM admin_audit_log
    WHERE request_id = ?
    LIMIT 1
  `).bind(requestId).first<ServiceMutationRow>();
}

async function readServiceRevision(database: D1DatabaseLike, id: number): Promise<ServiceRevisionRow | null> {
  const row = await database.prepare(`
    SELECT id, revision
    FROM services
    WHERE id = ?
    LIMIT 1
  `).bind(id).first<ServiceRevisionRow>();
  if (!row) return null;
  if (!Number.isSafeInteger(row.id) || row.id < 1 || !Number.isSafeInteger(row.revision) || row.revision < 1) {
    throw new AdminServiceWriteStorageError("Dịch vụ chưa có revision hợp lệ cho thao tác an toàn.");
  }
  return row;
}

function buildServiceInsert(database: D1DatabaseLike, input: AdminServiceInput): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO services (slug, name, summary, description, image_url, meta_title, is_active, revision)
    VALUES (?, ?, ?, ?, ?, '', ?, 1)
    RETURNING id, revision
  `).bind(
    input.slug,
    input.name,
    input.summary,
    input.description,
    input.imageUrl,
    input.isActive ? 1 : 0,
  );
}

function buildServiceUpdate(
  database: D1DatabaseLike,
  id: number,
  input: AdminServiceInput,
  expectedRevision: number,
): D1PreparedStatementLike {
  return database.prepare(`
    UPDATE services
    SET slug = ?, name = ?, summary = ?, description = ?, image_url = ?,
      is_active = ?, updated_at = CURRENT_TIMESTAMP, revision = revision + 1
    WHERE id = ? AND revision = ?
    RETURNING id, revision
  `).bind(
    input.slug,
    input.name,
    input.summary,
    input.description,
    input.imageUrl,
    input.isActive ? 1 : 0,
    id,
    expectedRevision,
  );
}

function buildServiceArchive(
  database: D1DatabaseLike,
  id: number,
  expectedRevision: number,
): D1PreparedStatementLike {
  return database.prepare(`
    UPDATE services
    SET is_active = 0, updated_at = CURRENT_TIMESTAMP, revision = revision + 1
    WHERE id = ? AND revision = ?
    RETURNING id, revision
  `).bind(id, expectedRevision);
}

function buildCreateMutation(
  database: D1DatabaseLike,
  requestId: string,
  actorSubject: string,
  slug: string,
  payloadSha256: string,
): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO admin_audit_log (
      request_id, actor_subject, action, entity_type, entity_key,
      previous_revision, resulting_revision, payload_sha256
    )
    SELECT ?, ?, 'create', 'service', CAST(id AS TEXT), NULL, revision, ?
    FROM services
    WHERE slug = ? AND changes() = 1
    LIMIT 1
    RETURNING request_id
  `).bind(requestId, actorSubject, payloadSha256, slug);
}

function buildRevisionMutation(
  database: D1DatabaseLike,
  requestId: string,
  actorSubject: string,
  action: Exclude<ServiceMutationAction, "create">,
  id: number,
  expectedRevision: number,
  payloadSha256: string,
): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO admin_audit_log (
      request_id, actor_subject, action, entity_type, entity_key,
      previous_revision, resulting_revision, payload_sha256
    )
    SELECT ?, ?, '${action}', 'service', CAST(id AS TEXT), ?, revision, ?
    FROM services
    WHERE id = ? AND revision = ? AND changes() = 1
    LIMIT 1
    RETURNING request_id
  `).bind(requestId, actorSubject, expectedRevision, payloadSha256, id, expectedRevision + 1);
}

function buildLegacyAudit(
  database: D1DatabaseLike,
  requestId: string,
  actorSubject: string,
  action: ServiceLegacyAction,
  lookup: "create" | "id",
  lookupValue: string | number,
  payloadSha256: string,
  expectedRevision?: number,
): D1PreparedStatementLike {
  const metadata = JSON.stringify({
    expectedRevision: expectedRevision ?? null,
    payloadSha256,
    requestId,
  });
  const where = lookup === "create" ? "slug = ?" : "id = ?";
  return database.prepare(`
    INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
    SELECT ?, ?, '${action}', 'service', CAST(id AS TEXT), ?
    FROM services
    WHERE ${where}
      AND EXISTS (SELECT 1 FROM admin_audit_log WHERE request_id = ?)
      AND changes() = 1
    LIMIT 1
    RETURNING id
  `).bind(crypto.randomUUID(), actorSubject, metadata, lookupValue, requestId);
}

function buildServiceMetaWrite(
  database: D1DatabaseLike,
  requestId: string,
  actorSubject: string,
  input: AdminServiceInput,
  id?: number,
): D1PreparedStatementLike {
  const idExpression = id === undefined
    ? "(SELECT CAST(entity_key AS INTEGER) FROM admin_audit_log WHERE request_id = ?)"
    : "?";
  const values = id === undefined
    ? [requestId, input.status, input.leadTimeDays, input.moqSummary, actorSubject, requestId]
    : [id, input.status, input.leadTimeDays, input.moqSummary, actorSubject, requestId];
  return database.prepare(`
    INSERT INTO service_admin_meta (service_id, status, lead_time_days, moq_summary, updated_by, updated_at)
    SELECT ${idExpression}, ?, ?, ?, ?, CURRENT_TIMESTAMP
    WHERE EXISTS (SELECT 1 FROM admin_audit_log WHERE request_id = ?)
      AND changes() = 1
    ON CONFLICT(service_id) DO UPDATE SET
      status = excluded.status,
      lead_time_days = excluded.lead_time_days,
      moq_summary = excluded.moq_summary,
      updated_by = excluded.updated_by,
      updated_at = CURRENT_TIMESTAMP
    RETURNING service_id
  `).bind(...values);
}

function buildServiceArchiveMeta(
  database: D1DatabaseLike,
  requestId: string,
  actorSubject: string,
  id: number,
): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO service_admin_meta (service_id, status, updated_by, updated_at)
    SELECT ?, 'archived', ?, CURRENT_TIMESTAMP
    WHERE EXISTS (SELECT 1 FROM admin_audit_log WHERE request_id = ?)
      AND changes() = 1
    ON CONFLICT(service_id) DO UPDATE SET
      status = 'archived',
      updated_by = excluded.updated_by,
      updated_at = CURRENT_TIMESTAMP
    RETURNING service_id
  `).bind(id, actorSubject, requestId);
}

async function resolveServiceConflict(
  database: D1DatabaseLike,
  requestId: string,
  payloadSha256: string,
  action: ServiceMutationAction,
  id: number,
): Promise<number> {
  const mutation = await findMutation(database, requestId);
  if (mutation) {
    assertMatchingMutation(mutation, requestId, action, String(id), payloadSha256);
    return readMutationId(mutation);
  }
  throw new AdminServiceWriteConflictError("Dịch vụ đã thay đổi ở phiên khác. Hãy tải lại rồi thử lại.");
}

function assertMatchingMutation(
  mutation: ServiceMutationRow,
  requestId: string,
  action: ServiceMutationAction,
  entityKey: string | undefined,
  payloadSha256: string,
): void {
  const entityMatches = entityKey === undefined
    ? isPositiveEntityKey(mutation.entity_key)
    : mutation.entity_key === entityKey;
  if (mutation.request_id !== requestId
    || mutation.action !== action
    || mutation.entity_type !== "service"
    || !entityMatches
    || mutation.payload_sha256 !== payloadSha256) {
    throw new AdminServiceWriteIdempotencyConflictError("requestId đã được dùng cho một payload khác.");
  }
}

function readMutationId(mutation: ServiceMutationRow): number {
  const id = Number(mutation.entity_key);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new AdminServiceWriteStorageError("Audit dịch vụ chứa entity id không hợp lệ.");
  }
  return id;
}

function assertExpectedRevision(actual: number, expected: number, message: string): void {
  if (actual !== expected) throw new AdminServiceWriteConflictError(message);
}

function assertRows(result: D1BatchResultLike | undefined, message: string): void {
  if (!hasRows(result)) throw new AdminServiceWriteStorageError(message);
}

function hasRows(result: D1BatchResultLike | undefined): boolean {
  return Array.isArray(result?.results) && result.results.length > 0;
}

function requireBatch(database: D1DatabaseLike): D1DatabaseWithBatch {
  const candidate = database as D1DatabaseWithBatch;
  if (typeof candidate.batch !== "function") {
    throw new AdminServiceWriteStorageError("D1 batch() là bắt buộc để ghi dịch vụ an toàn.");
  }
  return candidate;
}

function normalizeRequestId(value: unknown): string {
  if (typeof value !== "string" || !isAdminRequestId(value)) {
    throw new AdminServiceWriteValidationError("requestId phải là UUID hợp lệ.");
  }
  return value.trim().toLowerCase();
}

function requireRevision(value: unknown, action: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new AdminServiceWriteValidationError(`Revision hiện tại là bắt buộc khi ${action} dịch vụ.`);
  }
  return value;
}

function canonicalServiceInput(input: AdminServiceInput): AdminServiceInput {
  return {
    description: input.description,
    imageUrl: input.imageUrl,
    isActive: input.isActive,
    leadTimeDays: input.leadTimeDays,
    moqSummary: input.moqSummary,
    name: input.name,
    slug: input.slug,
    status: input.status,
    summary: input.summary,
  };
}

function isPositiveEntityKey(value: string): boolean {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0;
}

async function fingerprint(input: Record<string, unknown>): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(input));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
