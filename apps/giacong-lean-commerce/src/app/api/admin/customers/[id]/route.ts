import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { getAdminCustomerDetail } from "@/lib/admin-customers.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManage } from "@/lib/admin-permissions.ts";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManage(guard.member.role, "crm.read")) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được xem khách hàng.");
  }

  const { id } = await context.params;
  if (!id || id.length > 128) {
    return adminFailure(crypto.randomUUID(), 400, "VALIDATION_ERROR", "Mã khách hàng không hợp lệ.");
  }
  try {
    const customer = await getAdminCustomerDetail(guard.database, id);
    if (!customer) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy khách hàng.");
    return adminSuccess(crypto.randomUUID(), { customer });
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể tải thông tin khách hàng.");
  }
}
