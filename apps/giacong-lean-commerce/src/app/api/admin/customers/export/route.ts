import { adminFailure } from "@/lib/admin-api.ts";
import { listAdminCustomers } from "@/lib/admin-customers.ts";
import { buildCustomerExportCsv } from "@/lib/admin-customer-export.ts";
import { buildCustomerExportXlsx } from "@/lib/admin-customer-xlsx.ts";
import { getCustomerSalesForExport } from "@/lib/admin-customer-sales-export.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManage } from "@/lib/admin-permissions.ts";

export const dynamic = "force-dynamic";

const EXPORT_PAGE_SIZE = 100;
const MAX_EXPORT_ROWS = 2000;

export async function GET(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManage(guard.member.role, "crm.read")) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được xem khách hàng.");
  }

  const params = new URL(request.url).searchParams;
  const query = params.get("query") ?? undefined;
  const isXlsx = params.get("format") === "xlsx";
  try {
    const rows = [];
    for (let page = 1; rows.length < MAX_EXPORT_ROWS; page += 1) {
      const { customers, total } = await listAdminCustomers(guard.database, { page, pageSize: EXPORT_PAGE_SIZE, query });
      if (total > MAX_EXPORT_ROWS) return adminFailure(crypto.randomUUID(), 400, "VALIDATION_ERROR", "Danh sách có hơn 2.000 khách hàng. Hãy tìm kiếm để thu nhỏ danh sách trước khi xuất.");
      rows.push(...customers);
      if (customers.length === 0 || page * EXPORT_PAGE_SIZE >= total) break;
    }
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    if (isXlsx) {
      const { sales, overflow } = await getCustomerSalesForExport(guard.database, rows.map((customer) => customer.id));
      if (overflow) return adminFailure(crypto.randomUUID(), 400, "VALIDATION_ERROR", "Danh sách có hơn 10.000 giao dịch. Hãy tìm kiếm để thu nhỏ danh sách trước khi xuất.");
      const file = buildCustomerExportXlsx(rows, sales);
      return new Response(new Uint8Array(file).buffer, {
        headers: {
          "Cache-Control": "no-store",
          "Content-Disposition": `attachment; filename="khach-hang-${stamp}.xlsx"`,
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    return new Response(buildCustomerExportCsv(rows.slice(0, MAX_EXPORT_ROWS)), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="khach-hang-${stamp}.csv"`,
        "Content-Type": "text/csv; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể xuất danh sách khách hàng.");
  }
}
