import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { listAdminCustomers } from "@/lib/admin-customers.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManage } from "@/lib/admin-permissions.ts";

export const dynamic = "force-dynamic";

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManage(guard.member.role, "crm.read")) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được xem khách hàng.");
  }

  const url = new URL(request.url);
  const page = parsePositiveInt(url.searchParams.get("page"), 1);
  const pageSize = Math.min(parsePositiveInt(url.searchParams.get("pageSize"), 20), 100);
  try {
    const data = await listAdminCustomers(guard.database, {
      page,
      pageSize,
      query: url.searchParams.get("query") ?? undefined,
    });
    return adminSuccess(crypto.randomUUID(), {
      ...data,
      pagination: {
        currentPage: page,
        lastPage: Math.max(1, Math.ceil(data.total / pageSize)),
        pageSize,
        total: data.total,
      },
    });
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể tải danh sách khách hàng.");
  }
}
