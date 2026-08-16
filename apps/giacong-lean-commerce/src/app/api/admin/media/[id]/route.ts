import { getCloudflareContext } from "@opennextjs/cloudflare";
import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { deleteMediaAsset, updateMediaAssetAltText, type R2BucketLike } from "@/lib/media-data";

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
    return adminFailure(crypto.randomUUID(), 503, "INTERNAL_ERROR", error instanceof Error ? error.message : "Không thể xóa media.");
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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", "Dữ liệu media không hợp lệ.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body) || !("altText" in body)) {
    return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", "Cần altText.");
  }
  const rawAltText = (body as { altText?: unknown }).altText;
  if (rawAltText !== null && typeof rawAltText !== "string") {
    return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", "altText phải là chuỗi hoặc null.");
  }
  const media = await updateMediaAssetAltText(
    guard.database,
    id,
    typeof rawAltText === "string" ? rawAltText.trim().slice(0, 300) || null : null,
  );
  return media
    ? adminSuccess(crypto.randomUUID(), { media })
    : adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy media đang hoạt động.");
}

function canManageMedia(role: string): boolean {
  return role === "owner" || role === "content_manager" || role === "catalog_manager";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getMediaBucket(): R2BucketLike | null {
  try {
    const { env } = getCloudflareContext();
    return (env as unknown as { GIACONG_VN_PRODUCT_MEDIA?: R2BucketLike }).GIACONG_VN_PRODUCT_MEDIA ?? null;
  } catch {
    return null;
  }
}