import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import {
  archiveAdminProductVariant,
  getAdminProductVariant,
  updateAdminProductVariant,
} from "@/lib/admin-data";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManageCatalog } from "@/lib/admin-permissions.ts";
import { readBoundedAdminJson } from "@/lib/admin-request";
import { parseAdminVariantPayload, variantDefaults } from "@/lib/admin-variant-input";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string; variantId: string }>;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
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
  const parsed = parseAdminVariantPayload(parsedRequest.body, variantDefaults(existing));
  if (!parsed.input) {
    return adminFailure(parsedRequest.requestId, 422, "VALIDATION_ERROR", "Dữ liệu variant chưa hợp lệ.", parsed.fieldErrors);
  }

  try {
    const variant = await updateAdminProductVariant(guard.database, ids.productId, ids.variantId, parsed.input, guard.actorSubject);
    return variant
      ? adminSuccess(parsedRequest.requestId, { variant })
      : adminFailure(parsedRequest.requestId, 404, "NOT_FOUND", "Không tìm thấy variant.");
  } catch (error) {
    const stale = error instanceof Error && /đã thay đổi|stale/i.test(error.message);
    if (stale) {
      return adminFailure(parsedRequest.requestId, 409, "STALE_WRITE", "Dữ liệu đã được người khác cập nhật. Hãy tải lại rồi thử lại.");
    }
    return adminErrorFrom(parsedRequest.requestId, error, "Không thể cập nhật variant.", { fieldErrors: { sku: "SKU đã tồn tại." } });
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
  try {
    const variant = await archiveAdminProductVariant(guard.database, ids.productId, ids.variantId, guard.actorSubject);
    return variant
      ? adminSuccess(crypto.randomUUID(), { variant })
      : adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy variant.");
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể ẩn variant.");
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
