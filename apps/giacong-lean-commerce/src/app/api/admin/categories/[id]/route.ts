import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import {
  deleteAdminCategory,
  updateAdminCategory,
} from "@/lib/admin-data";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { parseAdminCategoryPayload } from "@/lib/admin-category-input";

export const dynamic = "force-dynamic";

interface CategoryRouteContext {
  params: Promise<{ id: string }>;
}

function canManageCatalog(role: string): boolean {
  return role === "owner" || role === "catalog_manager";
}

async function parseId(context: CategoryRouteContext): Promise<number | null> {
  const raw = Number((await context.params).id);
  return Number.isInteger(raw) && raw > 0 ? raw : null;
}

export async function PATCH(
  request: Request,
  context: CategoryRouteContext,
): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageCatalog(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được sửa danh mục.");
  }
  const id = await parseId(context);
  if (id === null) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy danh mục.");

  let payload: Record<string, unknown> = {};
  try {
    const body: unknown = await request.json();
    payload = typeof body === "object" && body !== null && !Array.isArray(body)
      ? body as Record<string, unknown>
      : {};
  } catch {
    return adminFailure(crypto.randomUUID(), 400, "INVALID_REQUEST", "Dữ liệu gửi lên không hợp lệ.");
  }

  const expectedRevision = Number(payload.revision);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
    return adminFailure(crypto.randomUUID(), 409, "STALE_WRITE", "Thiếu phiên bản dữ liệu (revision). Hãy tải lại danh mục rồi lưu lại.");
  }

  const parsed = parseAdminCategoryPayload(payload);
  if (!parsed.input) {
    return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", "Dữ liệu danh mục chưa hợp lệ.", parsed.fieldErrors);
  }

  try {
    const category = await updateAdminCategory(guard.database, id, parsed.input, expectedRevision, guard.actorSubject);
    return category
      ? adminSuccess(crypto.randomUUID(), { category })
      : adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy danh mục.");
  } catch (error) {
    if (error instanceof Error && /đã thay đổi|stale/i.test(error.message)) {
      return adminFailure(crypto.randomUUID(), 409, "STALE_WRITE", "Danh mục đã được người khác cập nhật. Hãy tải lại rồi thử lại.");
    }
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể cập nhật danh mục.", {
      fieldErrors: { slug: "Slug danh mục đã tồn tại." },
      message: "Slug danh mục đã tồn tại.",
    });
  }
}

export async function DELETE(
  request: Request,
  context: CategoryRouteContext,
): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageCatalog(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được xóa danh mục.");
  }
  const id = await parseId(context);
  if (id === null) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy danh mục.");

  try {
    const deleted = await deleteAdminCategory(guard.database, id, guard.actorSubject);
    return deleted
      ? adminSuccess(crypto.randomUUID(), { deleted: true })
      : adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy danh mục.");
  } catch (error) {
    if (error instanceof Error && /CATEGORY_IN_USE/i.test(error.message)) {
      return adminFailure(crypto.randomUUID(), 409, "CATEGORY_IN_USE", error.message.replace(/^CATEGORY_IN_USE:\s*/, ""));
    }
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể xóa danh mục.");
  }
}
