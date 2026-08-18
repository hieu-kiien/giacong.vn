import { getCloudflareContext } from "@opennextjs/cloudflare";
import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { getAdminNewsArticle } from "@/lib/admin-news-data.ts";
import { requireAdmin } from "@/lib/admin-guard";
import type { R2BucketLike } from "@/lib/media-data";
import { deleteNewsMediaAsset } from "@/lib/news-media-delete-core";

export const dynamic = "force-dynamic";

interface NewsMediaAssetRouteContext {
  params: Promise<{ assetId: string; id: string }>;
}

export async function DELETE(request: Request, context: NewsMediaAssetRouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageNews(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được xóa media bài viết.");
  }

  const parsed = await parseParams(context);
  if (!parsed) return mediaNotFound();
  const article = await getAdminNewsArticle(guard.database, parsed.articleId);
  if (!article || article.archivedAt) return mediaNotFound();

  const bucket = getMediaBucket();
  if (!bucket) return adminFailure(crypto.randomUUID(), 503, "INTERNAL_ERROR", "R2 media chưa sẵn sàng.");

  try {
    const result = await deleteNewsMediaAsset(guard.database, bucket, {
      articleId: parsed.articleId,
      assetId: parsed.assetId,
      deletedBy: guard.actorSubject,
    });
    if (result.kind === "not_found") return mediaNotFound();
    if (result.kind === "in_use") {
      return adminFailure(
        crypto.randomUUID(),
        409,
        "MEDIA_IN_USE",
        "Ảnh này đang được dùng làm ảnh đại diện. Hãy chọn hoặc lưu ảnh đại diện khác trước khi xóa.",
      );
    }
    return adminSuccess(
      crypto.randomUUID(),
      { media: result.media, storageDeleted: result.storageDeleted },
      result.storageDeleted ? 200 : 202,
    );
  } catch (error) {
    return adminFailure(
      crypto.randomUUID(),
      503,
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Không thể xóa media bài viết.",
    );
  }
}

function canManageNews(role: string): boolean {
  return role === "owner" || role === "content_manager";
}

async function parseParams(context: NewsMediaAssetRouteContext): Promise<{ articleId: number; assetId: string } | null> {
  const { assetId, id } = await context.params;
  const articleId = Number(id);
  const normalizedAssetId = assetId.trim();
  if (!Number.isInteger(articleId) || articleId < 1 || !/^[0-9a-f-]{20,64}$/i.test(normalizedAssetId)) return null;
  return { articleId, assetId: normalizedAssetId };
}

function mediaNotFound(): Response {
  return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy media bài viết đang hoạt động.");
}

function getMediaBucket(): R2BucketLike | null {
  try {
    const { env } = getCloudflareContext();
    return (env as unknown as { GIACONG_VN_PRODUCT_MEDIA?: R2BucketLike }).GIACONG_VN_PRODUCT_MEDIA ?? null;
  } catch {
    return null;
  }
}
