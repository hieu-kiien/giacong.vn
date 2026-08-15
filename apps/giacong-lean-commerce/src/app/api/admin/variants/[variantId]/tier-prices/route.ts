import { admitRuntimeAdminRequest } from "@/lib/admin-access-runtime";
import { adminFailure, adminSuccess } from "@/lib/admin-api";
import {
  AdminVariantConflictError,
  AdminVariantIdempotencyConflictError,
  AdminVariantNotFoundError,
  AdminVariantPayloadTooLargeError,
  AdminVariantValidationError,
  replaceTierPrices,
} from "@/lib/admin-variant-repository";

export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 64 * 1024;
type Context = { params: Promise<{ variantId: string }> };

export async function PUT(request: Request, context: Context): Promise<Response> {
  const requestId = request.headers.get("x-request-id")?.trim() || crypto.randomUUID();
  const admission = await admitRuntimeAdminRequest(request);
  if (!admission.ok) return adminFailure(requestId, admission.status, admission.code, admission.message);
  if (!isJson(request.headers.get("content-type"))) return adminFailure(requestId, 415, "UNSUPPORTED_MEDIA", "Content-Type không được hỗ trợ.");

  const variantId = parseId((await context.params).variantId);
  if (variantId === null) return adminFailure(requestId, 404, "NOT_FOUND", "Không tìm thấy biến thể.");

  try {
    const result = await replaceTierPrices(variantId, await readJson(request), admission.actor.subject, requestId);
    return adminSuccess(requestId, result);
  } catch (error) {
    if (error instanceof AdminVariantNotFoundError) return adminFailure(requestId, 404, "NOT_FOUND", "Không tìm thấy biến thể.");
    if (error instanceof AdminVariantIdempotencyConflictError) return adminFailure(requestId, 409, "IDEMPOTENCY_CONFLICT", "Request ID đã được sử dụng cho payload khác.");
    if (error instanceof AdminVariantConflictError) return adminFailure(requestId, 409, "STALE_WRITE", "Biến thể đã được thay đổi hoặc có xung đột.");
    if (error instanceof AdminVariantPayloadTooLargeError) return adminFailure(requestId, 413, "PAYLOAD_TOO_LARGE", "Payload bảng giá vượt giới hạn.");
    if (error instanceof AdminVariantValidationError || error instanceof Error && /invalid|required|integer|tier|quantity|price|payload/i.test(error.message)) {
      return adminFailure(requestId, 422, "VALIDATION_ERROR", "Bảng giá bậc không hợp lệ.");
    }
    return adminFailure(requestId, 500, "INTERNAL_ERROR", "Không thể hoàn tất thao tác quản trị.");
  }
}

async function readJson(request: Request): Promise<unknown> {
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) throw new AdminVariantPayloadTooLargeError("Payload too large.");
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_BODY_BYTES) throw new AdminVariantPayloadTooLargeError("Payload too large.");
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new AdminVariantValidationError("Malformed JSON request."); }
}

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function isJson(value: string | null): boolean {
  return Boolean(value && value.toLowerCase().split(";", 1)[0].trim() === "application/json");
}
