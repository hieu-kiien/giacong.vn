import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import {
  archiveAdminProduct,
  getAdminProduct,
  updateAdminProduct,
  validateAdminProductVariants,
} from "@/lib/admin-data";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManageCatalog } from "@/lib/admin-permissions.ts";
import { readBoundedAdminJson } from "@/lib/admin-request";
import { parseAdminProductPayload, productDefaults } from "@/lib/admin-product-input";

export const dynamic = "force-dynamic";

interface ProductRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: Request,
  context: ProductRouteContext,
): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  const id = await parseId(context);
  if (id === null) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy sản phẩm.");

  try {
    const product = await getAdminProduct(guard.database, id);
    return product
      ? adminSuccess(crypto.randomUUID(), { product })
      : adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy sản phẩm.");
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể tải sản phẩm.");
  }
}

export async function PATCH(
  request: Request,
  context: ProductRouteContext,
): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageCatalog(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được sửa sản phẩm.");
  }

  const id = await parseId(context);
  if (id === null) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy sản phẩm.");
  const existing = await getAdminProduct(guard.database, id);
  if (!existing) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy sản phẩm.");

  const parsedRequest = await readBoundedAdminJson(request);
  if (!parsedRequest.ok) return adminFailure(parsedRequest.requestId, parsedRequest.status, parsedRequest.code, parsedRequest.message);
  const parsed = parseAdminProductPayload(parsedRequest.body, productDefaults(existing));
  if (!parsed.input) {
    return adminFailure(parsedRequest.requestId, 422, "VALIDATION_ERROR", "Dữ liệu sản phẩm chưa hợp lệ.", parsed.fieldErrors);
  }

  try {
    if (parsed.input.status === "published") {
      const variantValidation = await validateAdminProductVariants(guard.database, id);
      if (!variantValidation.valid) {
        return adminFailure(
          parsedRequest.requestId,
          422,
          "VALIDATION_ERROR",
          "Không thể publish sản phẩm vì variants chưa hợp lệ.",
          {
            status: `Cần ít nhất một variant hợp lệ; hiện có ${variantValidation.totalVariants} variant, ${variantValidation.invalidVariants} variant lỗi.`,
          },
        );
      }
    }
    const product = await updateAdminProduct(guard.database, id, parsed.input, guard.actorSubject);
    return product
      ? adminSuccess(parsedRequest.requestId, { product })
      : adminFailure(parsedRequest.requestId, 404, "NOT_FOUND", "Không tìm thấy sản phẩm.");
  } catch (error) {
    return adminErrorFrom(parsedRequest.requestId, error, "Không thể cập nhật sản phẩm.", { fieldErrors: { slug: "Slug hoặc SKU đã tồn tại." } });
  }
}

export async function DELETE(
  request: Request,
  context: ProductRouteContext,
): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageCatalog(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được ẩn sản phẩm.");
  }

  const id = await parseId(context);
  if (id === null) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy sản phẩm.");

  try {
    const product = await archiveAdminProduct(guard.database, id, guard.actorSubject);
    return product
      ? adminSuccess(crypto.randomUUID(), { product })
      : adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy sản phẩm.");
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể ẩn sản phẩm.");
  }
}

async function parseId(context: ProductRouteContext): Promise<number | null> {
  const { id } = await context.params;
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
