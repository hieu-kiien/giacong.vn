import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import {
  AdminMemberConflictError,
  getAdminMemberRecord,
  AdminMemberNotFoundError,
  AdminMemberValidationError,
  updateAdminMember,
} from "@/lib/admin-members.ts";
import { parseAdminMemberPayload } from "@/lib/admin-members-input.ts";
import { canManageMembers } from "@/lib/admin-permissions.ts";
import { readBoundedAdminJson } from "@/lib/admin-request";

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
  const parsed = parseAdminMemberPayload(body);
  if (!parsed.input || !isRecord(body) || typeof body.expectedRevision !== "number" || !Number.isInteger(body.expectedRevision)) {
    return adminFailure(parsedRequest.requestId, 422, "VALIDATION_ERROR", "Cần thông tin thành viên và expectedRevision hợp lệ.", parsed.fieldErrors);
  }
  try {
    const member = await updateAdminMember(guard.database, {
      ...parsed.input,
      actorSubject: guard.actorSubject,
      expectedRevision: body.expectedRevision,
      id: (await context.params).id,
    });
    return adminSuccess(parsedRequest.requestId, { member });
  } catch (error) {
    return memberFailure(error, "Không thể cập nhật thành viên.");
  }
}

function memberFailure(error: unknown, fallbackMessage: string): Response {
  if (error instanceof AdminMemberConflictError) return adminFailure(crypto.randomUUID(), 409, "STALE_WRITE", error.message);
  if (error instanceof AdminMemberNotFoundError) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", error.message);
  if (error instanceof AdminMemberValidationError) return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", error.message);
  return adminErrorFrom(crypto.randomUUID(), error, fallbackMessage);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
