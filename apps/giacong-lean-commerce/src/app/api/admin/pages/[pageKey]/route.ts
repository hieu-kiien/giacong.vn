import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManagePages } from "@/lib/admin-permissions.ts";
import { readBoundedAdminJson } from "@/lib/admin-request";
import {
  getAdminSitePage,
  SitePageConflictError,
  SitePageNotFoundError,
  SitePageValidationError,
  updateAdminSitePage,
} from "@/lib/site-pages.ts";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ pageKey: string }>;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  try {
    const page = await getAdminSitePage(guard.database, (await context.params).pageKey);
    return page
      ? adminSuccess(crypto.randomUUID(), { page })
      : adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy page.");
  } catch (error) {
    return pageFailure(error, "Không thể tải page.");
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManagePages(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được sửa page.");
  }
  const parsedRequest = await readBoundedAdminJson(request);
  if (!parsedRequest.ok) return adminFailure(parsedRequest.requestId, parsedRequest.status, parsedRequest.code, parsedRequest.message);
  const body = parsedRequest.body;
  if (
    !isRecord(body)
    || !Array.isArray(body.blocks)
    || typeof body.draftEnabled !== "boolean"
    || typeof body.expectedVersion !== "number"
    || !Number.isInteger(body.expectedVersion)
    || typeof body.seoTitle !== "string"
    || typeof body.seoDescription !== "string"
  ) {
    return adminFailure(parsedRequest.requestId, 422, "VALIDATION_ERROR", "Cần blocks, draftEnabled, expectedVersion và SEO hợp lệ.");
  }
  try {
    const page = await updateAdminSitePage(guard.database, {
      actorSubject: guard.actorSubject,
      blocks: body.blocks,
      draftEnabled: body.draftEnabled,
      expectedVersion: body.expectedVersion,
      pageKey: (await context.params).pageKey,
      seoDescription: body.seoDescription,
      seoTitle: body.seoTitle,
    });
    return adminSuccess(parsedRequest.requestId, { page });
  } catch (error) {
    return pageFailure(error, "Không thể lưu page.");
  }
}

function pageFailure(error: unknown, fallbackMessage: string): Response {
  if (error instanceof SitePageConflictError) return adminFailure(crypto.randomUUID(), 409, "STALE_WRITE", error.message);
  if (error instanceof SitePageNotFoundError) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", error.message);
  if (error instanceof SitePageValidationError) return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", error.message);
  return adminErrorFrom(crypto.randomUUID(), error, fallbackMessage);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
