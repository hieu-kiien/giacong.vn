import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { getAdminProductVariant } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/admin-guard";
import { parseAdminVariantPayload, variantDefaults } from "@/lib/admin-variant-input";
import {
  AdminVariantStaleWriteError,
  archiveAdminVariantAtomically,
  updateAdminVariantAtomically,
} from "@/lib/admin-variant-write";

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

  const payload = await readJson(request);
  if (!hasExplicitRevision(payload)) {
    return adminFailure(
      crypto.randomUUID(),
      422,
      "VALIDATION_ERROR",
      "Revision hiện tại là bắt buộc khi cập nhật variant.",
      { revision: "Hãy tải lại variant và gửi revision hiện tại." },
    );
  }
  const parsed = parseAdminVariantPayload(payload, variantDefaults(existing));
  if (!parsed.input) {
    return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", "Dữ liệu variant chưa hợp lệ.", parsed.fieldErrors);
  }

  try {
    await updateAdminVariantAtomically(
      guard.database,
      ids.productId,
      ids.variantId,
      parsed.input,
      guard.actorSubject,
    );
    const variant = await getAdminProductVariant(guard.database, ids.productId, ids.variantId);
    return variant
      ? adminSuccess(crypto.randomUUID(), { variant })
      : adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy variant.");
  } catch (error) {
    const stale = error instanceof AdminVariantStaleWriteError;
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
  const existing = await getAdminProductVariant(guard.database, ids.productId, ids.variantId);
  if (!existing) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy variant.");

  const payload = await readJson(request);
  if (!hasExplicitRevision(payload)) {
    return adminFailure(
      crypto.randomUUID(),
      422,
      "VALIDATION_ERROR",
      "Revision hiện tại là bắt buộc khi ẩn variant.",
      { revision: "Hãy tải lại variant và gửi revision hiện tại." },
    );
  }

  try {
    await archiveAdminVariantAtomically(
      guard.database,
      ids.productId,
      ids.variantId,
      payload.revision,
      guard.actorSubject,
    );
    const variant = await getAdminProductVariant(guard.database, ids.productId, ids.variantId);
    return variant
      ? adminSuccess(crypto.randomUUID(), { variant })
      : adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy variant.");
  } catch (error) {
    const stale = error instanceof AdminVariantStaleWriteError;
    return adminFailure(
      crypto.randomUUID(),
      stale ? 409 : 503,
      stale ? "STALE_WRITE" : "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Không thể ẩn variant.",
    );
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

function hasExplicitRevision(value: unknown): value is Record<string, unknown> {
  return typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && Object.prototype.hasOwnProperty.call(value, "revision");
}

function isUniqueError(error: unknown): boolean {
  return error instanceof Error && /unique|constraint/i.test(error.message);
}
