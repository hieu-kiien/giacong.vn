import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManageNavigation, canPublishNavigation } from "@/lib/admin-permissions.ts";
import { hasOnlyKeys, isAdminRequestId, readBoundedAdminJson } from "@/lib/admin-request";
import {
  createAdminSiteNavigation,
  listAdminSiteNavigation,
  SiteNavigationIdempotencyConflictError,
  SiteNavigationValidationError,
} from "@/lib/site-navigation.ts";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  try {
    const items = await listAdminSiteNavigation(guard.database);
    return adminSuccess(crypto.randomUUID(), {
      canEdit: canManageNavigation(guard.member.role),
      canPublish: canPublishNavigation(guard.member.role),
      items,
      role: guard.member.role,
    });
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể tải điều hướng website.");
  }
}

export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageNavigation(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được thêm mục điều hướng.");
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
    || !hasOnlyKeys(body, ["requestId", "menuKey", "label", "href", "capturedMenuId", "sortOrder", "isActive"])
    || typeof body.menuKey !== "string"
    || typeof body.label !== "string"
    || typeof body.href !== "string"
    || (body.capturedMenuId !== undefined && body.capturedMenuId !== null && typeof body.capturedMenuId !== "string")
    || (body.sortOrder !== undefined && typeof body.sortOrder !== "number")
    || (body.isActive !== undefined && typeof body.isActive !== "boolean")
  ) {
    return adminFailure(requestId, 422, "VALIDATION_ERROR", "Cần requestId, menuKey, label và href hợp lệ.");
  }
  try {
    const item = await createAdminSiteNavigation(guard.database, {
      actorSubject: guard.actorSubject,
      capturedMenuId: body.capturedMenuId,
      href: body.href,
      isActive: body.isActive,
      label: body.label,
      menuKey: body.menuKey,
      requestId,
      sortOrder: body.sortOrder,
    });
    return adminSuccess(requestId, { item }, 201);
  } catch (error) {
    if (error instanceof SiteNavigationIdempotencyConflictError) {
      return adminFailure(requestId, 409, "IDEMPOTENCY_CONFLICT", error.message);
    }
    if (error instanceof SiteNavigationValidationError) {
      return adminFailure(requestId, 422, "VALIDATION_ERROR", error.message);
    }
    return adminErrorFrom(requestId, error, "Không thể thêm mục điều hướng.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
