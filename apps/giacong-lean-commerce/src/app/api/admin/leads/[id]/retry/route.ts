import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManageLeads } from "@/lib/admin-permissions.ts";
import { getLeadQueue } from "@/lib/lead-queue.ts";
import { retryFailedLead } from "@/lib/lead-retry.ts";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  const requestId = crypto.randomUUID();
  if (!canManageLeads(guard.member.role)) return adminFailure(requestId, 403, "FORBIDDEN", "Bạn không có quyền gửi lại yêu cầu.");
  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return adminFailure(requestId, 404, "NOT_FOUND", "Không tìm thấy yêu cầu.");
  // Old Sheet deployments only deduplicate for six hours. Enable after verifying
  // the durable sink and reconciling ambiguous legacy failures.
  const { env } = getCloudflareContext();
  if ((env as unknown as { LEAD_MANUAL_RETRY_ENABLED?: string }).LEAD_MANUAL_RETRY_ENABLED !== "true") {
    return adminFailure(requestId, 503, "INTERNAL_ERROR", "Chưa bật gửi lại: cần xác nhận Sheet chống ghi trùng và rà các lần đồng bộ cũ trước.");
  }
  const queue = getLeadQueue();
  if (!queue) return adminFailure(requestId, 503, "INTERNAL_ERROR", "Chưa kết nối được hàng đợi đồng bộ. Vui lòng thử lại sau.");
  try {
    const status = await retryFailedLead(guard.database, queue, id.toLowerCase(), guard.actorSubject, requestId);
    if (status === "missing") return adminFailure(requestId, 404, "NOT_FOUND", "Không tìm thấy yêu cầu.");
    if (status === "busy") return adminFailure(requestId, 409, "STALE_WRITE", "Yêu cầu đang chờ đồng bộ. Chỉ gửi lại khi chờ quá 10 phút; hãy tải lại để xem kết quả.");
    return adminSuccess(requestId, { deliveryStatus: status });
  } catch (error) {
    if (error instanceof Error && error.message === "lead_retry_legacy_payload_unreconstructable") {
      return adminFailure(requestId, 422, "VALIDATION_ERROR", "Yêu cầu được lưu theo định dạng cũ và thiếu chi tiết dịch vụ hoặc quy cách để gửi an toàn. Cần bổ sung dữ liệu gốc trước khi thử lại.");
    }
    console.error("admin_lead_retry_failed", {
      leadId: id.toLowerCase(),
      requestId,
      error: error instanceof Error ? error.message.slice(0, 300) : "unknown_error",
    });
    return adminFailure(requestId, 503, "INTERNAL_ERROR", "Chưa gửi lại được yêu cầu. Dữ liệu đã lưu vẫn được giữ; vui lòng thử lại sau.");
  }
}
