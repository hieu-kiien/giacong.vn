import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManage, canManagePages, canPublishPages } from "@/lib/admin-permissions.ts";
import { readBoundedAdminJson } from "@/lib/admin-request";
import { createAdminSitePage, listAdminSitePages, SitePageValidationError } from "@/lib/site-pages.ts";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManage(guard.member.role, "pages.read")) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được xem page.");
  }
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
  const parsedRequest = await readBoundedAdminJson(request);
  if (!parsedRequest.ok) return adminFailure(parsedRequest.requestId, parsedRequest.status, parsedRequest.code, parsedRequest.message);
  const body = parsedRequest.body;
  if (!isRecord(body) || typeof body.pageKey !== "string" || typeof body.routePath !== "string" || typeof body.title !== "string") {
    return adminFailure(parsedRequest.requestId, 422, "VALIDATION_ERROR", "Cần pageKey, routePath và title.");
  }
  try {
    const page = await createAdminSitePage(guard.database, {
      actorSubject: guard.actorSubject,
      pageKey: body.pageKey,
      routePath: body.routePath,
      title: body.title,
    });
    return adminSuccess(parsedRequest.requestId, { page }, 201);
  } catch (error) {
    if (error instanceof SitePageValidationError) {
      return adminFailure(parsedRequest.requestId, 422, "VALIDATION_ERROR", error.message);
    }
    return adminErrorFrom(parsedRequest.requestId, error, "Không thể tạo page.", {
      fieldErrors: { pageKey: "pageKey hoặc routePath đã tồn tại." },
      message: "pageKey hoặc routePath đã tồn tại.",
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
