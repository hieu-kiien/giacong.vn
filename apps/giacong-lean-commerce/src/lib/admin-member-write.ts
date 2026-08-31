import type {
  AdminRole,
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "./admin-data.ts";
import { tableExists } from "./admin-data.ts";
import { getAdminMemberRecord } from "./admin-members.ts";
import type { AdminMemberInput } from "./admin-members-input.ts";
import { isAdminRole } from "./admin-permissions.ts";
import { isAdminRequestId } from "./admin-request.ts";
import type { AdminMemberRecord } from "./admin-members.ts";

export class AdminMemberWriteConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminMemberWriteConflictError";
  }
}

export class AdminMemberWriteIdempotencyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminMemberWriteIdempotencyConflictError";
  }
}

export class AdminMemberWriteStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminMemberWriteStorageError";
  }
}

export class AdminMemberWriteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminMemberWriteValidationError";
  }
}

interface MemberMutationRow {
  action: "create" | "update";
  entity_key: string;
  entity_type: "admin_member";
  payload_sha256: string;
  request_id: string;
}

interface D1BatchResultLike {
  meta?: { changes?: unknown };
  results?: unknown[];
}

interface D1DatabaseWithBatch extends D1DatabaseLike {
  batch(statements: D1PreparedStatementLike[]): Promise<D1BatchResultLike[]>;
}

export async function createAdminMemberAtomically(
  database: D1DatabaseLike,
  input: AdminMemberInput,
  actorSubject: string,
  requestId: string,
): Promise<AdminMemberRecord> {
  validateMemberInput(input);
  const normalizedRequestId = normalizeRequestId(requestId);
  const normalizedActor = normalizeActor(actorSubject);
  const payloadSha256 = await fingerprint({
    actorSubject: normalizedActor,
    entityType: "admin_member",
    input: canonicalMemberInput(input),
    operation: "create",
  });
  await requireMemberAuditTables(database);

  const existingMutation = await findMutation(database, normalizedRequestId);
  if (existingMutation) {
    assertMatchingMutation(existingMutation, "create", undefined, payloadSha256);
    return readMutationMember(database, existingMutation);
  }

  const id = crypto.randomUUID();
  const databaseWithBatch = requireBatch(database);
  const statements = [
    buildMemberInsert(database, id, input, normalizedRequestId),
    buildMemberAudit(database, normalizedRequestId, normalizedActor, "create", id, payloadSha256),
    buildLegacyAudit(database, normalizedActor, "admin_member.created", id, payloadSha256),
  ];
  try {
    const results = await databaseWithBatch.batch(statements);
    assertRows(results[0], "Không ghi được thành viên admin.");
    assertRows(results[1], "Không ghi được audit thành viên admin.");
    assertRows(results[2], "Không ghi được lịch sử thành viên admin.");
  } catch (error) {
    const racedMutation = await findMutation(database, normalizedRequestId);
    if (racedMutation) {
      assertMatchingMutation(racedMutation, "create", undefined, payloadSha256);
      return readMutationMember(database, racedMutation);
    }
    throw error;
  }

  const mutation = await findMutation(database, normalizedRequestId);
  if (!mutation) throw new AdminMemberWriteStorageError("Không đọc lại được audit thành viên vừa tạo.");
  assertMatchingMutation(mutation, "create", id, payloadSha256);
  return readMutationMember(database, mutation);
}

