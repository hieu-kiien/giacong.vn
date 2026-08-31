import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import {
  AdminMemberWriteConflictError,
  AdminMemberWriteIdempotencyConflictError,
  AdminMemberWriteValidationError,
  updateAdminMemberAtomically,
} from "@/lib/admin-member-write.ts";
import {
  AdminMemberConflictError,
  getAdminMemberRecord,
  AdminMemberNotFoundError,
  AdminMemberValidationError,
} from "@/lib/admin-members.ts";
import { parseAdminMemberUpdateCommand } from "@/lib/admin-member-command.ts";
import { canManageMembers } from "@/lib/admin-permissions.ts";
import { hasOnlyKeys, readBoundedAdminJson } from "@/lib/admin-request";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageMembers(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Chỉ owner được xem thành viên admin.");
  }
  try {
    const member = await getAdminMemberRecord(guard.database, (await context.params).id);
    return member
      ? adminSuccess(crypto.randomUUID(), { member })
      : adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy thành viên.");
  } catch (error) {
    return memberFailure(error, "Không thể tải thành viên.");
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageMembers(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Chỉ owner được sửa thành viên admin.");
  }
  const parsedRequest = await readBoundedAdminJson(request);
  if (!parsedRequest.ok) return adminFailure(parsedRequest.requestId, parsedRequest.status, parsedRequest.code, parsedRequest.message);
  const body = parsedRequest.body;
  if (!isRecord(body) || !hasOnlyKeys(body, ["requestId", "accessSubject", "displayName", "email", "expectedRevision", "isActive", "role"])) {
    return adminFailure(parsedRequest.requestId, 400, "INVALID_REQUEST", "Body thành viên chứa trường không được hỗ trợ.");
  }
  if (typeof body.expectedRevision === "number" && body.expectedRevision < 1) {
    return adminFailure(parsedRequest.requestId, 400, "INVALID_REQUEST", "Cần expectedRevision là số nguyên dương.");
  }
  const parsed = parseAdminMemberUpdateCommand(body);
  if (!parsed.command) {
    return adminFailure(parsedRequest.requestId, 422, "VALIDATION_ERROR", "Dữ liệu thành viên chưa hợp lệ.", parsed.fieldErrors);
  }
  try {
    const member = await updateAdminMemberAtomically(
      guard.database,
      (await context.params).id,
      parsed.command.input,
      parsed.command.expectedRevision,
      guard.actorSubject,
      guard.member.id,
      parsed.command.requestId,
    );
    return adminSuccess(parsedRequest.requestId, { member });
  } catch (error) {
    return memberFailure(error, "Không thể cập nhật thành viên.", parsedRequest.requestId);
  }
}

function memberFailure(error: unknown, fallbackMessage: string, requestId = crypto.randomUUID()): Response {
  if (error instanceof AdminMemberWriteConflictError) return adminFailure(requestId, 409, "STALE_WRITE", error.message);
  if (error instanceof AdminMemberWriteIdempotencyConflictError) return adminFailure(requestId, 409, "IDEMPOTENCY_CONFLICT", error.message);
  if (error instanceof AdminMemberWriteValidationError) return adminFailure(requestId, 422, "VALIDATION_ERROR", error.message);
  if (error instanceof AdminMemberConflictError) return adminFailure(requestId, 409, "STALE_WRITE", error.message);
  if (error instanceof AdminMemberNotFoundError) return adminFailure(requestId, 404, "NOT_FOUND", error.message);
  if (error instanceof AdminMemberValidationError) return adminFailure(requestId, 422, "VALIDATION_ERROR", error.message);
  return adminErrorFrom(requestId, error, fallbackMessage);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
