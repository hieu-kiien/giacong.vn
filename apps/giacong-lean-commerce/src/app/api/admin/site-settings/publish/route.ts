import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { hasOnlyKeys, isAdminRequestId, readBoundedAdminJson } from "@/lib/admin-request";
import { canPublishSiteContent } from "@/lib/admin-permissions";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import {
  publishAdminSiteSetting,
  SiteSettingConflictError,
  SiteSettingIdempotencyConflictError,
  SiteSettingNotFoundError,
  SiteSettingValidationError,
} from "@/lib/site-settings";
import { revalidatePublishedStorefront, withStorefrontPurgeHeader } from "@/lib/storefront-revalidate";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canPublishSiteContent(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được phát hành nội dung.");
  }
  const parsed = await readBoundedAdminJson(request);
  if (!parsed.ok) return adminFailure(parsed.requestId, parsed.status, parsed.code, parsed.message);
  const body = parsed.body;
  const requestId = isRecord(body) && typeof body.requestId === "string"
    ? body.requestId.trim().toLowerCase()
    : parsed.requestId;
  if (
    !isRecord(body)
    || !isAdminRequestId(body.requestId)
    || typeof body.key !== "string"
    || typeof body.expectedVersion !== "number"
    || !Number.isInteger(body.expectedVersion)
    || body.expectedVersion <= 0
    || !hasOnlyKeys(body, ["requestId", "key", "expectedVersion"])
  ) {
    return adminFailure(requestId, 400, "INVALID_REQUEST", "Cần requestId, key và expectedVersion hợp lệ.");
  }
  try {
    const setting = await publishAdminSiteSetting(guard.database, {
      actorSubject: guard.actorSubject,
      expectedVersion: body.expectedVersion,
      key: body.key,
      requestId,
    });
    const paths = ["/", "/san-pham", "/thue-gia-cong", "/tin-tuc"];
    revalidatePublishedStorefront({
      tags: ["published-site-settings", "site-settings"],
      paths,
    });
    return withStorefrontPurgeHeader(adminSuccess(requestId, { setting }), paths);
  } catch (error) {
    if (error instanceof SiteSettingConflictError) return adminFailure(requestId, 409, "STALE_WRITE", error.message);
    if (error instanceof SiteSettingIdempotencyConflictError) return adminFailure(requestId, 409, "IDEMPOTENCY_CONFLICT", error.message);
    if (error instanceof SiteSettingNotFoundError) return adminFailure(requestId, 404, "NOT_FOUND", error.message);
    if (error instanceof SiteSettingValidationError) return adminFailure(requestId, 422, "VALIDATION_ERROR", error.message);
    return adminErrorFrom(requestId, error, "Không thể phát hành cấu hình website.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
