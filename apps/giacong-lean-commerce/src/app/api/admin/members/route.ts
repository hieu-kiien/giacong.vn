import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { createAdminMember, listAdminMembers, AdminMemberValidationError } from "@/lib/admin-members.ts";
import { parseAdminMemberPayload } from "@/lib/admin-members-input.ts";
import { canManageMembers } from "@/lib/admin-permissions.ts";
import { readBoundedAdminJson } from "@/lib/admin-request";

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
  const parsed = parseAdminMemberPayload(parsedRequest.body);
  if (!parsed.input) {
    return adminFailure(parsedRequest.requestId, 422, "VALIDATION_ERROR", "Dữ liệu thành viên chưa hợp lệ.", parsed.fieldErrors);
  }
  try {
    const member = await createAdminMember(guard.database, {
      ...parsed.input,
      actorSubject: guard.actorSubject,
    });
    return adminSuccess(parsedRequest.requestId, { member }, 201);
  } catch (error) {
    if (error instanceof AdminMemberValidationError) {
      return adminFailure(parsedRequest.requestId, 422, "VALIDATION_ERROR", error.message);
    }
    return adminErrorFrom(parsedRequest.requestId, error, "Không thể thêm thành viên.", {
      fieldErrors: { accessSubject: "accessSubject hoặc email đã tồn tại." },
      message: "accessSubject hoặc email đã tồn tại.",
    });
  }
}
