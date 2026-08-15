import { admitRuntimeAdminRequest } from "@/lib/admin-access-runtime";
import { adminFailure, adminSuccess } from "@/lib/admin-api";
import { AdminVariantNotFoundError, listProductVariants } from "@/lib/admin-variant-repository";

export const dynamic = "force-dynamic";

/**
 * Collection read boundary for admin tooling. Variant mutation remains scoped to
 * /api/admin/products/[productId]/variants so a product context is always explicit.
 */
export async function GET(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const admission = await admitRuntimeAdminRequest(request);
  if (!admission.ok) return adminFailure(requestId, admission.status, admission.code, admission.message);

  const productIdRaw = new URL(request.url).searchParams.get("productId");
  const productId = productIdRaw === null ? NaN : Number(productIdRaw);
  if (!Number.isSafeInteger(productId) || productId < 1) {
    return adminFailure(requestId, 400, "INVALID_PRODUCT_ID", "productId phải là số nguyên dương.");
  }

  try {
    const variants = await listProductVariants(productId);
    return adminSuccess(requestId, { productId, variants });
  } catch (error) {
    if (error instanceof AdminVariantNotFoundError) {
      return adminFailure(requestId, 404, "NOT_FOUND", "Không tìm thấy sản phẩm.");
    }
    return adminFailure(requestId, 500, "INTERNAL_ERROR", "Không thể đọc danh sách biến thể.");
  }
}

export async function POST(): Promise<Response> {
  const requestId = crypto.randomUUID();
  return adminFailure(
    requestId,
    405,
    "METHOD_NOT_ALLOWED",
    "Tạo biến thể phải sử dụng endpoint theo product context.",
  );
}
