import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { hasOnlyKeys, isAdminRequestId, readBoundedAdminJson } from "@/lib/admin-request";
import { canManageSiteContent } from "@/lib/admin-permissions";
import {
  listAdminSiteSettings,
  SiteSettingConflictError,
  SiteSettingIdempotencyConflictError,
  SiteSettingNotFoundError,
  SiteSettingValidationError,
  updateAdminSiteSetting,
} from "@/lib/site-settings";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  try {
    const settings = await listAdminSiteSettings(guard.database);
    return adminSuccess(crypto.randomUUID(), { settings, canEdit: canManageSiteContent(guard.member.role), role: guard.member.role });
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể tải cấu hình website.");
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageSiteContent(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại chỉ được xem nội dung website.");
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
    || !("value" in body)
    || !hasOnlyKeys(body, ["requestId", "key", "expectedVersion", "value"])
  ) {
    return adminFailure(requestId, 400, "INVALID_REQUEST", "Cần requestId, key, expectedVersion và value hợp lệ.");
  }
  try {
    const setting = await updateAdminSiteSetting(guard.database, {
      actorSubject: guard.actorSubject,
      expectedVersion: body.expectedVersion,
      key: body.key,
      requestId,
      value: body.value,
    });
    return adminSuccess(requestId, { setting });
  } catch (error) {
    return settingFailure(error, requestId);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function settingFailure(error: unknown, requestId: string): Response {
  if (error instanceof SiteSettingConflictError) return adminFailure(requestId, 409, "STALE_WRITE", error.message);
  if (error instanceof SiteSettingIdempotencyConflictError) return adminFailure(requestId, 409, "IDEMPOTENCY_CONFLICT", error.message);
  if (error instanceof SiteSettingNotFoundError) return adminFailure(requestId, 404, "NOT_FOUND", error.message);
  if (error instanceof SiteSettingValidationError) return adminFailure(requestId, 422, "VALIDATION_ERROR", error.message);
  return adminErrorFrom(requestId, error, "Không thể lưu cấu hình website.");
}
