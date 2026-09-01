import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canPublishNavigation } from "@/lib/admin-permissions.ts";
import { hasOnlyKeys, isAdminRequestId, readBoundedAdminJson } from "@/lib/admin-request";
import {
  publishAdminSiteNavigation,
  SiteNavigationConflictError,
  SiteNavigationNotFoundError,
  SiteNavigationValidationError,
} from "@/lib/site-navigation.ts";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canPublishNavigation(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được phát hành điều hướng.");
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
    || !hasOnlyKeys(body, ["requestId", "expectedVersion"])
    || typeof body.expectedVersion !== "number"
    || !Number.isSafeInteger(body.expectedVersion)
    || body.expectedVersion < 1
  ) {
    return adminFailure(requestId, 400, "INVALID_REQUEST", "Cần requestId và expectedVersion hợp lệ.");
  }
  try {
    const item = await publishAdminSiteNavigation(guard.database, {
      actorSubject: guard.actorSubject,
      expectedVersion: body.expectedVersion,
      id: (await context.params).id,
      requestId,
    });
    return adminSuccess(requestId, { item });
  } catch (error) {
    if (error instanceof SiteNavigationConflictError) return adminFailure(requestId, 409, "STALE_WRITE", error.message);
    if (error instanceof SiteNavigationNotFoundError) return adminFailure(requestId, 404, "NOT_FOUND", error.message);
    if (error instanceof SiteNavigationValidationError) return adminFailure(requestId, 422, "VALIDATION_ERROR", error.message);
    return adminErrorFrom(requestId, error, "Không thể phát hành mục điều hướng.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
