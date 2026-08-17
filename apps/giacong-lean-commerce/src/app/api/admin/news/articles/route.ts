import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import {
  getAdminNewsArticle,
  listAdminNewsArticles,
  listAdminNewsCategories,
} from "@/lib/admin-news-data";
import { parseAdminNewsArticlePayload } from "@/lib/admin-news-input";
import { createAdminNewsArticleAtomically } from "@/lib/admin-news-write";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  const url = new URL(request.url);
  const page = parsePositiveInt(url.searchParams.get("page"), 1);
  const pageSize = Math.min(parsePositiveInt(url.searchParams.get("pageSize"), 20), 100);
  const categoryId = parseOptionalPositiveInt(url.searchParams.get("categoryId"));

  try {
    const [data, categories] = await Promise.all([
      listAdminNewsArticles(guard.database, {
        page,
        pageSize,
        query: url.searchParams.get("query"),
        status: url.searchParams.get("status"),
        categoryId,
      }),
      listAdminNewsCategories(guard.database),
    ]);
    return adminSuccess(crypto.randomUUID(), {
      articles: data.articles,
      categories,
      total: data.total,
      pagination: {
        currentPage: page,
        lastPage: Math.max(1, Math.ceil(data.total / pageSize)),
        pageSize,
        total: data.total,
      },
    });
  } catch (error) {
    return adminFailure(crypto.randomUUID(), 503, "INTERNAL_ERROR", errorMessage(error, "Không thể tải danh sách bài viết."));
  }
}

export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageNews(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được tạo bài viết.");
  }

  const parsed = parseAdminNewsArticlePayload(await readJson(request));
  if (!parsed.input) {
    return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", "Dữ liệu bài viết chưa hợp lệ.", parsed.fieldErrors);
  }
  if (parsed.input.status === "published") {
    return adminFailure(
      crypto.randomUUID(),
      422,
      "VALIDATION_ERROR",
      "Bài viết mới cần được tạo ở draft trước khi phát hành.",
      { status: "Hãy lưu draft, kiểm tra nội dung rồi mới publish." },
    );
  }

  try {
    const articleId = await createAdminNewsArticleAtomically(guard.database, parsed.input, guard.actorSubject);
    const article = await getAdminNewsArticle(guard.database, articleId);
    return article
      ? adminSuccess(crypto.randomUUID(), { article }, 201)
      : adminFailure(crypto.randomUUID(), 503, "INTERNAL_ERROR", "Không đọc lại được bài viết vừa tạo.");
  } catch (error) {
    const unique = isUniqueError(error);
    return adminFailure(
      crypto.randomUUID(),
      unique ? 409 : 503,
      unique ? "UNIQUE_CONFLICT" : "INTERNAL_ERROR",
      errorMessage(error, "Không thể tạo bài viết."),
      unique ? { slug: "Slug bài viết đã tồn tại." } : undefined,
    );
  }
}

function canManageNews(role: string): boolean {
  return role === "owner" || role === "content_manager";
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

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOptionalPositiveInt(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
