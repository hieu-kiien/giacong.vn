import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

interface D1PreparedStatement {
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  bind(...values: unknown[]): D1PreparedStatement;
}

interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatement;
}

interface CustomerAccountEnvironment {
  GIACONG_VN_CATALOG?: D1DatabaseLike;
}

interface RequestRow {
  created_at: string;
  id: string;
  public_reference: string | null;
  status: string;
}

interface RequestItemRow {
  lead_id: string;
  product_name: string | null;
  quantity: number | null;
  unit: string | null;
  variant_name: string | null;
}

interface SaleRow {
  confirmed_at: string;
  currency: string;
  id: string;
  sale_code: string;
  total_amount: number;
}

interface SaleItemRow {
  line_total: number;
  product_name: string;
  quantity: number;
  sale_id: string;
  unit: string | null;
  unit_price: number;
  variant_name: string | null;
}

export interface CustomerRequestHistory {
  createdAt: string;
  id: string;
  items: Array<{
    name: string;
    quantity: number | null;
    unit: string | null;
  }>;
  reference: string;
  status: string;
}

export interface CustomerSaleHistory {
  confirmedAt: string;
  currency: string;
  items: Array<{
    lineTotal: number;
    name: string;
    quantity: number;
    unit: string | null;
    unitPrice: number;
  }>;
  saleCode: string;
  totalAmount: number;
}

export async function getCustomerAccountHistory(customerId: string): Promise<{
  requests: CustomerRequestHistory[];
  sales: CustomerSaleHistory[];
}> {
  const { env } = getCloudflareContext();
  const db = (env as unknown as CustomerAccountEnvironment).GIACONG_VN_CATALOG;
  if (!db) throw new Error("Customer account database is not configured.");

  const [requestResult, saleResult] = await Promise.all([
    db.prepare(
      `SELECT id, public_reference, status, created_at
       FROM leads
       WHERE customer_id = ? AND status <> 'spam'
       ORDER BY created_at DESC`,
    ).bind(customerId).all<RequestRow>(),
    db.prepare(
      `SELECT id, sale_code, confirmed_at, currency, total_amount
       FROM zalo_sales
       WHERE customer_id = ?
       ORDER BY confirmed_at DESC`,
    ).bind(customerId).all<SaleRow>(),
  ]);

  const requestRows = requestResult.results;
  const saleRows = saleResult.results;
  const [requestItemRows, saleItemRows] = await Promise.all([
    db.prepare(
      `SELECT item.lead_id, item.product_name, item.variant_name, item.quantity, item.unit
       FROM lead_items AS item
       INNER JOIN leads AS lead ON lead.id = item.lead_id
       WHERE lead.customer_id = ? AND lead.status <> 'spam'
       ORDER BY lead.created_at DESC, item.rowid`,
    ).bind(customerId).all<RequestItemRow>(),
    db.prepare(
      `SELECT item.sale_id, item.product_name, item.variant_name, item.quantity,
              item.unit, item.unit_price, item.line_total
       FROM zalo_sale_items AS item
       INNER JOIN zalo_sales AS sale ON sale.id = item.sale_id
       WHERE sale.customer_id = ?
       ORDER BY sale.confirmed_at DESC, item.created_at, item.id`,
    ).bind(customerId).all<SaleItemRow>(),
  ]);

  const requestItemsByLead = new Map<string, RequestItemRow[]>();
  for (const item of requestItemRows.results) {
    const items = requestItemsByLead.get(item.lead_id) ?? [];
    items.push(item);
    requestItemsByLead.set(item.lead_id, items);
  }

  const saleItemsBySale = new Map<string, SaleItemRow[]>();
  for (const item of saleItemRows.results) {
    const items = saleItemsBySale.get(item.sale_id) ?? [];
    items.push(item);
    saleItemsBySale.set(item.sale_id, items);
  }

  return {
    requests: requestRows.map((request) => ({
      createdAt: request.created_at,
      id: request.id,
      items: (requestItemsByLead.get(request.id) ?? []).map((item) => ({
        name: [item.product_name, item.variant_name].filter(Boolean).join(" · ") || "Sản phẩm/dịch vụ",
        quantity: item.quantity,
        unit: item.unit,
      })),
      reference: request.public_reference || "Yêu cầu mua hàng",
      status: request.status,
    })),
    sales: saleRows.map((sale) => ({
      confirmedAt: sale.confirmed_at,
      currency: sale.currency,
      items: (saleItemsBySale.get(sale.id) ?? []).map((item) => ({
        lineTotal: item.line_total,
        name: [item.product_name, item.variant_name].filter(Boolean).join(" · "),
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unit_price,
      })),
      saleCode: sale.sale_code,
      totalAmount: sale.total_amount,
    })),
  };
}
