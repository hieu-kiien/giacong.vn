import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canPublishPages } from "@/lib/admin-permissions.ts";
import { hasOnlyKeys, isAdminRequestId, readBoundedAdminJson } from "@/lib/admin-request";
import {
  publishAdminSitePage,
  SitePageConflictError,
  SitePageIdempotencyConflictError,
  SitePageNotFoundError,
  SitePageValidationError,
} from "@/lib/site-pages.ts";
import { revalidatePublishedStorefront, withStorefrontPurgeHeader } from "@/lib/storefront-revalidate";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ pageKey: string }>;
}
export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canPublishPages(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được phát hành page.");
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
    || typeof body.expectedVersion !== "number"
    || !Number.isInteger(body.expectedVersion)
    || !hasOnlyKeys(body, ["requestId", "expectedVersion"])
  ) {
    return adminFailure(requestId, 400, "INVALID_REQUEST", "Cần requestId và expectedVersion hợp lệ.");
  }
  try {
    const page = await publishAdminSitePage(guard.database, {
      actorSubject: guard.actorSubject,
      expectedVersion: body.expectedVersion,
      pageKey: (await context.params).pageKey,
      requestId,
    });
    revalidatePublishedStorefront({
      tags: ["published-site-page", "site-pages"],
      paths: [page.routePath, "/"],
    });
    return withStorefrontPurgeHeader(adminSuccess(requestId, { page }), [page.routePath, "/"]);
  } catch (error) {
    if (error instanceof SitePageConflictError) return adminFailure(requestId, 409, "STALE_WRITE", error.message);
    if (error instanceof SitePageIdempotencyConflictError) return adminFailure(requestId, 409, "IDEMPOTENCY_CONFLICT", error.message);
    if (error instanceof SitePageNotFoundError) return adminFailure(requestId, 404, "NOT_FOUND", error.message);
    if (error instanceof SitePageValidationError) return adminFailure(requestId, 422, "VALIDATION_ERROR", error.message);
    return adminErrorFrom(requestId, error, "Không thể phát hành page.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
