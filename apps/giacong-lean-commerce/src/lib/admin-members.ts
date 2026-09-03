import type { AdminRole, D1DatabaseLike } from "./admin-data";
import { isAdminRole } from "./admin-permissions.ts";
import type { AdminMemberInput } from "./admin-members-input";

export interface AdminMemberRecord {
  id: string;
  accessSubject: string;
  email: string | null;
  displayName: string;
  role: AdminRole;
  isActive: boolean;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export class AdminMemberValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminMemberValidationError";
  }
}

export class AdminMemberConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminMemberConflictError";
  }
}

export class AdminMemberNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminMemberNotFoundError";
  }
}

export async function listAdminMembers(database: D1DatabaseLike): Promise<AdminMemberRecord[]> {
  const rows = await database.prepare(`
    SELECT id, access_subject, email, display_name, role, is_active,
      revision, created_at, updated_at
    FROM admin_members
    ORDER BY is_active DESC, display_name COLLATE NOCASE ASC, id ASC
    LIMIT 100
  `).all<AdminMemberRow>();
  return rows.results.map(toAdminMember);
}

export async function getAdminMemberRecord(
  database: D1DatabaseLike,
  id: string,
): Promise<AdminMemberRecord | null> {
  const normalizedId = normalizeMemberId(id);
  const row = await database.prepare(`
    SELECT id, access_subject, email, display_name, role, is_active,
      revision, created_at, updated_at
    FROM admin_members
    WHERE id = ?
    LIMIT 1
  `).bind(normalizedId).first<AdminMemberRow>();
  return row ? toAdminMember(row) : null;
}

export async function createAdminMember(
  database: D1DatabaseLike,
  input: AdminMemberInput & { actorSubject: string },
): Promise<AdminMemberRecord> {
  const id = crypto.randomUUID();
  await database.prepare(`
    INSERT INTO admin_members (id, access_subject, email, display_name, role, is_active)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    input.accessSubject,
    input.email,
    input.displayName,
    input.role,
    input.isActive ? 1 : 0,
  ).run();
  await writeMemberAudit(database, input.actorSubject, "admin_member.created", id, { role: input.role });
  const member = await getAdminMemberRecord(database, id);
  if (!member) throw new AdminMemberNotFoundError("Không thể đọc thành viên vừa tạo.");
  return member;
}

export async function updateAdminMember(
  database: D1DatabaseLike,
  input: {
    actorSubject: string;
    displayName: string;
    email: string | null;
    expectedRevision: number;
    id: string;
    isActive: boolean;
    role: AdminRole;
  },
): Promise<AdminMemberRecord> {
  const id = normalizeMemberId(input.id);
  if (!isAdminRole(input.role)) throw new AdminMemberValidationError("Vai trò thành viên không hợp lệ.");
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 1) {
    throw new AdminMemberValidationError("expectedRevision không hợp lệ.");
  }
  const current = await getAdminMemberRecord(database, id);
  if (!current) throw new AdminMemberNotFoundError("Không tìm thấy thành viên.");
  if (current.revision !== input.expectedRevision) {
    throw new AdminMemberConflictError("Thành viên đã thay đổi ở phiên khác. Hãy tải lại trước khi lưu.");
  }
  if (current.accessSubject === input.actorSubject && (!input.isActive || input.role !== "owner")) {
    throw new AdminMemberValidationError("Không thể tự vô hiệu hóa hoặc hạ quyền tài khoản đang sử dụng.");
  }
  if (current.role === "owner" && (input.role !== "owner" || !input.isActive)) {
    const ownerCount = await database.prepare(`
      SELECT COUNT(*) AS count FROM admin_members
      WHERE role = 'owner' AND is_active = 1
    `).first<{ count: number }>();
    if (Number(ownerCount?.count ?? 0) <= 1) {
      throw new AdminMemberValidationError("Phải giữ lại ít nhất một owner đang hoạt động.");
    }
  }

  const result = await database.prepare(`
    UPDATE admin_members
    SET email = ?, display_name = ?, role = ?, is_active = ?,
      revision = revision + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND revision = ?
  `).bind(
    input.email,
    input.displayName,
    input.role,
    input.isActive ? 1 : 0,
    id,
    input.expectedRevision,
  ).run();
  if (!hasChanged(result)) throw new AdminMemberConflictError("Thành viên đã thay đổi ở phiên khác. Hãy tải lại trước khi lưu.");
  await writeMemberAudit(database, input.actorSubject, "admin_member.updated", id, {
    expectedRevision: input.expectedRevision,
    isActive: input.isActive,
    role: input.role,
  });
  const updated = await getAdminMemberRecord(database, id);
  if (!updated) throw new AdminMemberNotFoundError("Không thể đọc thành viên vừa cập nhật.");
  return updated;
}

function normalizeMemberId(value: string): string {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9_-]{0,99}$/i.test(value)) {
    throw new AdminMemberValidationError("id thành viên không hợp lệ.");
  }
  return value;
}

interface AdminMemberRow {
  id: string;
  access_subject: string;
  email: string | null;
  display_name: string;
  role: AdminRole;
  is_active: number;
  revision: number;
  created_at: string;
  updated_at: string;
}

function toAdminMember(row: AdminMemberRow): AdminMemberRecord {
  if (!isAdminRole(row.role)) throw new AdminMemberValidationError("Dữ liệu role trong D1 không hợp lệ.");
  return {
    accessSubject: row.access_subject,
    createdAt: row.created_at,
    displayName: row.display_name,
    email: row.email,
    id: row.id,
    isActive: row.is_active === 1,
    revision: row.revision,
    role: row.role,
    updatedAt: row.updated_at,
  };
}

async function writeMemberAudit(
  database: D1DatabaseLike,
  actorSubject: string,
  action: string,
  entityId: string,
  metadata: unknown,
): Promise<void> {
  await database.prepare(`
    INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
    VALUES (?, ?, ?, 'admin_member', ?, ?)
  `).bind(crypto.randomUUID(), actorSubject, action, entityId, JSON.stringify(metadata)).run();
}

function hasChanged(result: unknown): boolean {
  if (typeof result !== "object" || result === null) return false;
  const record = result as { meta?: { changes?: unknown }; results?: unknown[] };
  if (Array.isArray(record.results)) return record.results.length > 0;
  const changes = record.meta?.changes;
  return changes !== undefined && Number(changes) > 0;
}
