import { getCloudflareContext } from "@opennextjs/cloudflare";
import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { getAdminProduct, getAdminProductVariant, getAdminService } from "@/lib/admin-data";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManage, canManageMedia } from "@/lib/admin-permissions.ts";
import {
  createMediaAsset,
  listMediaAssets,
  MediaWriteIdempotencyConflictError,
  MediaWriteValidationError,
  type R2BucketLike,
} from "@/lib/media-data";
import {
  adminMediaMaxBytes,
  adminMediaMaxRequestBytes,
  readBoundedAdminMultipart,
  validateAdminImageBytes,
} from "@/lib/media-input";
import { isAdminRequestId } from "@/lib/admin-request";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManage(guard.member.role, "media.read")) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được xem media.");
  }
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
  const parserRequestId = crypto.randomUUID();
  const boundedForm = await readBoundedAdminMultipart(request);
  if (!boundedForm.ok) {
    return adminFailure(
      parserRequestId,
      boundedForm.reason === "too_large" ? 413 : 422,
      boundedForm.reason === "too_large" ? "PAYLOAD_TOO_LARGE" : "VALIDATION_ERROR",
      boundedForm.reason === "too_large"
        ? `Request upload không được vượt quá ${adminMediaMaxRequestBytes / 1024} KiB.`
        : "Request upload không hợp lệ.",
    );
  }
  const form = boundedForm.form;
  const requestIdValue = form.get("requestId");
  const requestId = typeof requestIdValue === "string" && isAdminRequestId(requestIdValue)
    ? requestIdValue.trim().toLowerCase()
    : "";
  if (!requestId) return adminFailure(parserRequestId, 422, "VALIDATION_ERROR", "Upload media cần requestId là UUID hợp lệ.");
  const productId = parsePositiveInt(form.get("productId"));
  const serviceId = parsePositiveInt(form.get("serviceId"));
  const variantId = parsePositiveInt(form.get("variantId"));
  const file = form.get("file");
  const rawAltText = form.get("altText");
  if ((!productId && !serviceId) || (productId && serviceId) || (variantId && !productId) || !(file instanceof File)) {
    return adminFailure(requestId, 422, "VALIDATION_ERROR", "Cần productId hoặc serviceId và file ảnh.");
  }
  if (typeof rawAltText === "string" && rawAltText.trim().length > 300) {
    return adminFailure(requestId, 422, "VALIDATION_ERROR", "altText không được vượt quá 300 ký tự.", {
      altText: "Tối đa 300 ký tự.",
    });
  }
  if (file.size <= 0 || file.size > adminMediaMaxBytes) {
    return adminFailure(
      requestId,
      422,
      "VALIDATION_ERROR",
      "Ảnh phải là JPEG, PNG hoặc WebP và không vượt quá 8 MiB.",
    );
  }

  if (productId) {
    const product = await getAdminProduct(guard.database, productId);
    if (!product) return adminFailure(requestId, 404, "NOT_FOUND", "Không tìm thấy sản phẩm.");
  } else {
    const service = await getAdminService(guard.database, serviceId!);
    if (!service) return adminFailure(requestId, 404, "NOT_FOUND", "Không tìm thấy dịch vụ.");
  }
  if (variantId && productId) {
    const variant = await getAdminProductVariant(guard.database, productId, variantId);
    if (!variant) return adminFailure(requestId, 422, "VALIDATION_ERROR", "Variant không thuộc sản phẩm này.");
  }
  const bucket = getMediaBucket();
  if (!bucket) return adminFailure(requestId, 503, "INTERNAL_ERROR", "R2 media chưa sẵn sàng.");

  const bytes = await file.arrayBuffer();
  const imageError = validateAdminImageBytes(file.type, bytes);
  if (imageError) return adminFailure(requestId, 422, "VALIDATION_ERROR", imageError);
  const checksumSha256 = await digestSha256(bytes);
  try {
    const media = await createMediaAsset(guard.database, bucket, {
      altText: readAltText(rawAltText),
      bytes,
      checksumSha256,
      contentType: file.type,
      createdBy: guard.actorSubject,
      originalFilename: safeFilename(file.name),
      productId: productId ?? null,
      requestId,
      serviceId: serviceId ?? null,
      variantId: variantId ?? null,
    });
    return adminSuccess(requestId, { media }, 201);
  } catch (error) {
    if (error instanceof MediaWriteValidationError) return adminFailure(requestId, 422, "VALIDATION_ERROR", error.message);
    if (error instanceof MediaWriteIdempotencyConflictError) return adminFailure(requestId, 409, "IDEMPOTENCY_CONFLICT", error.message);
    return adminErrorFrom(requestId, error, "Không thể lưu media.");
  }
}

function parsePositiveInt(value: FormDataEntryValue | string | null): number | null {
  const parsed = Number(typeof value === "string" ? value : value instanceof File ? "" : value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function readAltText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
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
