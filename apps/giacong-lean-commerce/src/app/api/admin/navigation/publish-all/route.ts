import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canPublishNavigation } from "@/lib/admin-permissions.ts";
import { hasOnlyKeys, isAdminRequestId, readBoundedAdminJson } from "@/lib/admin-request";
import {
  publishAllAdminSiteNavigation,
  SiteNavigationIdempotencyConflictError,
  SiteNavigationValidationError,
} from "@/lib/site-navigation.ts";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canPublishNavigation(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được phát hành điều hướng.");
  }
  const parsed = await readBoundedAdminJson(request);
  if (!parsed.ok) return adminFailure(parsed.requestId, parsed.status, parsed.code, parsed.message);
  const body = parsed.body;
  const requestId = isRecord(body) && isAdminRequestId(body.requestId)
    ? body.requestId.trim().toLowerCase()
    : parsed.requestId;
  if (!isRecord(body) || !isAdminRequestId(body.requestId) || !hasOnlyKeys(body, ["requestId"])) {
    return adminFailure(requestId, 400, "INVALID_REQUEST", "Cần requestId hợp lệ cho thao tác phát hành điều hướng hàng loạt.");
  }
  try {
    const result = await publishAllAdminSiteNavigation(guard.database, {
      actorSubject: guard.actorSubject,
      requestId,
    });
    return adminSuccess(requestId, result);
  } catch (error) {
    if (error instanceof SiteNavigationIdempotencyConflictError) {
      return adminFailure(requestId, 409, "IDEMPOTENCY_CONFLICT", error.message);
    }
    if (error instanceof SiteNavigationValidationError) {
      return adminFailure(requestId, 422, "VALIDATION_ERROR", error.message);
    }
    return adminErrorFrom(requestId, error, "Không thể phát hành điều hướng.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
