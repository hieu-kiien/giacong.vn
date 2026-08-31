import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import {
  createAdminProductVariant,
  listAdminProductVariants,
} from "@/lib/admin-data";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManageCatalog } from "@/lib/admin-permissions.ts";
import { readBoundedAdminJson } from "@/lib/admin-request";
import { parseAdminVariantPayload } from "@/lib/admin-variant-input";

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
  const parsed = parseAdminVariantPayload(parsedRequest.body);
  if (!parsed.input) {
    return adminFailure(parsedRequest.requestId, 422, "VALIDATION_ERROR", "Dữ liệu variant chưa hợp lệ.", parsed.fieldErrors);
  }

  try {
    const variant = await createAdminProductVariant(guard.database, productId, parsed.input, guard.actorSubject);
    return adminSuccess(parsedRequest.requestId, { variant }, 201);
  } catch (error) {
    return adminErrorFrom(parsedRequest.requestId, error, "Không thể tạo variant.", { fieldErrors: { sku: "SKU đã tồn tại." } });
  }
}

function parsePositiveInt(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
