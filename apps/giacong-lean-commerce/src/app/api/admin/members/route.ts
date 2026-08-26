import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { createAdminMember, listAdminMembers, AdminMemberValidationError } from "@/lib/admin-members.ts";
import { parseAdminMemberPayload } from "@/lib/admin-members-input.ts";
import { canManageMembers } from "@/lib/admin-permissions.ts";

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
  const parsed = parseAdminMemberPayload(await readJson(request));
  if (!parsed.input) {
    return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", "Dữ liệu thành viên chưa hợp lệ.", parsed.fieldErrors);
  }
  try {
    const member = await createAdminMember(guard.database, {
      ...parsed.input,
      actorSubject: guard.actorSubject,
    });
    return adminSuccess(crypto.randomUUID(), { member }, 201);
  } catch (error) {
    if (error instanceof AdminMemberValidationError) {
      return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", error.message);
    }
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể thêm thành viên.", {
      fieldErrors: { accessSubject: "accessSubject hoặc email đã tồn tại." },
      message: "accessSubject hoặc email đã tồn tại.",
    });
  }
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
