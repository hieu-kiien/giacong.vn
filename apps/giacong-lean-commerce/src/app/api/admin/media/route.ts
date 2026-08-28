import { getCloudflareContext } from "@opennextjs/cloudflare";
import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { getAdminProduct, getAdminProductVariant, getAdminService } from "@/lib/admin-data";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManageMedia } from "@/lib/admin-permissions.ts";
import { createMediaAsset, listMediaAssets, type R2BucketLike } from "@/lib/media-data";
import {
  adminMediaMaxBytes,
  adminMediaMaxRequestBytes,
  readBoundedAdminMultipart,
  validateAdminImageBytes,
} from "@/lib/media-input";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  const url = new URL(request.url);
  const productId = parsePositiveInt(url.searchParams.get("productId"));
  const serviceId = parsePositiveInt(url.searchParams.get("serviceId"));
  const variantId = parsePositiveInt(url.searchParams.get("variantId"));
  const listAll = url.searchParams.get("all") === "1";
  if (!listAll && ((!productId && !serviceId) || (productId && serviceId) || (variantId && !productId))) {
    return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", "Cần productId hoặc serviceId hợp lệ.");
  }
  try {
    const media = await listMediaAssets(guard.database, {
      all: listAll,
      productId: productId ?? undefined,
      serviceId: serviceId ?? undefined,
      variantId: variantId ?? undefined,
    });
    return adminSuccess(crypto.randomUUID(), { media });
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể tải media.");
  }
}

export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageMedia(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được upload media.");
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
  const productId = parsePositiveInt(form.get("productId"));
  const serviceId = parsePositiveInt(form.get("serviceId"));
  const variantId = parsePositiveInt(form.get("variantId"));
  const file = form.get("file");
  if ((!productId && !serviceId) || (productId && serviceId) || (variantId && !productId) || !(file instanceof File)) {
    return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", "Cần productId hoặc serviceId và file ảnh.");
  }
  if (file.size <= 0 || file.size > adminMediaMaxBytes) {
    return adminFailure(
      crypto.randomUUID(),
      422,
      "VALIDATION_ERROR",
      "Ảnh phải là JPEG, PNG hoặc WebP và không vượt quá 8 MiB.",
    );
  }

  if (productId) {
    const product = await getAdminProduct(guard.database, productId);
    if (!product) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy sản phẩm.");
  } else {
    const service = await getAdminService(guard.database, serviceId!);
    if (!service) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy dịch vụ.");
  }
  if (variantId && productId) {
    const variant = await getAdminProductVariant(guard.database, productId, variantId);
    if (!variant) return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", "Variant không thuộc sản phẩm này.");
  }
  const bucket = getMediaBucket();
  if (!bucket) return adminFailure(crypto.randomUUID(), 503, "INTERNAL_ERROR", "R2 media chưa sẵn sàng.");

  const bytes = await file.arrayBuffer();
  const imageError = validateAdminImageBytes(file.type, bytes);
  if (imageError) return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", imageError);
  const checksumSha256 = await digestSha256(bytes);
  try {
    const media = await createMediaAsset(guard.database, bucket, {
      altText: readAltText(form.get("altText")),
      bytes,
      checksumSha256,
      contentType: file.type,
      createdBy: guard.actorSubject,
      originalFilename: safeFilename(file.name),
      productId: productId ?? null,
      serviceId: serviceId ?? null,
      variantId: variantId ?? null,
    });
    return adminSuccess(crypto.randomUUID(), { media }, 201);
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể lưu media.");
  }
}

function parsePositiveInt(value: FormDataEntryValue | string | null): number | null {
  const parsed = Number(typeof value === "string" ? value : value instanceof File ? "" : value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function readAltText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim().slice(0, 300);
  return result || null;
}

function safeFilename(value: string): string {
  const result = value.normalize("NFKC").replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/-+/g, "-").slice(0, 180);
  return result || "media";
}

async function digestSha256(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getMediaBucket(): R2BucketLike | null {
  try {
    const { env } = getCloudflareContext();
    return (env as unknown as { GIACONG_VN_PRODUCT_MEDIA?: R2BucketLike }).GIACONG_VN_PRODUCT_MEDIA ?? null;
  } catch {
    return null;
  }
}
