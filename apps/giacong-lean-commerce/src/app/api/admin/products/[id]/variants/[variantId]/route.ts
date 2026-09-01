import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import {
  AdminCatalogWriteConflictError,
  AdminCatalogWriteIdempotencyConflictError,
  AdminCatalogWriteValidationError,
  archiveAdminProductVariantAtomically,
  updateAdminProductVariantAtomically,
} from "@/lib/admin-catalog-write.ts";
import {
  getAdminProductVariant,
} from "@/lib/admin-data";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManage, canManageCatalog } from "@/lib/admin-permissions.ts";
import { readBoundedAdminJson } from "@/lib/admin-request";
import {
  parseAdminProductVariantArchiveCommand,
  parseAdminProductVariantUpdateCommand,
} from "@/lib/admin-variant-command";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string; variantId: string }>;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManage(guard.member.role, "catalog.read")) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được xem sản phẩm.");
  }
  const ids = await parseIds(context);
  if (!ids) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy variant.");
  try {
    const variant = await getAdminProductVariant(guard.database, ids.productId, ids.variantId);
    return variant
      ? adminSuccess(crypto.randomUUID(), { variant })
      : adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy variant.");
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể tải variant.");
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageCatalog(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được cập nhật variant.");
  }
  const ids = await parseIds(context);
  if (!ids) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy variant.");
  const existing = await getAdminProductVariant(guard.database, ids.productId, ids.variantId);
  if (!existing) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy variant.");
  const parsedRequest = await readBoundedAdminJson(request);
  if (!parsedRequest.ok) return adminFailure(parsedRequest.requestId, parsedRequest.status, parsedRequest.code, parsedRequest.message);
  const parsed = parseAdminProductVariantUpdateCommand(parsedRequest.body);
  const requestId = parsed.command?.requestId ?? parsedRequest.requestId;
  if (!parsed.command) {
    return adminFailure(requestId, 422, "VALIDATION_ERROR", "Dữ liệu variant chưa hợp lệ.", parsed.fieldErrors);
  }

  try {
    const variant = await updateAdminProductVariantAtomically(
      guard.database,
      ids.productId,
      ids.variantId,
      parsed.command.input,
      parsed.command.revision,
      guard.actorSubject,
      requestId,
    );
    return variant
      ? adminSuccess(requestId, { variant })
      : adminFailure(requestId, 404, "NOT_FOUND", "Không tìm thấy variant.");
  } catch (error) {
    return mapCatalogWriteError(requestId, error, "Không thể cập nhật variant.", { fieldErrors: { sku: "SKU đã tồn tại." } });
  }
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageCatalog(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được ẩn variant.");
  }
  const ids = await parseIds(context);
  if (!ids) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy variant.");
  const parsedRequest = await readBoundedAdminJson(request);
  if (!parsedRequest.ok) return adminFailure(parsedRequest.requestId, parsedRequest.status, parsedRequest.code, parsedRequest.message);
  const parsed = parseAdminProductVariantArchiveCommand(parsedRequest.body);
  const requestId = parsed.command?.requestId ?? parsedRequest.requestId;
  if (!parsed.command) {
    return adminFailure(requestId, 422, "VALIDATION_ERROR", "Dữ liệu ẩn variant chưa hợp lệ.", parsed.fieldErrors);
  }
  try {
    const variant = await archiveAdminProductVariantAtomically(
      guard.database,
      ids.productId,
      ids.variantId,
      parsed.command.revision,
      guard.actorSubject,
      requestId,
    );
    return variant
      ? adminSuccess(requestId, { variant })
      : adminFailure(requestId, 404, "NOT_FOUND", "Không tìm thấy variant.");
  } catch (error) {
    return mapCatalogWriteError(requestId, error, "Không thể ẩn variant.", {});
  }
}

async function parseIds(context: RouteContext): Promise<{ productId: number; variantId: number } | null> {
  const params = await context.params;
  const productId = Number(params.id);
  const variantId = Number(params.variantId);
  return Number.isInteger(productId) && productId > 0 && Number.isInteger(variantId) && variantId > 0
    ? { productId, variantId }
    : null;
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
