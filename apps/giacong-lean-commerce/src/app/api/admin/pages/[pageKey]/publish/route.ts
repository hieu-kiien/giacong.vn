import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canPublishPages } from "@/lib/admin-permissions.ts";
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
  const body = await readJson(request);
  if (!isRecord(body) || typeof body.expectedVersion !== "number" || !Number.isInteger(body.expectedVersion)) {
    return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", "Cần expectedVersion hợp lệ.");
  }
  try {
    const page = await publishAdminSitePage(guard.database, {
      actorSubject: guard.actorSubject,
      expectedVersion: body.expectedVersion,
      pageKey: (await context.params).pageKey,
    });
    return adminSuccess(crypto.randomUUID(), { page });
  } catch (error) {
    if (error instanceof SitePageConflictError) return adminFailure(crypto.randomUUID(), 409, "STALE_WRITE", error.message);
    if (error instanceof SitePageNotFoundError) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", error.message);
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể phát hành page.");
  }
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
