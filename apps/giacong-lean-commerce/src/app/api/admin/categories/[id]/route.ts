import { admitRuntimeAdminRequest } from "@/lib/admin-access-runtime";
import { adminFailure, adminSuccess } from "@/lib/admin-api";
import {
  AdminCategoryConflictError,
  AdminCategoryIdempotencyConflictError,
  AdminCategoryNotFoundError,
  AdminCategoryValidationError,
  getCategory,
  updateCategory,
} from "@/lib/admin-category-repository";

export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 64 * 1024;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const requestId = crypto.randomUUID();
  const admission = await admitRuntimeAdminRequest(request);
  if (!admission.ok) return adminFailure(requestId, admission.status, admission.code, admission.message);
  const id = parseId((await context.params).id);
  if (!id) return adminFailure(requestId, 404, "NOT_FOUND", "Không tìm thấy danh mục.");
  const category = await getCategory(id);
  return category
    ? adminSuccess(requestId, category)
    : adminFailure(requestId, 404, "NOT_FOUND", "Không tìm thấy danh mục.");
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  const requestId = request.headers.get("x-request-id")?.trim() || crypto.randomUUID();
  const admission = await admitRuntimeAdminRequest(request);
  if (!admission.ok) return adminFailure(requestId, admission.status, admission.code, admission.message);
  const id = parseId((await context.params).id);
  if (!id) return adminFailure(requestId, 404, "NOT_FOUND", "Không tìm thấy danh mục.");
  if (!isJson(request.headers.get("content-type"))) return adminFailure(requestId, 415, "UNSUPPORTED_MEDIA", "Content-Type không được hỗ trợ.");

  try {
    const body = await readJson(request);
    const category = await updateCategory(id, body, admission.actor.subject, requestId);
    return adminSuccess(requestId, category);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) return adminFailure(requestId, 413, "PAYLOAD_TOO_LARGE", "Request quá lớn.");
    if (error instanceof AdminCategoryIdempotencyConflictError) return adminFailure(requestId, 409, "IDEMPOTENCY_CONFLICT", "Request ID đã được sử dụng cho payload khác.");
    if (error instanceof AdminCategoryConflictError) return adminFailure(requestId, 409, "STALE_WRITE", "Danh mục đã được thay đổi. Hãy tải lại rồi thử lại.");
    if (error instanceof AdminCategoryNotFoundError) return adminFailure(requestId, 404, "NOT_FOUND", "Không tìm thấy danh mục.");
    if (error instanceof AdminCategoryValidationError || error instanceof Error && /required|invalid|must be|exceeds|slug|version/i.test(error.message)) {
      return adminFailure(requestId, 422, "VALIDATION_ERROR", "Dữ liệu danh mục không hợp lệ.");
    }
    return adminFailure(requestId, 500, "INTERNAL_ERROR", "Không thể hoàn tất thao tác quản trị.");
  }
}

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function isJson(value: string | null): boolean {
  return Boolean(value && value.toLowerCase().split(";", 1)[0].trim() === "application/json");
}

async function readJson(request: Request): Promise<unknown> {
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) throw new PayloadTooLargeError();
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_BODY_BYTES) throw new PayloadTooLargeError();
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new AdminCategoryValidationError("Malformed JSON request."); }
}

class PayloadTooLargeError extends Error {}
