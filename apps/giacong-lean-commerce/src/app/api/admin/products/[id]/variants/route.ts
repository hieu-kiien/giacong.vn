import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import {
  getAdminProductVariant,
  listAdminProductVariants,
} from "@/lib/admin-data";
import { requireAdmin } from "@/lib/admin-guard";
import { parseAdminVariantPayload } from "@/lib/admin-variant-input";
import { createAdminVariantAtomically } from "@/lib/admin-variant-write";

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
    return adminFailure(crypto.randomUUID(), 503, "INTERNAL_ERROR", error instanceof Error ? error.message : "Không thể tải variants.");
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
  const parsed = parseAdminVariantPayload(await readJson(request));
  if (!parsed.input) {
    return adminFailure(crypto.randomUUID(), 422, "VALIDATION_ERROR", "Dữ liệu variant chưa hợp lệ.", parsed.fieldErrors);
  }

  try {
    const variantId = await createAdminVariantAtomically(
      guard.database,
      productId,
      parsed.input,
      guard.actorSubject,
    );
    const variant = await getAdminProductVariant(guard.database, productId, variantId);
    return variant
      ? adminSuccess(crypto.randomUUID(), { variant }, 201)
      : adminFailure(crypto.randomUUID(), 503, "INTERNAL_ERROR", "Không đọc lại được variant vừa tạo.");
  } catch (error) {
    const unique = isUniqueError(error);
    return adminFailure(
      crypto.randomUUID(),
      unique ? 409 : 503,
      unique ? "UNIQUE_CONFLICT" : "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Không thể tạo variant.",
      unique ? { sku: "SKU đã tồn tại." } : undefined,
    );
  }
}

function canManageCatalog(role: string): boolean {
  return role === "owner" || role === "content_manager";
}

function parsePositiveInt(value: string): number | null {
  const parsed = Number(value);
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