export async function updateAdminMemberAtomically(
  database: D1DatabaseLike,
  id: string,
  input: AdminMemberInput,
  expectedRevisionRaw: unknown,
  actorSubject: string,
  actorMemberId: string,
  requestId: string,
): Promise<AdminMemberRecord> {
  validateMemberInput(input);
  const normalizedId = normalizeMemberId(id);
  const expectedRevision = requireRevision(expectedRevisionRaw);
  const normalizedRequestId = normalizeRequestId(requestId);
  const normalizedActor = normalizeActor(actorSubject);
  const payloadSha256 = await fingerprint({
    actorMemberId,
    actorSubject: normalizedActor,
    entityType: "admin_member",
    expectedRevision,
    id: normalizedId,
    input: canonicalMemberInput(input),
    operation: "update",
  });
  await requireMemberAuditTables(database);

  const existingMutation = await findMutation(database, normalizedRequestId);
  if (existingMutation) {
    assertMatchingMutation(existingMutation, "update", normalizedId, payloadSha256);
    return readMutationMember(database, existingMutation);
  }

  const current = await getAdminMemberRecord(database, normalizedId);
  if (!current) throw new AdminMemberWriteConflictError("Không tìm thấy thành viên.");
  if (current.revision !== expectedRevision) {
    throw new AdminMemberWriteConflictError("Thành viên đã thay đổi ở phiên khác. Hãy tải lại trước khi lưu.");
  }
  enforceActorSafety(current, input, normalizedActor, actorMemberId);
  await enforceLastActiveOwner(database, current, input);

  const databaseWithBatch = requireBatch(database);
  const statements = [
    buildMemberUpdate(database, normalizedId, input, normalizedRequestId, expectedRevision),
    buildMemberAudit(database, normalizedRequestId, normalizedActor, "update", normalizedId, payloadSha256, expectedRevision),
    buildLegacyAudit(database, normalizedActor, "admin_member.updated", normalizedId, payloadSha256, expectedRevision, normalizedRequestId),
  ];
  try {
    const results = await databaseWithBatch.batch(statements);
    if (!hasRows(results[0])) return resolveMemberConflict(database, normalizedRequestId, normalizedId, payloadSha256);
    assertRows(results[1], "Không ghi được audit thành viên admin.");
    assertRows(results[2], "Không ghi được lịch sử thành viên admin.");
  } catch (error) {
    const racedMutation = await findMutation(database, normalizedRequestId);
    if (racedMutation) {
      assertMatchingMutation(racedMutation, "update", normalizedId, payloadSha256);
      return readMutationMember(database, racedMutation);
    }
    throw error;
  }

  return readMutationMember(database, {
    action: "update",
    entity_key: normalizedId,
    entity_type: "admin_member",
    payload_sha256: payloadSha256,
    request_id: normalizedRequestId,
  });
}

async function requireMemberAuditTables(database: D1DatabaseLike): Promise<void> {
  const [hasMemberAudit, hasLegacyAudit] = await Promise.all([
    tableExists(database, "admin_member_audit"),
    tableExists(database, "audit_logs"),
  ]);
  if (!hasMemberAudit || !hasLegacyAudit) {
    throw new AdminMemberWriteStorageError("Các bảng audit thành viên admin chưa được triển khai.");
  }
}

async function findMutation(database: D1DatabaseLike, requestId: string): Promise<MemberMutationRow | null> {
  return database.prepare(`
    SELECT action, entity_key, entity_type, payload_sha256, request_id
    FROM admin_member_audit
    WHERE request_id = ?
    LIMIT 1
  `).bind(requestId).first<MemberMutationRow>();
}

async function readMutationMember(database: D1DatabaseLike, mutation: MemberMutationRow): Promise<AdminMemberRecord> {
  const member = await getAdminMemberRecord(database, normalizeMemberId(mutation.entity_key));
  if (!member) throw new AdminMemberWriteStorageError("Không đọc lại được kết quả thành viên từ audit.");
  return member;
}

async function resolveMemberConflict(
  database: D1DatabaseLike,
  requestId: string,
  id: string,
  payloadSha256: string,
): Promise<AdminMemberRecord> {
  const mutation = await findMutation(database, requestId);
  if (mutation) {
    assertMatchingMutation(mutation, "update", id, payloadSha256);
    return readMutationMember(database, mutation);
  }
  throw new AdminMemberWriteConflictError("Thành viên đã thay đổi ở phiên khác. Hãy tải lại trước khi lưu.");
}

