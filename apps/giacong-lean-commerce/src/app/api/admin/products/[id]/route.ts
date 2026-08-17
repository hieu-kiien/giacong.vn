import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import {
  getAdminProduct,
  validateAdminProductVariants,
} from "@/lib/admin-data";
import { requireAdmin } from "@/lib/admin-guard";
import { parseAdminProductPayload, productDefaults } from "@/lib/admin-product-input";
import { attachAdminProductRevision } from "@/lib/admin-product-revision";
import {
  AdminProductStaleWriteError,
  archiveAdminProductAtomically,
  updateAdminProductAtomically,
} from "@/lib/admin-product-write";

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
      ? adminSuccess(crypto.randomUUID(), { product: await attachAdminProductRevision(guard.database, product) })
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

  const payload = await readJson(request);
  if (!hasExplicitRevision(payload)) {
    return adminFailure(
      crypto.randomUUID(),
      422,
      "VALIDATION_ERROR",
      "Revision hiện tại là bắt buộc khi cập nhật sản phẩm.",
      { revision: "Hãy tải lại sản phẩm và gửi revision hiện tại." },
    );
  }
  const parsed = parseAdminProductPayload(payload, productDefaults(existing));
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
    await updateAdminProductAtomically(
      guard.database,
      id,
      parsed.input,
      payload.revision,
      guard.actorSubject,
    );
    const product = await getAdminProduct(guard.database, id);
    return product
      ? adminSuccess(crypto.randomUUID(), { product: await attachAdminProductRevision(guard.database, product) })
      : adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy sản phẩm.");
  } catch (error) {
    const stale = error instanceof AdminProductStaleWriteError;
    const unique = isUniqueError(error);
    return adminFailure(
      crypto.randomUUID(),
      stale ? 409 : unique ? 409 : 503,
      stale ? "STALE_WRITE" : unique ? "UNIQUE_CONFLICT" : "INTERNAL_ERROR",
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
  const existing = await getAdminProduct(guard.database, id);
  if (!existing) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy sản phẩm.");

  const payload = await readJson(request);
  if (!hasExplicitRevision(payload)) {
    return adminFailure(
      crypto.randomUUID(),
      422,
      "VALIDATION_ERROR",
      "Revision hiện tại là bắt buộc khi ẩn sản phẩm.",
      { revision: "Hãy tải lại sản phẩm và gửi revision hiện tại." },
    );
  }

  try {
    await archiveAdminProductAtomically(
      guard.database,
      id,
      payload.revision,
      guard.actorSubject,
    );
    const product = await getAdminProduct(guard.database, id);
    return product
      ? adminSuccess(crypto.randomUUID(), { product: await attachAdminProductRevision(guard.database, product) })
      : adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy sản phẩm.");
  } catch (error) {
    const stale = error instanceof AdminProductStaleWriteError;
    return adminFailure(
      crypto.randomUUID(),
      stale ? 409 : 503,
      stale ? "STALE_WRITE" : "INTERNAL_ERROR",
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

function hasExplicitRevision(value: unknown): value is Record<string, unknown> {
  return typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && Object.prototype.hasOwnProperty.call(value, "revision");
}

function isUniqueError(error: unknown): boolean {
  return error instanceof Error && /unique|constraint/i.test(error.message);
}
