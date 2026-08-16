import { getCloudflareContext } from "@opennextjs/cloudflare";
import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { cleanupOrphanedMediaAssets, type R2BucketLike } from "@/lib/media-data";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!["owner", "content_manager"].includes(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được cleanup media.");
  }
  const bucket = getMediaBucket();
  if (!bucket) return adminFailure(crypto.randomUUID(), 503, "INTERNAL_ERROR", "R2 media chưa sẵn sàng.");
  let limit = 100;
  try {
    const body = await request.json() as { limit?: unknown };
    if (typeof body.limit === "number" && Number.isFinite(body.limit)) limit = body.limit;
  } catch {
    // Empty body is valid and uses the safe default.
  }
  try {
    const result = await cleanupOrphanedMediaAssets(guard.database, bucket, limit);
    return adminSuccess(crypto.randomUUID(), result);
  } catch (error) {
    return adminFailure(crypto.randomUUID(), 503, "INTERNAL_ERROR", error instanceof Error ? error.message : "Không thể cleanup media.");
  }
}

function getMediaBucket(): R2BucketLike | null {
  try {
    const { env } = getCloudflareContext();
    return (env as unknown as { GIACONG_VN_PRODUCT_MEDIA?: R2BucketLike }).GIACONG_VN_PRODUCT_MEDIA ?? null;
  } catch {
    return null;
  }
}