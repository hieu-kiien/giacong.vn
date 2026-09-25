import { adminFailure, adminSuccess } from "@/lib/admin-api";
import { adminErrorFrom } from "@/lib/admin-error-mapping";
import { requireAdmin } from "@/lib/admin-guard";
import { canManage, canManageCrm } from "@/lib/admin-permissions";
import { readBoundedAdminJson } from "@/lib/admin-request";
import { updateCrmCustomerSchema } from "@/lib/admin-crm-types";

export const dynamic = "force-dynamic";

export async function GET(request: Request, props: { params: Promise<{ id: string }> }): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManage(guard.member.role, "crm.read")) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được xem khách hàng.");
  }

  const { id } = await props.params;

  try {
    const customer = await guard.database.prepare(
      `SELECT * FROM crm_customers WHERE id = ?`
    ).bind(id).first();

    if (!customer) {
      return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy khách hàng.");
    }

    return adminSuccess(crypto.randomUUID(), { customer });
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Lỗi khi tải thông tin khách hàng.");
  }
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageCrm(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được cập nhật khách hàng.");
  }

  const { id } = await props.params;
  const parsedRequest = await readBoundedAdminJson(request);
  if (!parsedRequest.ok) return adminFailure(parsedRequest.requestId, parsedRequest.status, parsedRequest.code, parsedRequest.message);

  const validation = updateCrmCustomerSchema.safeParse(parsedRequest.body);
  if (!validation.success) {
    const errors: Record<string, string> = {};
    for (const err of validation.error.errors) {
      if (err.path.length) errors[err.path.join(".")] = err.message;
    }
    return adminFailure(parsedRequest.requestId, 422, "VALIDATION_ERROR", "Dữ liệu cập nhật chưa hợp lệ.", errors);
  }

  const data = validation.data;
  
  try {
    const existing = await guard.database.prepare(`SELECT revision FROM crm_customers WHERE id = ?`).bind(id).first<{ revision: number }>();
    if (!existing) {
      return adminFailure(parsedRequest.requestId, 404, "NOT_FOUND", "Không tìm thấy khách hàng.");
    }
    
    if (data.revision && data.revision !== existing.revision) {
      return adminFailure(parsedRequest.requestId, 409, "STALE_WRITE", "Dữ liệu đã bị thay đổi bởi người khác, vui lòng tải lại trang.");
    }

    const updates: string[] = [];
    const params: (string | number | null)[] = [];
    
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'revision') {
        updates.push(`${key} = ?`);
        params.push(value);
      }
    }
    
    if (updates.length > 0) {
      updates.push(`revision = revision + 1`);
      updates.push(`updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`);
      
      params.push(id);
      if (data.revision) {
        params.push(data.revision);
        await guard.database.prepare(
          `UPDATE crm_customers SET ${updates.join(', ')} WHERE id = ? AND revision = ?`
        ).bind(...params).run();
      } else {
        await guard.database.prepare(
          `UPDATE crm_customers SET ${updates.join(', ')} WHERE id = ?`
        ).bind(...params).run();
      }
    }

    return adminSuccess(parsedRequest.requestId, { success: true });
  } catch (error) {
    return adminErrorFrom(parsedRequest.requestId, error, "Không thể cập nhật khách hàng.");
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageCrm(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được xóa khách hàng.");
  }

  const { id } = await props.params;

  try {
    await guard.database.prepare(
      `DELETE FROM crm_customers WHERE id = ?`
    ).bind(id).run();

    return adminSuccess(crypto.randomUUID(), { success: true });
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Lỗi khi xóa khách hàng.");
  }
}
