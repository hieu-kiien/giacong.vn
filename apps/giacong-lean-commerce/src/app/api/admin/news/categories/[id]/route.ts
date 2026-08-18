import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import {
  countAdminNewsCategoryArticles,
  getAdminNewsCategory,
} from "@/lib/admin-news-data.ts";
import {
  parseAdminNewsCategoryPayload,
  type AdminNewsCategoryInput,
} from "@/lib/admin-news-input.ts";
import {
  AdminNewsCategoryConflictError,
  AdminNewsCategoryStaleWriteError,
  deleteAdminNewsCategoryAtomically,
  updateAdminNewsCategoryAtomically,
} from "@/lib/admin-news-write.ts";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

interface CategoryRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: CategoryRouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  const id = await parseId(context);
  if (id === null) return notFound();

  try {
    const category = await getAdminNewsCategory(guard.database, id);
    return category ? adminSuccess(crypto.randomUUID(), { category }) : notFound();
  } catch (error) {
    return adminFailure(
      crypto.randomUUID(),
      503,
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Không thể tải chuyên mục tin tức.",
    );
  }
}

export async function PATCH(request: Request, context: CategoryRouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageNews(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được sửa chuyên mục tin tức.");
  }

  const id = await parseId(context);
  if (id === null) return notFound();
  const existing = await getAdminNewsCategory(guard.database, id);
  if (!existing) return notFound();

  const payload = await readJson(request);
  if (!hasExplicitRevision(payload)) {
    return adminFailure(
      crypto.randomUUID(),
      422,
      "VALIDATION_ERROR",
      "Revision hiện tại là bắt buộc khi cập nhật chuyên mục.",
      { revision: "Hãy tải lại chuyên mục và gửi revision hiện tại." },
    );
  }

  const parsed = parseAdminNewsCategoryPayload(payload, categoryDefaults(existing));
  if (!parsed.input) {
    return adminFailure(
      crypto.randomUUID(),
      422,
      "VALIDATION_ERROR",
      "Dữ liệu chuyên mục chưa hợp lệ.",
      parsed.fieldErrors,
    );
  }

  try {
    await updateAdminNewsCategoryAtomically(
      guard.database,
      id,
      parsed.input,
      payload.revision,
      guard.actorSubject,
    );
    const category = await getAdminNewsCategory(guard.database, id);
    return category ? adminSuccess(crypto.randomUUID(), { category }) : notFound();
  } catch (error) {
    const stale = error instanceof AdminNewsCategoryStaleWriteError;
    const unique = isUniqueError(error);
    return adminFailure(
      crypto.randomUUID(),
      stale || unique ? 409 : 503,
      stale ? "STALE_WRITE" : unique ? "UNIQUE_CONFLICT" : "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Không thể cập nhật chuyên mục tin tức.",
      unique ? { slug: "Slug chuyên mục đã tồn tại." } : undefined,
    );
  }
}

export async function DELETE(request: Request, context: CategoryRouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageNews(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được xóa chuyên mục tin tức.");
  }

  const id = await parseId(context);
  if (id === null) return notFound();
  const existing = await getAdminNewsCategory(guard.database, id);
  if (!existing) return notFound();

  const payload = await readJson(request);
  if (!hasExplicitRevision(payload)) {
    return adminFailure(
      crypto.randomUUID(),
      422,
      "VALIDATION_ERROR",
      "Revision hiện tại là bắt buộc khi xóa chuyên mục.",
      { revision: "Hãy tải lại chuyên mục và gửi revision hiện tại." },
    );
  }

  const articleCount = await countAdminNewsCategoryArticles(guard.database, id);
  if (articleCount > 0) {
    return adminFailure(
      crypto.randomUUID(),
      409,
      "INVALID_REQUEST",
      `Chuyên mục đang được ${articleCount} bài viết sử dụng. Hãy chuyển bài sang chuyên mục khác hoặc tạm ẩn chuyên mục.`,
    );
  }

  try {
    await deleteAdminNewsCategoryAtomically(
      guard.database,
      id,
      payload.revision,
      guard.actorSubject,
    );
    return adminSuccess(crypto.randomUUID(), { deleted: true, id });
  } catch (error) {
    const conflict = error instanceof AdminNewsCategoryConflictError;
    return adminFailure(
      crypto.randomUUID(),
      conflict ? 409 : 503,
      conflict ? "STALE_WRITE" : "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Không thể xóa chuyên mục tin tức.",
    );
  }
}

function canManageNews(role: string): boolean {
  return role === "owner" || role === "content_manager";
}

function categoryDefaults(category: {
  active: boolean;
  description: string;
  name: string;
  slug: string;
  sortOrder: number;
}): Partial<AdminNewsCategoryInput> {
  return {
    active: category.active,
    description: category.description,
    name: category.name,
    slug: category.slug,
    sortOrder: category.sortOrder,
  };
}

async function parseId(context: CategoryRouteContext): Promise<number | null> {
  const { id } = await context.params;
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function hasExplicitRevision(value: unknown): value is Record<string, unknown> {
  return typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && Object.prototype.hasOwnProperty.call(value, "revision");
}

function isUniqueError(error: unknown): boolean {
  return error instanceof Error && /unique|constraint/i.test(error.message);
}

function notFound(): Response {
  return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy chuyên mục tin tức.");
}
