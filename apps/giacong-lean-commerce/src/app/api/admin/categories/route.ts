import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManageCatalog } from "@/lib/admin-permissions.ts";
import { parseAdminCategoryPayload } from "@/lib/admin-category-input";
import { createAdminCategory, listAdminCategoryDetails } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;

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

  let payload: unknown = {};
  try {
    payload = await request.json();
  } catch {
    return adminFailure(crypto.randomUUID(), 400, "INVALID_REQUEST", "Dữ liệu gửi lên không hợp lệ.");
  }

  const parsed = parseAdminCategoryPayload(payload);
  if (!parsed.input) {
    return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", "Dữ liệu danh mục chưa hợp lệ.", parsed.fieldErrors);
  }

  try {
    const category = await createAdminCategory(guard.database, parsed.input, guard.actorSubject);
    return adminSuccess(crypto.randomUUID(), { category }, 201);
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể tạo danh mục.", {
      fieldErrors: { slug: "Slug danh mục đã tồn tại." },
      message: "Slug danh mục đã tồn tại.",
    });
  }
}
