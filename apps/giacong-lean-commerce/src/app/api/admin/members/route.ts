import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import {
  AdminMemberWriteIdempotencyConflictError,
  AdminMemberWriteValidationError,
  createAdminMemberAtomically,
} from "@/lib/admin-member-write.ts";
import { listAdminMembers } from "@/lib/admin-members.ts";
import { parseAdminMemberCreateCommand } from "@/lib/admin-member-command.ts";
import { canManageMembers } from "@/lib/admin-permissions.ts";
import { hasOnlyKeys, readBoundedAdminJson } from "@/lib/admin-request";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageMembers(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Chỉ owner được xem danh sách thành viên admin.");
  }
  try {
    const members = await listAdminMembers(guard.database);
    return adminSuccess(crypto.randomUUID(), { members, role: guard.member.role });
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể tải danh sách thành viên.");
  }
}
export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageMembers(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Chỉ owner được thêm thành viên admin.");
  }
  const parsedRequest = await readBoundedAdminJson(request);
  if (!parsedRequest.ok) return adminFailure(parsedRequest.requestId, parsedRequest.status, parsedRequest.code, parsedRequest.message);
  if (!isRecord(parsedRequest.body) || !hasOnlyKeys(parsedRequest.body, ["requestId", "displayName", "email", "isActive"])) {
    return adminFailure(parsedRequest.requestId, 400, "INVALID_REQUEST", "Body thành viên chứa trường không được hỗ trợ.");
  }
  const parsed = parseAdminMemberCreateCommand(parsedRequest.body);
  if (!parsed.command) {
    return adminFailure(parsedRequest.requestId, 422, "VALIDATION_ERROR", "Dữ liệu thành viên chưa hợp lệ.", parsed.fieldErrors);
  }
  try {
    const member = await createAdminMemberAtomically(guard.database, parsed.command.input, guard.actorSubject, parsed.command.requestId);
    return adminSuccess(parsedRequest.requestId, { member }, 201);
  } catch (error) {
    if (error instanceof AdminMemberWriteValidationError) {
      const fieldErrors = /email/i.test(error.message) ? { email: error.message } : undefined;
      return adminFailure(parsedRequest.requestId, 422, "VALIDATION_ERROR", error.message, fieldErrors);
    }
    if (error instanceof AdminMemberWriteIdempotencyConflictError) {
      return adminFailure(parsedRequest.requestId, 409, "IDEMPOTENCY_CONFLICT", error.message);
    }
    return adminErrorFrom(parsedRequest.requestId, error, "Không thể thêm thành viên.", {
      fieldErrors: { email: "Email này đã tồn tại trong danh sách quản trị." },
      message: "Email này đã tồn tại trong danh sách quản trị.",
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
