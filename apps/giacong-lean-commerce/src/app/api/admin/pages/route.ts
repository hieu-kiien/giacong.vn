import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManagePages, canPublishPages } from "@/lib/admin-permissions.ts";
import { createAdminSitePage, listAdminSitePages, SitePageValidationError } from "@/lib/site-pages.ts";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  try {
    const pages = await listAdminSitePages(guard.database);
    return adminSuccess(crypto.randomUUID(), {
      canEdit: canManagePages(guard.member.role),
      canPublish: canPublishPages(guard.member.role),
      pages,
      role: guard.member.role,
    });
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể tải danh sách page.");
  }
}

export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManagePages(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được tạo page.");
  }
  const body = await readJson(request);
  if (!isRecord(body) || typeof body.pageKey !== "string" || typeof body.routePath !== "string" || typeof body.title !== "string") {
    return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", "Cần pageKey, routePath và title.");
  }
  try {
    const page = await createAdminSitePage(guard.database, {
      actorSubject: guard.actorSubject,
      pageKey: body.pageKey,
      routePath: body.routePath,
      title: body.title,
    });
    return adminSuccess(crypto.randomUUID(), { page }, 201);
  } catch (error) {
    if (error instanceof SitePageValidationError) {
      return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", error.message);
    }
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể tạo page.", {
      fieldErrors: { pageKey: "pageKey hoặc routePath đã tồn tại." },
      message: "pageKey hoặc routePath đã tồn tại.",
    });
  }
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
