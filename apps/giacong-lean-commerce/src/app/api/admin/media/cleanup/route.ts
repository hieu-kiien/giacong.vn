import { getCloudflareContext } from "@opennextjs/cloudflare";
import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManageMedia } from "@/lib/admin-permissions.ts";
import { readBoundedAdminJson } from "@/lib/admin-request";
import { cleanupOrphanedMediaAssets, type R2BucketLike } from "@/lib/media-data";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageMedia(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được cleanup media.");
  }
  const parsedRequest = await readBoundedAdminJson(request);
  if (!parsedRequest.ok) return adminFailure(parsedRequest.requestId, parsedRequest.status, parsedRequest.code, parsedRequest.message);
  const bucket = getMediaBucket();
  if (!bucket) return adminFailure(parsedRequest.requestId, 503, "INTERNAL_ERROR", "R2 media chưa sẵn sàng.");
  let limit = 100;
  if (isRecord(parsedRequest.body) && typeof parsedRequest.body.limit === "number" && Number.isFinite(parsedRequest.body.limit)) {
    limit = parsedRequest.body.limit;
  }
  try {
    const result = await cleanupOrphanedMediaAssets(guard.database, bucket, limit);
    return adminSuccess(parsedRequest.requestId, result);
  } catch (error) {
    return adminErrorFrom(parsedRequest.requestId, error, "Không thể cleanup media.");
  }
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
