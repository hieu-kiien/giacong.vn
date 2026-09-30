import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManageLeads } from "@/lib/admin-permissions.ts";
import { readAdminZaloSale } from "@/lib/admin-zalo-sale-write.ts";
import { deliverQueuedZaloSale } from "@/lib/zalo-sale-delivery-worker.ts";
import { getZaloSaleDeliveryBindings } from "@/lib/zalo-sale-queue.ts";

export const dynamic = "force-dynamic";

interface LeadSaleRetryRouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: LeadSaleRetryRouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageLeads(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được đồng bộ giao dịch.");
  }

  const { id } = await context.params;
  if (!isLeadId(id)) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy yêu cầu.");

  const requestId = crypto.randomUUID();
  try {
    const leadId = id.toLowerCase();
    const sale = await readAdminZaloSale(guard.database, leadId);
    if (!sale) return adminFailure(requestId, 404, "NOT_FOUND", "Yêu cầu chưa có giao dịch đã chốt.");
    if (sale.sheetSync.status === "delivered") return adminSuccess(requestId, { sale });
    if (sale.sheetSync.status !== "failed") {
      return adminFailure(requestId, 409, "STALE_WRITE", "Chỉ có thể thử lại giao dịch đang báo lỗi đồng bộ.");
    }

    const bindings = getZaloSaleDeliveryBindings();
    let deliveryError: unknown = null;
    try {
      await deliverQueuedZaloSale({ saleId: sale.id }, bindings.environment, guard.database, false);
    } catch (error) {
      deliveryError = error;
    }

    const updatedSale = await readAdminZaloSale(guard.database, leadId);
    if (!updatedSale) return adminFailure(requestId, 404, "NOT_FOUND", "Không tìm thấy giao dịch sau khi đồng bộ.");
    if (deliveryError && updatedSale.sheetSync.status !== "failed" && updatedSale.sheetSync.status !== "delivered") {
      return adminErrorFrom(requestId, deliveryError, "Không thể thử đồng bộ Google Sheets.");
    }
    return adminSuccess(requestId, { sale: updatedSale });
  } catch (error) {
    return adminErrorFrom(requestId, error, "Không thể thử đồng bộ Google Sheets.");
  }
}

function isLeadId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
