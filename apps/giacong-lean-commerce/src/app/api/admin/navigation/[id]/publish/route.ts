import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canPublishNavigation } from "@/lib/admin-permissions.ts";
import { readBoundedAdminJson } from "@/lib/admin-request";
import {
  publishAdminSiteNavigation,
  SiteNavigationConflictError,
  SiteNavigationNotFoundError,
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
  if (!isRecord(body) || typeof body.expectedVersion !== "number" || !Number.isInteger(body.expectedVersion)) {
    return adminFailure(parsedRequest.requestId, 422, "VALIDATION_ERROR", "Cần expectedVersion hợp lệ.");
  }
  try {
    const item = await publishAdminSiteNavigation(guard.database, {
      actorSubject: guard.actorSubject,
      expectedVersion: body.expectedVersion,
      id: (await context.params).id,
    });
    return adminSuccess(parsedRequest.requestId, { item });
  } catch (error) {
    if (error instanceof SiteNavigationConflictError) return adminFailure(parsedRequest.requestId, 409, "STALE_WRITE", error.message);
    if (error instanceof SiteNavigationNotFoundError) return adminFailure(parsedRequest.requestId, 404, "NOT_FOUND", error.message);
    return adminErrorFrom(parsedRequest.requestId, error, "Không thể phát hành mục điều hướng.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
