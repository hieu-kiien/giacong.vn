import { admitRuntimeAdminRequest } from "@/lib/admin-access-runtime";
import { adminFailure, adminSuccess } from "@/lib/admin-api";
import { AdminMediaIdempotencyConflictError, AdminMediaPayloadTooLargeError, AdminMediaValidationError, assertMultipartSize, listProductMedia, uploadProductMedia } from "@/lib/admin-media";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const admission = await admitRuntimeAdminRequest(request);
  if (!admission.ok) return adminFailure(requestId, admission.status, admission.code, admission.message);
  const cursor = new URL(request.url).searchParams.get("cursor") ?? undefined;
  try { return adminSuccess(requestId, await listProductMedia(cursor)); }
  catch { return adminFailure(requestId, 500, "INTERNAL_ERROR", "Không thể tải danh sách media."); }
}

export async function POST(request: Request): Promise<Response> {
  const requestId = request.headers.get("x-request-id")?.trim() || crypto.randomUUID();
  const admission = await admitRuntimeAdminRequest(request);
  if (!admission.ok) return adminFailure(requestId, admission.status, admission.code, admission.message);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) return adminFailure(requestId, 415, "UNSUPPORTED_MEDIA", "Content-Type không được hỗ trợ.");
  try {
    const contentLength = Number(request.headers.get("content-length"));
    assertMultipartSize(contentLength);
    const form = await request.formData();
    const value = form.get("file");
    if (!(value instanceof File)) throw new AdminMediaValidationError("Thiếu file media.");
    return adminSuccess(requestId, await uploadProductMedia(value, admission.actor.subject, requestId));
  } catch (error) {
    if (error instanceof AdminMediaIdempotencyConflictError) return adminFailure(requestId, 409, "IDEMPOTENCY_CONFLICT", "Request ID đã được sử dụng cho payload khác.");
    if (error instanceof AdminMediaPayloadTooLargeError) return adminFailure(requestId, 413, "PAYLOAD_TOO_LARGE", "Payload media vượt giới hạn.");
    if (error instanceof AdminMediaValidationError) return adminFailure(requestId, 422, "VALIDATION_ERROR", "File media không hợp lệ.");
    return adminFailure(requestId, 500, "INTERNAL_ERROR", "Không thể tải media lên.");
  }
}
