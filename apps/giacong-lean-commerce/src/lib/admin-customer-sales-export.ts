import { tableExists, type D1DatabaseLike } from "./admin-data.ts";
import type { CustomerSaleExport } from "./admin-customer-xlsx.ts";

const MAX_SALES = 10000;
const CUSTOMER_BATCH_SIZE = 90; // D1 has a limit of 100 bound parameters per query.

export async function getCustomerSalesForExport(database: D1DatabaseLike, customerIds: readonly string[]): Promise<{ sales: CustomerSaleExport[]; overflow: boolean }> {
  if (customerIds.length === 0 || !await tableExists(database, "zalo_sales")) return { sales: [], overflow: false };
  const sales: CustomerSaleExport[] = [];
  for (let start = 0; start < customerIds.length; start += CUSTOMER_BATCH_SIZE) {
    const ids = customerIds.slice(start, start + CUSTOMER_BATCH_SIZE);
    const result = await database.prepare(`
      SELECT customer_id, sale_code, confirmed_at, total_amount
      FROM zalo_sales
      WHERE customer_id IN (${ids.map(() => "?").join(",")})
      ORDER BY confirmed_at DESC, id DESC
      LIMIT ?
    `).bind(...ids, MAX_SALES + 1 - sales.length).all<{ customer_id: string; sale_code: string; confirmed_at: string; total_amount: number }>();
    sales.push(...result.results.map((sale) => ({ customerId: sale.customer_id, saleCode: sale.sale_code, confirmedAt: sale.confirmed_at, totalAmount: sale.total_amount })));
    if (sales.length > MAX_SALES) return { sales: [], overflow: true };
  }
  sales.sort((a, b) => b.confirmedAt.localeCompare(a.confirmedAt) || a.saleCode.localeCompare(b.saleCode));
  return { sales, overflow: false };
}