function buildMemberInsert(
  database: D1DatabaseLike,
  id: string,
  input: AdminMemberInput,
  requestId: string,
): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO admin_members (id, access_subject, email, display_name, role, is_active, last_request_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, input.accessSubject, input.email, input.displayName, input.role, input.isActive ? 1 : 0, requestId);
}

function buildMemberUpdate(
  database: D1DatabaseLike,
  id: string,
  input: AdminMemberInput,
  requestId: string,
  expectedRevision: number,
): D1PreparedStatementLike {
  return database.prepare(`
    UPDATE admin_members
    SET access_subject = ?, email = ?, display_name = ?, role = ?, is_active = ?,
      last_request_id = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND revision = ?
      AND (
        role <> 'owner'
        OR is_active <> 1
        OR (? = 'owner' AND ? = 1)
        OR EXISTS (
          SELECT 1
          FROM admin_members AS other
          WHERE other.id <> admin_members.id
            AND other.role = 'owner'
            AND other.is_active = 1
        )
      )
  `).bind(
    input.accessSubject,
    input.email,
    input.displayName,
    input.role,
    input.isActive ? 1 : 0,
    requestId,
    id,
    expectedRevision,
    input.role,
    input.isActive ? 1 : 0,
  );
}

function buildMemberAudit(
  database: D1DatabaseLike,
  requestId: string,
  actorSubject: string,
  action: "create" | "update",
  entityId: string,
  payloadSha256: string,
  previousRevision?: number,
): D1PreparedStatementLike {
  return action === "create"
    ? database.prepare(`
      INSERT INTO admin_member_audit (
        request_id, actor_subject, entity_key, payload_sha256,
        action, entity_type, previous_revision, resulting_revision
      ) VALUES (?, ?, ?, ?, 'create', 'admin_member', NULL, 1)
    `).bind(requestId, actorSubject, entityId, payloadSha256)
    : database.prepare(`
      INSERT INTO admin_member_audit (
        request_id, actor_subject, entity_key, payload_sha256,
        action, entity_type, previous_revision, resulting_revision
      )
      SELECT ?, ?, ?, ?, 'update', 'admin_member', ?, ?
      FROM admin_members
      WHERE id = ? AND revision = ? AND last_request_id = ?
    `).bind(
      requestId,
      actorSubject,
      entityId,
      payloadSha256,
      previousRevision,
      (previousRevision ?? 0) + 1,
      entityId,
      (previousRevision ?? 0) + 1,
      requestId,
    );
}

function buildLegacyAudit(
  database: D1DatabaseLike,
  actorSubject: string,
  action: "admin_member.created" | "admin_member.updated",
  entityId: string,
  payloadSha256: string,
  expectedRevision?: number,
  requestId?: string,
): D1PreparedStatementLike {
  const metadata = JSON.stringify({ expectedRevision, payloadSha256 });
  return expectedRevision === undefined
    ? database.prepare(`
      INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
      VALUES (?, ?, '${action}', 'admin_member', ?, ?)
    `).bind(crypto.randomUUID(), actorSubject, entityId, metadata)
    : database.prepare(`
      INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
      SELECT ?, ?, '${action}', 'admin_member', ?, ?
      FROM admin_members
      WHERE id = ? AND revision = ? AND last_request_id = ?
    `).bind(
      crypto.randomUUID(),
      actorSubject,
      entityId,
      metadata,
      entityId,
      expectedRevision + 1,
      requestId ?? "",
    );
}

function enforceActorSafety(
  current: AdminMemberRecord,
  input: AdminMemberInput,
  actorSubject: string,
  actorMemberId: string,
): void {
  const isCurrentActor = current.id === actorMemberId || current.accessSubject === actorSubject;
  if (!isCurrentActor) return;
  if (input.accessSubject !== current.accessSubject) {
    throw new AdminMemberWriteValidationError("Không thể đổi accessSubject của tài khoản đang sử dụng.");
  }
  if (!input.isActive || input.role !== "owner") {
    throw new AdminMemberWriteValidationError("Không thể tự vô hiệu hóa hoặc hạ quyền tài khoản đang sử dụng.");
  }
}

