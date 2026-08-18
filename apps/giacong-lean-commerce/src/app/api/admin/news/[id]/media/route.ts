import { getCloudflareContext } from "@opennextjs/cloudflare";
import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { getAdminNewsArticle } from "@/lib/admin-news-data.ts";
import { requireAdmin } from "@/lib/admin-guard";
import type { R2BucketLike } from "@/lib/media-data";
import { createNewsMediaAsset, listNewsMediaAssets } from "@/lib/news-media-data";
import {
  assertMediaMultipartLength,
  MediaUploadValidationError,
  validateMediaBytes,
  validateMediaFileMetadata,
} from "@/lib/media-upload-policy";

export const dynamic = "force-dynamic";

interface NewsMediaRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: NewsMediaRouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  const articleId = await parseArticleId(context);
  if (articleId === null) return articleNotFound();

  try {
    const article = await getAdminNewsArticle(guard.database, articleId);
    if (!article || article.archivedAt) return articleNotFound();
    const media = await listNewsMediaAssets(guard.database, articleId);
    return adminSuccess(crypto.randomUUID(), { media });
  } catch (error) {
    return adminFailure(
      crypto.randomUUID(),
      503,
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Không thể tải media bài viết.",
    );
  }
}

export async function POST(request: Request, context: NewsMediaRouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageNews(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được upload media bài viết.");
  }

  const articleId = await parseArticleId(context);
  if (articleId === null) return articleNotFound();
  const article = await getAdminNewsArticle(guard.database, articleId);
  if (!article || article.archivedAt) return articleNotFound();

  try {
    assertMediaMultipartLength(request.headers.get("content-length"));
  } catch (error) {
    return mediaValidationFailure(error);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", "Request upload không hợp lệ.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", "Cần file ảnh để upload.");
  }

  let contentType: "image/jpeg" | "image/png" | "image/webp";
  try {
    contentType = validateMediaFileMetadata(file.type.toLowerCase(), file.size);
  } catch (error) {
    return mediaValidationFailure(error);
  }

  const bucket = getMediaBucket();
  if (!bucket) return adminFailure(crypto.randomUUID(), 503, "INTERNAL_ERROR", "R2 media chưa sẵn sàng.");

  const bytes = await file.arrayBuffer();
  try {
    validateMediaBytes(contentType, new Uint8Array(bytes), file.size);
  } catch (error) {
    return mediaValidationFailure(error);
  }
  const checksumSha256 = await digestSha256(bytes);

  try {
    const media = await createNewsMediaAsset(guard.database, bucket, {
      altText: readAltText(form.get("altText")),
      articleId,
      bytes,
      checksumSha256,
      contentType,
      createdBy: guard.actorSubject,
      originalFilename: safeFilename(file.name),
    });
    return adminSuccess(crypto.randomUUID(), { media }, 201);
  } catch (error) {
    return adminFailure(
      crypto.randomUUID(),
      503,
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Không thể lưu media bài viết.",
    );
  }
}

function canManageNews(role: string): boolean {
  return role === "owner" || role === "content_manager";
}

async function parseArticleId(context: NewsMediaRouteContext): Promise<number | null> {
  const { id } = await context.params;
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function articleNotFound(): Response {
  return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy bài viết đang hoạt động.");
}

function readAltText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim().slice(0, 300);
  return result || null;
}

function safeFilename(value: string): string {
  const result = value.normalize("NFKC").replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/-+/g, "-").slice(0, 180);
  return result || "news-media";
}

async function digestSha256(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function mediaValidationFailure(error: unknown): Response {
  if (!(error instanceof MediaUploadValidationError)) {
    return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", "File ảnh không hợp lệ.");
  }
  return adminFailure(
    crypto.randomUUID(),
    error.kind === "TOO_LARGE" ? 413 : 422,
    error.kind === "TOO_LARGE" ? "PAYLOAD_TOO_LARGE" : "VALIDATION_ERROR",
    error.message,
  );
}

function getMediaBucket(): R2BucketLike | null {
  try {
    const { env } = getCloudflareContext();
    return (env as unknown as { GIACONG_VN_PRODUCT_MEDIA?: R2BucketLike }).GIACONG_VN_PRODUCT_MEDIA ?? null;
  } catch {
    return null;
  }
}
