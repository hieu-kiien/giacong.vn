import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManageNavigation } from "@/lib/admin-permissions.ts";
import { readBoundedAdminJson } from "@/lib/admin-request";
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
  if (
    !isRecord(body)
    || typeof body.expectedVersion !== "number"
    || !Number.isInteger(body.expectedVersion)
    || typeof body.label !== "string"
    || typeof body.href !== "string"
    || typeof body.sortOrder !== "number"
    || !Number.isInteger(body.sortOrder)
    || typeof body.isActive !== "boolean"
  ) {
    return adminFailure(parsedRequest.requestId, 422, "VALIDATION_ERROR", "Cần label, href, sortOrder, isActive và expectedVersion hợp lệ.");
  }
  try {
    const item = await updateAdminSiteNavigation(guard.database, {
      actorSubject: guard.actorSubject,
      expectedVersion: body.expectedVersion,
      href: body.href,
      id: (await context.params).id,
      isActive: body.isActive,
      label: body.label,
      sortOrder: body.sortOrder,
    });
    return adminSuccess(parsedRequest.requestId, { item });
  } catch (error) {
    return navigationFailure(error, "Không thể lưu mục điều hướng.");
  }
}

function navigationFailure(error: unknown, fallbackMessage: string): Response {
  if (error instanceof SiteNavigationConflictError) return adminFailure(crypto.randomUUID(), 409, "STALE_WRITE", error.message);
  if (error instanceof SiteNavigationNotFoundError) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", error.message);
  if (error instanceof SiteNavigationValidationError) return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", error.message);
  return adminErrorFrom(crypto.randomUUID(), error, fallbackMessage);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
