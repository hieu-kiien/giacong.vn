import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import {
  archiveAdminProduct,
  getAdminProduct,
  updateAdminProduct,
  validateAdminProductVariants,
} from "@/lib/admin-data";
import { requireAdmin } from "@/lib/admin-guard";
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
    return adminFailure(
      crypto.randomUUID(),
      503,
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Không thể tải sản phẩm.",
    );
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

  const parsed = parseAdminProductPayload(await readJson(request), productDefaults(existing));
  if (!parsed.input) {
    return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", "Dữ liệu sản phẩm chưa hợp lệ.", parsed.fieldErrors);
  }

  try {
    if (parsed.input.status === "published") {
      const variantValidation = await validateAdminProductVariants(guard.database, id);
      if (!variantValidation.valid) {
        return adminFailure(
          crypto.randomUUID(),
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
      ? adminSuccess(crypto.randomUUID(), { product })
      : adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy sản phẩm.");
  } catch (error) {
    const unique = isUniqueError(error);
    return adminFailure(
      crypto.randomUUID(),
      unique ? 409 : 503,
      unique ? "UNIQUE_CONFLICT" : "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Không thể cập nhật sản phẩm.",
      unique ? { slug: "Slug hoặc SKU đã tồn tại." } : undefined,
    );
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
    return adminFailure(
      crypto.randomUUID(),
      503,
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Không thể ẩn sản phẩm.",
    );
  }
}

function canManageCatalog(role: string): boolean {
  return role === "owner" || role === "catalog_manager" || role === "content_manager";
}

async function parseId(context: ProductRouteContext): Promise<number | null> {
  const { id } = await context.params;
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function isUniqueError(error: unknown): boolean {
  return error instanceof Error && /unique|constraint/i.test(error.message);
}