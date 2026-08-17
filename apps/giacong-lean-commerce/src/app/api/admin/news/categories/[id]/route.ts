import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import {
  countArticlesInNewsCategory,
  getAdminNewsCategory,
} from "@/lib/admin-news-data";
import { adminNewsCategoryDefaults, parseAdminNewsCategoryPayload } from "@/lib/admin-news-input";
import {
  deleteAdminNewsCategoryAtomically,
  updateAdminNewsCategoryAtomically,
} from "@/lib/admin-news-write";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

interface CategoryRouteContext { params: Promise<{ id: string }>; }

export async function GET(request: Request, context: CategoryRouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  const id = await parseId(context);
  if (id === null) return notFound();
  try {
    const category = await getAdminNewsCategory(guard.database, id);
    return category ? adminSuccess(crypto.randomUUID(), { category }) : notFound();
  } catch (error) {
    return adminFailure(crypto.randomUUID(), 503, "INTERNAL_ERROR", errorMessage(error, "Không thể tải danh mục tin tức."));
  }
}

export async function PATCH(request: Request, context: CategoryRouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageNews(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được sửa danh mục tin tức.");
  }
  const id = await parseId(context);
  if (id === null) return notFound();
  const existing = await getAdminNewsCategory(guard.database, id);
  if (!existing) return notFound();
  const parsed = parseAdminNewsCategoryPayload(await readJson(request), adminNewsCategoryDefaults(existing));
  if (!parsed.input) {
    return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", "Dữ liệu danh mục chưa hợp lệ.", parsed.fieldErrors);
  }

  try {
    await updateAdminNewsCategoryAtomically(guard.database, id, parsed.input, guard.actorSubject);
    const category = await getAdminNewsCategory(guard.database, id);
    return category ? adminSuccess(crypto.randomUUID(), { category }) : notFound();
  } catch (error) {
    const unique = isUniqueError(error);
    return adminFailure(
      crypto.randomUUID(),
      unique ? 409 : 503,
      unique ? "UNIQUE_CONFLICT" : "INTERNAL_ERROR",
      errorMessage(error, "Không thể cập nhật danh mục tin tức."),
      unique ? { slug: "Slug danh mục đã tồn tại." } : undefined,
    );
  }
}

export async function DELETE(request: Request, context: CategoryRouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageNews(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được xóa danh mục tin tức.");
  }
  const id = await parseId(context);
  if (id === null) return notFound();
  const existing = await getAdminNewsCategory(guard.database, id);
  if (!existing) return notFound();
  const articleCount = await countArticlesInNewsCategory(guard.database, id);
  if (articleCount > 0) {
    return adminFailure(
      crypto.randomUUID(),
      409,
      "CONFLICT",
      `Danh mục đang được ${articleCount} bài viết sử dụng. Hãy chuyển bài sang danh mục khác hoặc tạm ẩn danh mục.`,
    );
  }

  try {
    await deleteAdminNewsCategoryAtomically(guard.database, id, guard.actorSubject);
    return adminSuccess(crypto.randomUUID(), { deleted: true, id });
  } catch (error) {
    return adminFailure(crypto.randomUUID(), 503, "INTERNAL_ERROR", errorMessage(error, "Không thể xóa danh mục tin tức."));
  }
}

function canManageNews(role: string): boolean {
  return role === "owner" || role === "content_manager";
}
async function parseId(context: CategoryRouteContext): Promise<number | null> {
  const { id } = await context.params;
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
async function readJson(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { return {}; }
}
function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
function isUniqueError(error: unknown): boolean {
  return error instanceof Error && /unique|constraint/i.test(error.message);
}
function notFound(): Response {
  return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy danh mục tin tức.");
}
