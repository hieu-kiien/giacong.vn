import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import {
  getAdminCategory,
  updateAdminCategory,
} from "@/lib/admin-data";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManage, canManageCatalog } from "@/lib/admin-permissions.ts";
import { parseAdminCategoryPayload } from "@/lib/admin-category-input";
import { readBoundedAdminJson } from "@/lib/admin-request.ts";

export const dynamic = "force-dynamic";

interface CategoryRouteContext {
  params: Promise<{ id: string }>;
}

async function parseId(context: CategoryRouteContext): Promise<number | null> {
  const raw = Number((await context.params).id);
  return Number.isInteger(raw) && raw > 0 ? raw : null;
}

export async function GET(
  request: Request,
  context: CategoryRouteContext,
): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManage(guard.member.role, "catalog.read")) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được xem danh mục.");
  }
  const id = await parseId(context);
  if (id === null) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy danh mục.");

  try {
    const category = await getAdminCategory(guard.database, id);
    return category
      ? adminSuccess(crypto.randomUUID(), { category })
      : adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy danh mục.");
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể tải danh mục.");
  }
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

  const parsedRequest = await readBoundedAdminJson(request);
  if (!parsedRequest.ok) return adminFailure(parsedRequest.requestId, parsedRequest.status, parsedRequest.code, parsedRequest.message);
  const payload: Record<string, unknown> = typeof parsedRequest.body === "object"
    && parsedRequest.body !== null && !Array.isArray(parsedRequest.body)
    ? parsedRequest.body as Record<string, unknown>
    : {};

  const expectedRevision = Number(payload.revision);
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
    return adminFailure(parsedRequest.requestId, 409, "STALE_WRITE", "Thiếu phiên bản dữ liệu (revision). Hãy tải lại danh mục rồi lưu lại.");
  }

  const parsed = parseAdminCategoryPayload(payload);
  if (!parsed.input) {
    return adminFailure(parsedRequest.requestId, 422, "VALIDATION_ERROR", "Dữ liệu danh mục chưa hợp lệ.", parsed.fieldErrors);
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