async function enforceLastActiveOwner(
  database: D1DatabaseLike,
  current: AdminMemberRecord,
  input: AdminMemberInput,
): Promise<void> {
  if (current.role !== "owner" || !current.isActive || (input.role === "owner" && input.isActive)) return;
  const ownerCount = await database.prepare(`
    SELECT COUNT(*) AS count FROM admin_members
    WHERE role = 'owner' AND is_active = 1
  `).first<{ count: number }>();
  if (Number(ownerCount?.count ?? 0) <= 1) {
    throw new AdminMemberWriteValidationError("Phải giữ lại ít nhất một owner đang hoạt động.");
  }
}

function assertMatchingMutation(
  mutation: MemberMutationRow,
  action: "create" | "update",
  entityId: string | undefined,
  payloadSha256: string,
): void {
  if (mutation.action !== action || (entityId !== undefined && mutation.entity_key !== entityId) || mutation.payload_sha256 !== payloadSha256) {
    throw new AdminMemberWriteIdempotencyConflictError("requestId đã được dùng cho một payload thành viên khác.");
  }
}

function requireBatch(database: D1DatabaseLike): D1DatabaseWithBatch {
  const databaseWithBatch = database as D1DatabaseWithBatch;
  if (typeof databaseWithBatch.batch !== "function") {
    throw new AdminMemberWriteStorageError("D1 atomic batch chưa sẵn sàng cho member write.");
  }
  return databaseWithBatch;
}

function assertRows(result: D1BatchResultLike | undefined, message: string): void {
  if (!hasRows(result)) throw new AdminMemberWriteStorageError(message);
}

function hasRows(result: unknown): boolean {
  if (typeof result !== "object" || result === null) return true;
  const meta = (result as D1BatchResultLike).meta;
  return meta?.changes === undefined || Number(meta.changes) > 0;
}

function validateMemberInput(input: AdminMemberInput): void {
  if (!input || typeof input !== "object" || !isAdminRole(input.role)) {
    throw new AdminMemberWriteValidationError("Vai trò thành viên không hợp lệ.");
  }
  for (const [field, value] of [["accessSubject", input.accessSubject], ["displayName", input.displayName]] as const) {
    if (typeof value !== "string" || !value.trim()) throw new AdminMemberWriteValidationError(`${field} không hợp lệ.`);
  }
  if (input.email !== null && typeof input.email !== "string") {
    throw new AdminMemberWriteValidationError("Email thành viên không hợp lệ.");
  }
  if (typeof input.isActive !== "boolean") throw new AdminMemberWriteValidationError("isActive không hợp lệ.");
}

function canonicalMemberInput(input: AdminMemberInput): Record<string, unknown> {
  return {
    accessSubject: input.accessSubject.trim(),
    displayName: input.displayName.trim(),
    email: input.email?.trim().toLowerCase() ?? null,
    isActive: input.isActive,
    role: input.role,
  };
}

function normalizeMemberId(value: string): string {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9_-]{0,99}$/i.test(value)) {
    throw new AdminMemberWriteValidationError("id thành viên không hợp lệ.");
  }
  return value;
}

function normalizeRequestId(value: string): string {
  if (!isAdminRequestId(value)) throw new AdminMemberWriteValidationError("requestId phải là UUID hợp lệ.");
  return value.trim().toLowerCase();
}

function normalizeActor(value: string): string {
  const actor = value.trim();
  if (!actor || actor.length > 255) throw new AdminMemberWriteValidationError("actorSubject không hợp lệ.");
  return actor;
}

function requireRevision(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new AdminMemberWriteValidationError("expectedRevision phải là số nguyên dương.");
  }
  return value;
}

async function fingerprint(input: Record<string, unknown>): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(input));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
