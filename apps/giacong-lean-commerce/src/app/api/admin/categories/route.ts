import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManage, canManageCatalog } from "@/lib/admin-permissions.ts";
import { parseAdminCategoryPayload } from "@/lib/admin-category-input";
import { readBoundedAdminJson } from "@/lib/admin-request.ts";
import { createAdminCategory, listAdminCategoryDetails } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManage(guard.member.role, "catalog.read")) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được xem danh mục.");
  }

  try {
    const categories = await listAdminCategoryDetails(guard.database);
    return adminSuccess(crypto.randomUUID(), { categories });
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể tải danh sách danh mục.");
  }
}

export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageCatalog(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được tạo danh mục.");
  }

  const parsedRequest = await readBoundedAdminJson(request);
  if (!parsedRequest.ok) return adminFailure(parsedRequest.requestId, parsedRequest.status, parsedRequest.code, parsedRequest.message);

  const parsed = parseAdminCategoryPayload(parsedRequest.body);
  if (!parsed.input) {
    return adminFailure(parsedRequest.requestId, 422, "VALIDATION_ERROR", "Dữ liệu danh mục chưa hợp lệ.", parsed.fieldErrors);
  }

  try {
    const category = await createAdminCategory(guard.database, parsed.input, guard.actorSubject);
    return adminSuccess(parsedRequest.requestId, { category }, 201);
  } catch (error) {
    return adminErrorFrom(parsedRequest.requestId, error, "Không thể tạo danh mục.", {
      fieldErrors: { slug: "Slug danh mục đã tồn tại." },
      message: "Slug danh mục đã tồn tại.",
    });
  }
}
