import { adminFailure, adminSuccess } from "@/lib/admin-api";
import { requireAdmin } from "@/lib/admin-guard";
import { deliverCustomerContact } from "@/lib/customer-contact-delivery";
import { getCustomerContactDeliveryBindings } from "@/lib/customer-contact-queue";
import { readCustomerContactDeliveryStatus } from "@/lib/customer-contact-delivery-status";
import type { D1DatabaseLike } from "@/lib/admin-data";
export const dynamic = "force-dynamic";
interface Context { params: Promise<{ id: string }> }
async function handle(request: Request, context: Context, retry: boolean, database: D1DatabaseLike) {
  const requestId = crypto.randomUUID();
  if (retry && request.headers.get("origin") !== new URL(request.url).origin) return adminFailure(requestId,403,"FORBIDDEN","Yêu cầu không hợp lệ.");
  const { id } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return adminFailure(requestId,400,"VALIDATION_ERROR","Mã khách hàng không hợp lệ.");
  try {
    const customer = await database.prepare('SELECT id FROM "user" WHERE id = ?').bind(id).first();
    if (!customer) return adminFailure(requestId,404,"NOT_FOUND","Không tìm thấy khách hàng.");
    const before = await readCustomerContactDeliveryStatus(database,id);
    if (retry && before.reviewRequired && before.sheet !== "pending") return adminFailure(requestId,409,"STALE_WRITE","Cần đối soát lần gửi email trước trên dịch vụ email trước khi thử lại.");
    if (retry && (before.sheet === "pending" || before.email === "pending")) {
      try { await deliverCustomerContact(id,getCustomerContactDeliveryBindings(),database); } catch { /* The persisted status is the result, never expose provider errors or credentials. */ }
    }
    return adminSuccess(requestId,{ delivery: await readCustomerContactDeliveryStatus(database,id) });
  } catch { return adminFailure(requestId,503,"INTERNAL_ERROR","Chưa kiểm tra được đồng bộ khách hàng. Vui lòng thử lại."); }
}
export async function GET(request: Request, context: Context) {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (guard.member.role !== "owner") return adminFailure(crypto.randomUUID(),403,"FORBIDDEN","Bạn không có quyền xem đồng bộ khách hàng.");
  return handle(request,context,false,guard.database);
}
export async function POST(request: Request, context: Context) {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (guard.member.role !== "owner") return adminFailure(crypto.randomUUID(),403,"FORBIDDEN","Bạn không có quyền đồng bộ khách hàng.");
  return handle(request,context,true,guard.database);
}
