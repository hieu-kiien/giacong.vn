import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import {
  archiveAdminProductVariant,
  getAdminProductVariant,
  updateAdminProductVariant,
} from "@/lib/admin-data";
import { requireAdmin } from "@/lib/admin-guard";
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
    return adminFailure(crypto.randomUUID(), 503, "INTERNAL_ERROR", error instanceof Error ? error.message : "Không thể tải variant.");
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
  const parsed = parseAdminVariantPayload(await readJson(request), variantDefaults(existing));
  if (!parsed.input) {
    return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", "Dữ liệu variant chưa hợp lệ.", parsed.fieldErrors);
  }

  try {
    const variant = await updateAdminProductVariant(guard.database, ids.productId, ids.variantId, parsed.input, guard.actorSubject);
    return variant
      ? adminSuccess(crypto.randomUUID(), { variant })
      : adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy variant.");
  } catch (error) {
    const stale = error instanceof Error && /đã thay đổi|stale/i.test(error.message);
    const unique = isUniqueError(error);
    return adminFailure(
      crypto.randomUUID(),
      stale ? 409 : unique ? 409 : 503,
      stale ? "STALE_WRITE" : unique ? "UNIQUE_CONFLICT" : "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Không thể cập nhật variant.",
      unique ? { sku: "SKU đã tồn tại." } : undefined,
    );
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
    return adminFailure(crypto.randomUUID(), 503, "INTERNAL_ERROR", error instanceof Error ? error.message : "Không thể ẩn variant.");
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

function canManageCatalog(role: string): boolean {
  return role === "owner" || role === "content_manager";
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