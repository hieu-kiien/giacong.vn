import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManage, canManagePages, canPublishPages } from "@/lib/admin-permissions.ts";
import { hasOnlyKeys, isAdminRequestId, readBoundedAdminJson } from "@/lib/admin-request";
import {
  createAdminSitePage,
  listAdminSitePages,
  SitePageIdempotencyConflictError,
  SitePageValidationError,
} from "@/lib/site-pages.ts";

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
  const requestId = isRecord(body) && typeof body.requestId === "string"
    ? body.requestId.trim().toLowerCase()
    : parsedRequest.requestId;
  if (
    !isRecord(body)
    || !isAdminRequestId(body.requestId)
    || typeof body.pageKey !== "string"
    || typeof body.routePath !== "string"
    || typeof body.title !== "string"
    || !hasOnlyKeys(body, ["requestId", "pageKey", "routePath", "title"])
  ) {
    return adminFailure(requestId, 400, "INVALID_REQUEST", "Cần requestId, pageKey, routePath và title hợp lệ.");
  }
  try {
    const page = await createAdminSitePage(guard.database, {
      actorSubject: guard.actorSubject,
      pageKey: body.pageKey,
      requestId,
      routePath: body.routePath,
      title: body.title,
    });
    return adminSuccess(requestId, { page }, 201);
  } catch (error) {
    if (error instanceof SitePageIdempotencyConflictError) return adminFailure(requestId, 409, "IDEMPOTENCY_CONFLICT", error.message);
    if (error instanceof SitePageValidationError) {
      return adminFailure(requestId, 422, "VALIDATION_ERROR", error.message);
    }
    return adminErrorFrom(requestId, error, "Không thể tạo page.", {
      fieldErrors: { pageKey: "pageKey hoặc routePath đã tồn tại." },
      message: "pageKey hoặc routePath đã tồn tại.",
    });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
