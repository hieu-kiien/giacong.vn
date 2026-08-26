import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManageNews } from "@/lib/admin-permissions.ts";
import { parseAdminNewsPayload } from "@/lib/admin-news-input";
import { createAdminNewsPost, listAdminNewsPosts } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page")) || 1;
  const pageSize = Math.min(Number(url.searchParams.get("pageSize")) || 20, 100);

  try {
    const data = await listAdminNewsPosts(guard.database, {
      page: page > 0 ? page : 1,
      pageSize: pageSize > 0 ? pageSize : 20,
    });
    return adminSuccess(crypto.randomUUID(), {
      ...data,
      pagination: {
        currentPage: page,
        lastPage: Math.max(1, Math.ceil(data.total / pageSize)),
        pageSize,
        total: data.total,
      },
    });
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể tải danh sách bài viết.");
  }
}

export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageNews(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được viết bài.");
  }

  let payload: unknown = {};
  try {
    payload = await request.json();
  } catch {
    return adminFailure(crypto.randomUUID(), 400, "INVALID_REQUEST", "Dữ liệu gửi lên không hợp lệ.");
  }

  const parsed = parseAdminNewsPayload(payload);
  if (!parsed.input) {
    return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", "Dữ liệu bài viết chưa hợp lệ.", parsed.fieldErrors);
  }

  try {
    const post = await createAdminNewsPost(guard.database, parsed.input, guard.actorSubject);
    return adminSuccess(crypto.randomUUID(), { post }, 201);
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể tạo bài viết.", {
      fieldErrors: { slug: "Slug bài viết đã tồn tại." },
      message: "Slug bài viết đã tồn tại.",
    });
  }
}
