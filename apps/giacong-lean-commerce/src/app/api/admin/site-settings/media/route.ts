import { getCloudflareContext } from "@opennextjs/cloudflare";
import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManageSiteContent } from "@/lib/admin-permissions.ts";
import {
  createSiteMediaAsset,
  deleteSiteMediaAsset,
  replaceActiveSiteMedia,
  type SiteMediaAsset,
} from "@/lib/site-media-data";
import {
  siteSettingDefinitions,
  SiteSettingConflictError,
  SiteSettingNotFoundError,
  SiteSettingValidationError,
  updateAdminSiteSetting,
} from "@/lib/site-settings";
import type { R2BucketLike } from "@/lib/media-data";
import {
  adminMediaMaxBytes,
  adminMediaMaxRequestBytes,
  readBoundedAdminMultipart,
  validateAdminImageBytes,
} from "@/lib/media-input";

export const dynamic = "force-dynamic";

const imageSettingKeys = new Set(["logo_url", "favicon_url", "hero_image_url"]);

export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageSiteContent(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được upload media thương hiệu.");
  }

  const boundedForm = await readBoundedAdminMultipart(request);
  if (!boundedForm.ok) {
    return adminFailure(
      crypto.randomUUID(),
      boundedForm.reason === "too_large" ? 413 : 422,
      boundedForm.reason === "too_large" ? "PAYLOAD_TOO_LARGE" : "VALIDATION_ERROR",
      boundedForm.reason === "too_large"
        ? `Request upload không được vượt quá ${adminMediaMaxRequestBytes / 1024} KiB.`
        : "Request upload không hợp lệ.",
    );
  }
  const form = boundedForm.form;

  const key = readString(form.get("key"));
  const expectedVersion = parsePositiveInt(form.get("expectedVersion"));
  const file = form.get("file");
  const definition = siteSettingDefinitions.find((item) => item.key === key);
  if (!definition || !imageSettingKeys.has(key) || definition.type !== "image") {
    return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", "Setting ảnh website không hợp lệ.");
  }
  if (!expectedVersion || !(file instanceof File)) {
    return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", "Cần file ảnh và expectedVersion.");
  }
  if (file.size <= 0 || file.size > adminMediaMaxBytes) {
    return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", "Ảnh phải là JPEG, PNG hoặc WebP và không vượt quá 8 MiB.");
  }

  const bucket = getMediaBucket();
  if (!bucket) return adminFailure(crypto.randomUUID(), 503, "INTERNAL_ERROR", "R2 media chưa sẵn sàng.");

  const bytes = await file.arrayBuffer();
  const imageError = validateAdminImageBytes(file.type, bytes);
  if (imageError) return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", imageError);
  const checksumSha256 = await digestSha256(bytes);
  let media: SiteMediaAsset | null = null;
  let settingUpdated = false;
  try {
    media = await createSiteMediaAsset(guard.database, bucket, {
      bytes,
      checksumSha256,
      contentType: file.type,
      createdBy: guard.actorSubject,
      originalFilename: safeFilename(file.name),
      settingKey: key,
    });
    const setting = await updateAdminSiteSetting(guard.database, {
      actorSubject: guard.actorSubject,
      expectedVersion,
      key,
      value: media.publicUrl,
    });
    settingUpdated = true;
    await replaceActiveSiteMedia(guard.database, key, media.id);
    return adminSuccess(crypto.randomUUID(), { media, setting }, 201);
  } catch (error) {
    if (media && !settingUpdated) await deleteSiteMediaAsset(guard.database, bucket, media.id).catch(() => undefined);
    return settingFailure(error);
  }
}

function settingFailure(error: unknown): Response {
  if (error instanceof SiteSettingConflictError) return adminFailure(crypto.randomUUID(), 409, "STALE_WRITE", error.message);
  if (error instanceof SiteSettingNotFoundError) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", error.message);
  if (error instanceof SiteSettingValidationError) return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", error.message);
  return adminErrorFrom(crypto.randomUUID(), error, "Không thể upload media website.");
}

function getMediaBucket(): R2BucketLike | null {
  try {
    const { env } = getCloudflareContext();
    return (env as unknown as { GIACONG_VN_PRODUCT_MEDIA?: R2BucketLike }).GIACONG_VN_PRODUCT_MEDIA ?? null;
  } catch {
    return null;
  }
}

function readString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function parsePositiveInt(value: FormDataEntryValue | null): number | null {
  const parsed = Number(readString(value));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function safeFilename(value: string): string {
  const result = value.normalize("NFKC").replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/-+/g, "-").slice(0, 180);
  return result || "site-media";
}

async function digestSha256(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
