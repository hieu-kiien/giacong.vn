import { admitRuntimeAdminRequest } from "@/lib/admin-access-runtime";
import { adminFailure, adminSuccess } from "@/lib/admin-api";
import { AdminMediaConflictError, AdminMediaIdempotencyConflictError, AdminMediaValidationError, deleteProductMedia } from "@/lib/admin-media";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ key: string[] }> };

export async function DELETE(request: Request, context: Context): Promise<Response> {
  const requestId = request.headers.get("x-request-id")?.trim() || crypto.randomUUID();
  const admission = await admitRuntimeAdminRequest(request);
  if (!admission.ok) return adminFailure(requestId, admission.status, admission.code, admission.message);
  const key = (await context.params).key.join("/");
  try {
    await deleteProductMedia(key, admission.actor.subject, requestId);
    return adminSuccess(requestId, { deleted: true });
  } catch (error) {
    if (error instanceof AdminMediaConflictError) return adminFailure(requestId, 409, "MEDIA_IN_USE", "Media đang được tham chiếu và chưa thể xóa.");
    if (error instanceof AdminMediaIdempotencyConflictError) return adminFailure(requestId, 409, "IDEMPOTENCY_CONFLICT", "Request ID đã được sử dụng cho payload khác.");
    if (error instanceof AdminMediaValidationError) return adminFailure(requestId, 422, "VALIDATION_ERROR", "Media key không hợp lệ.");
    return adminFailure(requestId, 500, "INTERNAL_ERROR", "Không thể xóa media.");
  }
}
