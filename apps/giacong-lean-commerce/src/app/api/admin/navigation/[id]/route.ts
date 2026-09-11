import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManage, canManageNavigation } from "@/lib/admin-permissions.ts";
import { hasOnlyKeys, isAdminRequestId, readBoundedAdminJson } from "@/lib/admin-request";
import {
  getAdminSiteNavigation,
  SiteNavigationConflictError,
  SiteNavigationNotFoundError,
  SiteNavigationValidationError,
  updateAdminSiteNavigation,
} from "@/lib/site-navigation.ts";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManage(guard.member.role, "navigation.read")) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được xem điều hướng.");
  }
  try {
    const item = await getAdminSiteNavigation(guard.database, (await context.params).id);
    return item
      ? adminSuccess(crypto.randomUUID(), { item })
      : adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy mục điều hướng.");
  } catch (error) {
    return navigationFailure(error, "Không thể tải mục điều hướng.");
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageNavigation(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được sửa điều hướng.");
  }
  const parsedRequest = await readBoundedAdminJson(request);
  if (!parsedRequest.ok) return adminFailure(parsedRequest.requestId, parsedRequest.status, parsedRequest.code, parsedRequest.message);
  const body = parsedRequest.body;
  const requestId = isRecord(body) && isAdminRequestId(body.requestId)
    ? body.requestId.trim().toLowerCase()
    : parsedRequest.requestId;
  if (
    !isRecord(body)
    || !isAdminRequestId(body.requestId)
    || !hasOnlyKeys(body, ["requestId", "expectedVersion", "label", "href", "parentId", "sortOrder", "isActive"])
    || typeof body.expectedVersion !== "number"
    || !Number.isSafeInteger(body.expectedVersion)
    || body.expectedVersion < 1
    || typeof body.label !== "string"
    || typeof body.href !== "string"
    || (body.parentId !== undefined && body.parentId !== null && typeof body.parentId !== "string")
    || typeof body.sortOrder !== "number"
    || !Number.isInteger(body.sortOrder)
    || typeof body.isActive !== "boolean"
  ) {
    return adminFailure(requestId, 422, "VALIDATION_ERROR", "Cần label, href, sortOrder, isActive và expectedVersion hợp lệ.");
  }
  try {
    const item = await updateAdminSiteNavigation(guard.database, {
      actorSubject: guard.actorSubject,
      expectedVersion: body.expectedVersion,
      href: body.href,
      id: (await context.params).id,
      isActive: body.isActive,
      label: body.label,
      parentId: body.parentId,
      requestId,
      sortOrder: body.sortOrder,
    });
    return adminSuccess(requestId, { item });
  } catch (error) {
    return navigationFailure(error, "Không thể lưu mục điều hướng.", requestId);
  }
}

function navigationFailure(error: unknown, fallbackMessage: string, requestId = crypto.randomUUID()): Response {
  if (error instanceof SiteNavigationConflictError) return adminFailure(requestId, 409, "STALE_WRITE", error.message);
  if (error instanceof SiteNavigationNotFoundError) return adminFailure(requestId, 404, "NOT_FOUND", error.message);
  if (error instanceof SiteNavigationValidationError) return adminFailure(requestId, 422, "VALIDATION_ERROR", error.message);
  return adminErrorFrom(requestId, error, fallbackMessage);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
