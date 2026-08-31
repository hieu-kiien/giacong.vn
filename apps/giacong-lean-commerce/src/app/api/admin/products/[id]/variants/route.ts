import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import {
  AdminCatalogWriteConflictError,
  AdminCatalogWriteIdempotencyConflictError,
  AdminCatalogWriteValidationError,
  createAdminProductVariantAtomically,
} from "@/lib/admin-catalog-write.ts";
import {
  listAdminProductVariants,
} from "@/lib/admin-data";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManageCatalog } from "@/lib/admin-permissions.ts";
import { readBoundedAdminJson } from "@/lib/admin-request";
import { parseAdminProductVariantCreateCommand } from "@/lib/admin-variant-command";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  const productId = parsePositiveInt((await context.params).id);
  if (!productId) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy sản phẩm.");

  try {
    const variants = await listAdminProductVariants(guard.database, productId);
    return adminSuccess(crypto.randomUUID(), { variants });
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể tải variants.");
  }
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageCatalog(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được tạo variant.");
  }
  const productId = parsePositiveInt((await context.params).id);
  if (!productId) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy sản phẩm.");
  const parsedRequest = await readBoundedAdminJson(request);
  if (!parsedRequest.ok) return adminFailure(parsedRequest.requestId, parsedRequest.status, parsedRequest.code, parsedRequest.message);
  const parsed = parseAdminProductVariantCreateCommand(parsedRequest.body);
  const requestId = parsed.command?.requestId ?? parsedRequest.requestId;
  if (!parsed.command) {
    return adminFailure(requestId, 422, "VALIDATION_ERROR", "Dữ liệu variant chưa hợp lệ.", parsed.fieldErrors);
  }

  try {
    const variant = await createAdminProductVariantAtomically(guard.database, productId, parsed.command.input, guard.actorSubject, requestId);
    return variant
      ? adminSuccess(requestId, { variant }, 201)
      : adminFailure(requestId, 404, "NOT_FOUND", "Không tìm thấy sản phẩm.");
  } catch (error) {
    return mapCatalogWriteError(requestId, error, "Không thể tạo variant.", { fieldErrors: { sku: "SKU đã tồn tại." } });
  }
}

function parsePositiveInt(value: string): number | null {
  const parsed = Number(value);
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
