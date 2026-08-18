import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { getAdminNewsArticle } from "@/lib/admin-news-data.ts";
import {
  parseAdminNewsPayload,
  type AdminNewsInput,
} from "@/lib/admin-news-input.ts";
import {
  AdminNewsStaleWriteError,
  archiveAdminNewsArticleAtomically,
  updateAdminNewsArticleAtomically,
} from "@/lib/admin-news-write.ts";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

interface NewsRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: NewsRouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  const id = await parseId(context);
  if (id === null) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy bài viết.");

  try {
    const article = await getAdminNewsArticle(guard.database, id);
    return article
      ? adminSuccess(crypto.randomUUID(), { article })
      : adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy bài viết.");
  } catch (error) {
    return adminFailure(
      crypto.randomUUID(),
      503,
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Không thể tải bài viết.",
    );
  }
}

export async function PATCH(request: Request, context: NewsRouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageNews(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được sửa bài viết.");
  }

  const id = await parseId(context);
  if (id === null) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy bài viết.");
  const existing = await getAdminNewsArticle(guard.database, id);
  if (!existing || existing.archivedAt) {
    return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy bài viết đang hoạt động.");
  }

  const payload = await readJson(request);
  if (!hasExplicitRevision(payload)) {
    return adminFailure(
      crypto.randomUUID(),
      422,
      "VALIDATION_ERROR",
      "Revision hiện tại là bắt buộc khi cập nhật bài viết.",
      { revision: "Hãy tải lại bài viết và gửi revision hiện tại." },
    );
  }
  const parsed = parseAdminNewsPayload(payload, articleDefaults(existing));
  if (!parsed.input) {
    return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", "Dữ liệu bài viết chưa hợp lệ.", parsed.fieldErrors);
  }

  try {
    await updateAdminNewsArticleAtomically(guard.database, id, parsed.input, payload.revision, guard.actorSubject);
    const article = await getAdminNewsArticle(guard.database, id);
    return article
      ? adminSuccess(crypto.randomUUID(), { article })
      : adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy bài viết.");
  } catch (error) {
    const stale = error instanceof AdminNewsStaleWriteError;
    const unique = isUniqueError(error);
    const mediaReference = isMediaReferenceError(error);
    return adminFailure(
      crypto.randomUUID(),
      stale || unique || mediaReference ? 409 : 503,
      stale
        ? "STALE_WRITE"
        : unique
          ? "UNIQUE_CONFLICT"
          : mediaReference
            ? "MEDIA_REFERENCE_CONFLICT"
            : "INTERNAL_ERROR",
      mediaReference
        ? "Ảnh đại diện đã bị xóa, không hoạt động hoặc không thuộc bài viết này."
        : error instanceof Error
          ? error.message
          : "Không thể cập nhật bài viết.",
      unique
        ? { slug: "Slug đã tồn tại." }
        : mediaReference
          ? { thumbnailUrl: "Hãy chọn lại một ảnh đang hoạt động trong Media bài viết." }
          : undefined,
    );
  }
}

export async function DELETE(request: Request, context: NewsRouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageNews(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được lưu trữ bài viết.");
  }

  const id = await parseId(context);
  if (id === null) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy bài viết.");
  const existing = await getAdminNewsArticle(guard.database, id);
  if (!existing || existing.archivedAt) {
    return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy bài viết đang hoạt động.");
  }

  const payload = await readJson(request);
  if (!hasExplicitRevision(payload)) {
    return adminFailure(
      crypto.randomUUID(),
      422,
      "VALIDATION_ERROR",
      "Revision hiện tại là bắt buộc khi lưu trữ bài viết.",
      { revision: "Hãy tải lại bài viết và gửi revision hiện tại." },
    );
  }

  try {
    await archiveAdminNewsArticleAtomically(guard.database, id, payload.revision, guard.actorSubject);
    const article = await getAdminNewsArticle(guard.database, id);
    return article
      ? adminSuccess(crypto.randomUUID(), { article })
      : adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy bài viết.");
  } catch (error) {
    const stale = error instanceof AdminNewsStaleWriteError;
    return adminFailure(
      crypto.randomUUID(),
      stale ? 409 : 503,
      stale ? "STALE_WRITE" : "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Không thể lưu trữ bài viết.",
    );
  }
}

function canManageNews(role: string): boolean {
  return role === "owner" || role === "content_manager";
}

function articleDefaults(article: {
  categoryId: number | null;
  contentText: string;
  excerpt: string;
  featured: boolean;
  publishedAt: string | null;
  seoDescription: string;
  seoTitle: string;
  slug: string;
  status: string;
  thumbnailUrl: string | null;
  title: string;
}): Partial<AdminNewsInput> {
  return {
    categoryId: article.categoryId,
    contentText: article.contentText,
    excerpt: article.excerpt,
    featured: article.featured,
    publishedAt: article.publishedAt,
    seoDescription: article.seoDescription,
    seoTitle: article.seoTitle,
    slug: article.slug,
    status: article.status as AdminNewsInput["status"],
    thumbnailUrl: article.thumbnailUrl,
    title: article.title,
  };
}

async function parseId(context: NewsRouteContext): Promise<number | null> {
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

function isMediaReferenceError(error: unknown): boolean {
  return error instanceof Error && /INVALID_NEWS_MEDIA_REFERENCE/.test(error.message);
}
