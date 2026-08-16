import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { canManageSiteContent } from "@/lib/admin-permissions";
import {
  listAdminSiteSettings,
  SiteSettingConflictError,
  SiteSettingNotFoundError,
  SiteSettingValidationError,
  updateAdminSiteSetting,
} from "@/lib/site-settings";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  try {
    const settings = await listAdminSiteSettings(guard.database);
    return adminSuccess(crypto.randomUUID(), { settings, canEdit: canManageSiteContent(guard.member.role), role: guard.member.role });
  } catch (error) {
    return adminFailure(crypto.randomUUID(), 503, "INTERNAL_ERROR", error instanceof Error ? error.message : "Không thể tải cấu hình website.");
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageSiteContent(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại chỉ được xem nội dung website.");
  }
  const body = await readJson(request);
  if (!isRecord(body) || typeof body.key !== "string" || typeof body.expectedVersion !== "number" || !Number.isInteger(body.expectedVersion)) {
    return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", "Cần key, expectedVersion và value hợp lệ.");
  }
  try {
    const setting = await updateAdminSiteSetting(guard.database, {
      actorSubject: guard.actorSubject,
      expectedVersion: body.expectedVersion,
      key: body.key,
      value: body.value,
    });
    return adminSuccess(crypto.randomUUID(), { setting });
  } catch (error) {
    return settingFailure(error);
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

function settingFailure(error: unknown): Response {
  if (error instanceof SiteSettingConflictError) return adminFailure(crypto.randomUUID(), 409, "STALE_WRITE", error.message);
  if (error instanceof SiteSettingNotFoundError) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", error.message);
  if (error instanceof SiteSettingValidationError) return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", error.message);
  return adminFailure(crypto.randomUUID(), 503, "INTERNAL_ERROR", error instanceof Error ? error.message : "Không thể lưu cấu hình website.");
}