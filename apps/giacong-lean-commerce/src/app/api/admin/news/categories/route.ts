import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import {
  getAdminNewsCategory,
  listAdminNewsCategories,
} from "@/lib/admin-news-data.ts";
import { parseAdminNewsCategoryPayload } from "@/lib/admin-news-input.ts";
import { createAdminNewsCategoryAtomically } from "@/lib/admin-news-write.ts";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;

  try {
    return adminSuccess(crypto.randomUUID(), {
      categories: await listAdminNewsCategories(guard.database),
    });
  } catch (error) {
    return adminFailure(
      crypto.randomUUID(),
      503,
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Không thể tải chuyên mục tin tức.",
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageNews(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được tạo chuyên mục tin tức.");
  }

  const parsed = parseAdminNewsCategoryPayload(await readJson(request));
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
    const categoryId = await createAdminNewsCategoryAtomically(
      guard.database,
      parsed.input,
      guard.actorSubject,
    );
    const category = await getAdminNewsCategory(guard.database, categoryId);
    return category
      ? adminSuccess(crypto.randomUUID(), { category }, 201)
      : adminFailure(crypto.randomUUID(), 503, "INTERNAL_ERROR", "Không đọc lại được chuyên mục vừa tạo.");
  } catch (error) {
    const unique = isUniqueError(error);
    return adminFailure(
      crypto.randomUUID(),
      unique ? 409 : 503,
      unique ? "UNIQUE_CONFLICT" : "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Không thể tạo chuyên mục tin tức.",
      unique ? { slug: "Slug chuyên mục đã tồn tại." } : undefined,
    );
  }
}

function canManageNews(role: string): boolean {
  return role === "owner" || role === "content_manager";
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function isUniqueError(error: unknown): boolean {
  return error instanceof Error && /unique|constraint/i.test(error.message);
}
