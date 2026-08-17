import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { getAdminNewsArticle } from "@/lib/admin-news-data";
import { adminNewsArticleDefaults, parseAdminNewsArticlePayload } from "@/lib/admin-news-input";
import {
  AdminNewsStaleWriteError,
  deleteAdminNewsArticleAtomically,
  updateAdminNewsArticleAtomically,
} from "@/lib/admin-news-write";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

interface ArticleRouteContext { params: Promise<{ id: string }>; }

export async function GET(request: Request, context: ArticleRouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  const id = await parseId(context);
  if (id === null) return notFound();

  try {
    const article = await getAdminNewsArticle(guard.database, id);
    return article ? adminSuccess(crypto.randomUUID(), { article }) : notFound();
  } catch (error) {
    return adminFailure(crypto.randomUUID(), 503, "INTERNAL_ERROR", errorMessage(error, "Không thể tải bài viết."));
  }
}

export async function PATCH(request: Request, context: ArticleRouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageNews(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được sửa bài viết.");
  }
  const id = await parseId(context);
  if (id === null) return notFound();
  const existing = await getAdminNewsArticle(guard.database, id);
  if (!existing) return notFound();

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
  const parsed = parseAdminNewsArticlePayload(payload, adminNewsArticleDefaults(existing));
  if (!parsed.input) {
    return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", "Dữ liệu bài viết chưa hợp lệ.", parsed.fieldErrors);
  }

  try {
    await updateAdminNewsArticleAtomically(guard.database, id, parsed.input, payload.revision, guard.actorSubject);
    const article = await getAdminNewsArticle(guard.database, id);
    return article ? adminSuccess(crypto.randomUUID(), { article }) : notFound();
  } catch (error) {
    const stale = error instanceof AdminNewsStaleWriteError;
    const unique = isUniqueError(error);
    return adminFailure(
      crypto.randomUUID(),
      stale || unique ? 409 : 503,
      stale ? "STALE_WRITE" : unique ? "UNIQUE_CONFLICT" : "INTERNAL_ERROR",
      errorMessage(error, "Không thể cập nhật bài viết."),
      unique ? { slug: "Slug bài viết đã tồn tại." } : undefined,
    );
  }
}

export async function DELETE(request: Request, context: ArticleRouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageNews(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được xóa bài viết.");
  }
  const id = await parseId(context);
  if (id === null) return notFound();
  const existing = await getAdminNewsArticle(guard.database, id);
  if (!existing) return notFound();
  const payload = await readJson(request);
  if (!hasExplicitRevision(payload)) {
    return adminFailure(
      crypto.randomUUID(),
      422,
      "VALIDATION_ERROR",
      "Revision hiện tại là bắt buộc khi xóa bài viết.",
      { revision: "Hãy tải lại bài viết và gửi revision hiện tại." },
    );
  }

  try {
    await deleteAdminNewsArticleAtomically(guard.database, id, payload.revision, guard.actorSubject);
    return adminSuccess(crypto.randomUUID(), { deleted: true, id });
  } catch (error) {
    const stale = error instanceof AdminNewsStaleWriteError;
    return adminFailure(
      crypto.randomUUID(),
      stale ? 409 : 503,
      stale ? "STALE_WRITE" : "INTERNAL_ERROR",
      errorMessage(error, "Không thể xóa bài viết."),
    );
  }
}

function canManageNews(role: string): boolean {
  return role === "owner" || role === "content_manager";
}

async function parseId(context: ArticleRouteContext): Promise<number | null> {
  const { id } = await context.params;
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function readJson(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { return {}; }
}

function hasExplicitRevision(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && Object.prototype.hasOwnProperty.call(value, "revision");
}

function isUniqueError(error: unknown): boolean {
  return error instanceof Error && /unique|constraint/i.test(error.message);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function notFound(): Response {
  return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy bài viết.");
}
