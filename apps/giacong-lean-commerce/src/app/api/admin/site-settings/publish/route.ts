import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { canPublishSiteContent } from "@/lib/admin-permissions";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import {
  publishAdminSiteSetting,
  SiteSettingConflictError,
  SiteSettingNotFoundError,
  SiteSettingValidationError,
} from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canPublishSiteContent(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được phát hành nội dung.");
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  if (!isRecord(body) || typeof body.key !== "string" || typeof body.expectedVersion !== "number" || !Number.isInteger(body.expectedVersion)) {
    return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", "Cần key và expectedVersion hợp lệ.");
  }
  try {
    const setting = await publishAdminSiteSetting(guard.database, {
      actorSubject: guard.actorSubject,
      expectedVersion: body.expectedVersion,
      key: body.key,
    });
    return adminSuccess(crypto.randomUUID(), { setting });
  } catch (error) {
    if (error instanceof SiteSettingConflictError) return adminFailure(crypto.randomUUID(), 409, "STALE_WRITE", error.message);
    if (error instanceof SiteSettingNotFoundError) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", error.message);
    if (error instanceof SiteSettingValidationError) return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", error.message);
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể phát hành cấu hình website.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}