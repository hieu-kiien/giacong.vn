import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import {
  AdminCatalogWriteConflictError,
  AdminCatalogWriteIdempotencyConflictError,
  AdminCatalogWriteValidationError,
  archiveAdminProductAtomically,
  updateAdminProductAtomically,
} from "@/lib/admin-catalog-write.ts";
import {
  getAdminProduct,
  validateAdminProductVariants,
} from "@/lib/admin-data";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManageCatalog } from "@/lib/admin-permissions.ts";
import { readBoundedAdminJson } from "@/lib/admin-request";
import {
  parseAdminProductArchiveCommand,
  parseAdminProductUpdateCommand,
} from "@/lib/admin-product-command";

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
  const parsed = parseAdminProductUpdateCommand(parsedRequest.body);
  const requestId = parsed.command?.requestId ?? parsedRequest.requestId;
  if (!parsed.command) {
    return adminFailure(requestId, 422, "VALIDATION_ERROR", "Dữ liệu sản phẩm chưa hợp lệ.", parsed.fieldErrors);
  }

  try {
    if (parsed.command.input.status === "published") {
      const variantValidation = await validateAdminProductVariants(guard.database, id);
      if (!variantValidation.valid) {
        return adminFailure(
          requestId,
          422,
          "VALIDATION_ERROR",
          "Không thể publish sản phẩm vì variants chưa hợp lệ.",
          {
            status: `Cần ít nhất một variant hợp lệ; hiện có ${variantValidation.totalVariants} variant, ${variantValidation.invalidVariants} variant lỗi.`,
          },
        );
      }
    }
    const product = await updateAdminProductAtomically(
      guard.database,
      id,
      parsed.command.input,
      parsed.command.revision,
      guard.actorSubject,
      requestId,
    );
    return product
      ? adminSuccess(requestId, { product })
      : adminFailure(requestId, 404, "NOT_FOUND", "Không tìm thấy sản phẩm.");
  } catch (error) {
    return mapCatalogWriteError(requestId, error, "Không thể cập nhật sản phẩm.", { fieldErrors: { slug: "Slug hoặc SKU đã tồn tại." } });
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

  const parsedRequest = await readBoundedAdminJson(request);
  if (!parsedRequest.ok) return adminFailure(parsedRequest.requestId, parsedRequest.status, parsedRequest.code, parsedRequest.message);
  const parsed = parseAdminProductArchiveCommand(parsedRequest.body);
  const requestId = parsed.command?.requestId ?? parsedRequest.requestId;
  if (!parsed.command) {
    return adminFailure(requestId, 422, "VALIDATION_ERROR", "Dữ liệu ẩn sản phẩm chưa hợp lệ.", parsed.fieldErrors);
  }

  try {
    const product = await archiveAdminProductAtomically(
      guard.database,
      id,
      parsed.command.revision,
      guard.actorSubject,
      requestId,
    );
    return product
      ? adminSuccess(requestId, { product })
      : adminFailure(requestId, 404, "NOT_FOUND", "Không tìm thấy sản phẩm.");
  } catch (error) {
    return mapCatalogWriteError(requestId, error, "Không thể ẩn sản phẩm.", {});
  }
}

async function parseId(context: ProductRouteContext): Promise<number | null> {
  const { id } = await context.params;
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function mapCatalogWriteError(
  requestId: string,
  error: unknown,
  fallbackMessage: string,
  conflict: { fieldErrors?: Record<string, string>; message?: string },
): Response {
  if (error instanceof AdminCatalogWriteConflictError) {
    return adminFailure(requestId, 409, "STALE_WRITE", error.message);
  }
  if (error instanceof AdminCatalogWriteIdempotencyConflictError) {
    return adminFailure(requestId, 409, "IDEMPOTENCY_CONFLICT", error.message);
  }
  if (error instanceof AdminCatalogWriteValidationError) {
    return adminFailure(requestId, 422, "VALIDATION_ERROR", error.message);
  }
  return adminErrorFrom(requestId, error, fallbackMessage, conflict);
}
