import { getCloudflareContext } from "@opennextjs/cloudflare";
import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManageMedia } from "@/lib/admin-permissions.ts";
import { hasOnlyKeys, readBoundedAdminJson } from "@/lib/admin-request";
import { deleteMediaAsset, MediaReferenceError, updateMediaAssetAltText, type R2BucketLike } from "@/lib/media-data";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageMedia(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được xóa media.");
  }
  const id = (await context.params).id;
  if (!isUuid(id)) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy media.");
  const bucket = getMediaBucket();
  if (!bucket) return adminFailure(crypto.randomUUID(), 503, "INTERNAL_ERROR", "R2 media chưa sẵn sàng.");
  try {
    const media = await deleteMediaAsset(guard.database, bucket, id);
    return media
      ? adminSuccess(crypto.randomUUID(), { media })
      : adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy media.");
  } catch (error) {
    if (error instanceof MediaReferenceError) {
      return adminFailure(
        crypto.randomUUID(),
        409,
        "MEDIA_IN_USE",
        `Ảnh này đang là ảnh chính của: ${error.message}. Hãy chọn ảnh chính khác trước khi xóa.`,
      );
    }
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể xóa media.");
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageMedia(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được sửa media.");
  }
  const id = (await context.params).id;
  if (!isUuid(id)) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy media.");
  const parsedRequest = await readBoundedAdminJson(request);
  if (!parsedRequest.ok) return adminFailure(parsedRequest.requestId, parsedRequest.status, parsedRequest.code, parsedRequest.message);
  const body = parsedRequest.body;
  if (!isRecord(body) || !("altText" in body) || !hasOnlyKeys(body, ["altText"])) {
    return adminFailure(parsedRequest.requestId, 400, "INVALID_REQUEST", "Body media phải chứa đúng trường altText.");
  }
  const rawAltText = body.altText;
  if (rawAltText !== null && typeof rawAltText !== "string") {
    return adminFailure(parsedRequest.requestId, 422, "VALIDATION_ERROR", "altText phải là chuỗi hoặc null.");
  }
  if (typeof rawAltText === "string" && rawAltText.trim().length > 300) {
    return adminFailure(parsedRequest.requestId, 422, "VALIDATION_ERROR", "altText không được vượt quá 300 ký tự.", {
      altText: "Tối đa 300 ký tự.",
    });
  }
  const media = await updateMediaAssetAltText(
    guard.database,
    id,
    typeof rawAltText === "string" ? rawAltText.trim() || null : null,
  );
  return media
    ? adminSuccess(parsedRequest.requestId, { media })
    : adminFailure(parsedRequest.requestId, 404, "NOT_FOUND", "Không tìm thấy media đang hoạt động.");
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getMediaBucket(): R2BucketLike | null {
  try {
    const { env } = getCloudflareContext();
    return (env as unknown as { GIACONG_VN_PRODUCT_MEDIA?: R2BucketLike }).GIACONG_VN_PRODUCT_MEDIA ?? null;
  } catch {
    return null;
  }
}
