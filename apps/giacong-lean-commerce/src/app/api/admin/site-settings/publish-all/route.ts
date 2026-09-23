import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { hasOnlyKeys, isAdminRequestId, readBoundedAdminJson } from "@/lib/admin-request";
import { canPublishSiteContent } from "@/lib/admin-permissions";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import {
  publishAllAdminSiteSettings,
  SiteSettingIdempotencyConflictError,
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
  const requestId = isRecord(body) && isAdminRequestId(body.requestId)
    ? body.requestId.trim().toLowerCase()
    : parsed.requestId;
  if (!isRecord(body) || !isAdminRequestId(body.requestId) || !hasOnlyKeys(body, ["requestId"])) {
    return adminFailure(requestId, 400, "INVALID_REQUEST", "Cần requestId hợp lệ cho thao tác phát hành hàng loạt.");
  }
  try {
    const { published, skipped } = await publishAllAdminSiteSettings(guard.database, {
      actorSubject: guard.actorSubject,
      requestId,
    });
    const paths = ["/", "/san-pham", "/thue-gia-cong", "/tin-tuc"];
    revalidatePublishedStorefront({
      tags: ["published-site-settings", "site-settings"],
      paths,
    });
    return withStorefrontPurgeHeader(adminSuccess(requestId, { published, skipped, count: published.length }), paths);
  } catch (error) {
    if (error instanceof SiteSettingIdempotencyConflictError) {
      return adminFailure(requestId, 409, "IDEMPOTENCY_CONFLICT", error.message);
    }
    return adminErrorFrom(requestId, error, "Không thể phát hành tất cả cài đặt website.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
