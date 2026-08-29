import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import {
  AdminProductBatchConflictError,
  AdminProductBatchIdempotencyConflictError,
  AdminProductBatchValidationError,
  archiveAdminProductsAtomically,
  listAdminProductBatchSnapshots,
  parseAdminProductBatchItems,
} from "@/lib/admin-product-batch.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManageCatalog } from "@/lib/admin-permissions.ts";
import { hasOnlyKeys, isAdminRequestId, readBoundedAdminJson } from "@/lib/admin-request";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageCatalog(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được chuẩn bị thao tác hàng loạt sản phẩm.");
  }
  const requestId = crypto.randomUUID();
  const ids = parseProductIds(new URL(request.url).searchParams.get("ids"));
  if (!ids) return adminFailure(requestId, 400, "INVALID_REQUEST", "Cần danh sách ID sản phẩm hợp lệ.");
  try {
    const products = await listAdminProductBatchSnapshots(guard.database, ids);
    return adminSuccess(requestId, { products });
  } catch (error) {
    if (error instanceof AdminProductBatchValidationError) return adminFailure(requestId, 422, "VALIDATION_ERROR", error.message);
    return adminErrorFrom(requestId, error, "Không thể đọc phiên bản sản phẩm.");
  }
}

export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageCatalog(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được ẩn hàng loạt sản phẩm.");
  }
  const parsedRequest = await readBoundedAdminJson(request);
  if (!parsedRequest.ok) return adminFailure(parsedRequest.requestId, parsedRequest.status, parsedRequest.code, parsedRequest.message);
  const body = parsedRequest.body;
  const requestId = isRecord(body) && typeof body.requestId === "string" ? body.requestId.trim().toLowerCase() : parsedRequest.requestId;
  const items = isRecord(body) ? parseAdminProductBatchItems(body.items) : null;
  if (!isRecord(body) || !isAdminRequestId(body.requestId) || !items || !hasOnlyKeys(body, ["requestId", "items"])) {
    return adminFailure(requestId, 400, "INVALID_REQUEST", "Cần requestId và danh sách sản phẩm hợp lệ.");
  }
  try {
    const result = await archiveAdminProductsAtomically(guard.database, { actorSubject: guard.actorSubject, items, requestId });
    return adminSuccess(requestId, result);
  } catch (error) {
    if (error instanceof AdminProductBatchIdempotencyConflictError) return adminFailure(requestId, 409, "IDEMPOTENCY_CONFLICT", error.message);
    if (error instanceof AdminProductBatchValidationError) return adminFailure(requestId, 422, "VALIDATION_ERROR", error.message);
    if (error instanceof AdminProductBatchConflictError) return adminFailure(requestId, 409, "STALE_WRITE", error.message);
    return adminErrorFrom(requestId, error, "Không thể ẩn hàng loạt sản phẩm.");
  }
}

function parseProductIds(value: string | null): number[] | null {
  if (!value) return null;
  const parts = value.split(",").map((part) => part.trim());
  if (parts.length === 0 || parts.length > 100 || parts.some((part) => !/^\d+$/.test(part))) return null;
  const ids = parts.map(Number);
  return ids.every((id) => Number.isSafeInteger(id) && id > 0) && new Set(ids).size === ids.length ? ids.sort((a, b) => a - b) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
