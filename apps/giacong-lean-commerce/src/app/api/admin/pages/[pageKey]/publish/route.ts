import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canPublishPages } from "@/lib/admin-permissions.ts";
import { readBoundedAdminJson } from "@/lib/admin-request";
import {
  publishAdminSitePage,
  SitePageConflictError,
  SitePageNotFoundError,
} from "@/lib/site-pages.ts";

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
  if (!isRecord(body) || typeof body.expectedVersion !== "number" || !Number.isInteger(body.expectedVersion)) {
    return adminFailure(parsedRequest.requestId, 422, "VALIDATION_ERROR", "Cần expectedVersion hợp lệ.");
  }
  try {
    const page = await publishAdminSitePage(guard.database, {
      actorSubject: guard.actorSubject,
      expectedVersion: body.expectedVersion,
      pageKey: (await context.params).pageKey,
    });
    return adminSuccess(parsedRequest.requestId, { page });
  } catch (error) {
    if (error instanceof SitePageConflictError) return adminFailure(parsedRequest.requestId, 409, "STALE_WRITE", error.message);
    if (error instanceof SitePageNotFoundError) return adminFailure(parsedRequest.requestId, 404, "NOT_FOUND", error.message);
    return adminErrorFrom(parsedRequest.requestId, error, "Không thể phát hành page.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
