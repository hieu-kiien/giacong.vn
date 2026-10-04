import { tableExists, type D1DatabaseLike } from "./admin-data.ts";

export interface AdminCustomerSummary {
  createdAt: string;
  email: string;
  id: string;
  lastRequestAt: string | null;
  name: string;
  phone: string | null;
  requestCount: number;
  saleCount: number;
  saleTotal: number;
  username: string | null;
}

export interface AdminCustomerRequest {
  createdAt: string;
  id: string;
  items: string[];
  status: string;
}

export interface AdminCustomerSale {
  confirmedAt: string;
  id: string;
  saleCode: string;
  totalAmount: number;
}

export interface AdminCustomerDetail extends AdminCustomerSummary {
  requests: AdminCustomerRequest[];
  sales: AdminCustomerSale[];
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

interface CustomerRow {
  created_at: string;
  email: string;
  id: string;
  last_request_at: string | null;
  name: string;
  phone: string | null;
  request_count: number | null;
  sale_count: number | null;
  sale_total: number | null;
  username: string | null;
}

function toSummary(row: CustomerRow): AdminCustomerSummary {
  return {
    createdAt: String(row.created_at),
    email: row.email,
    id: row.id,
    lastRequestAt: row.last_request_at,
    name: row.name,
    phone: row.phone,
    requestCount: toNumber(row.request_count),
    saleCount: toNumber(row.sale_count),
    saleTotal: toNumber(row.sale_total),
    username: row.username,
  };
}

/**
 * Customers are the storefront accounts (Better Auth `user` table). Request and
 * sale counters come from `leads.customer_id` and the confirmed `zalo_sales`
 * ledger; either table may be absent on an older database.
 */
function customerSelectSql(hasLeads: boolean, hasSales: boolean): string {
  return `
    SELECT
      u.id, u.name, u.email, u.username, u."createdAt" AS created_at,
      ${hasLeads ? "(SELECT COUNT(*) FROM leads l WHERE l.customer_id = u.id)" : "0"} AS request_count,
      ${hasLeads ? "(SELECT MAX(l.created_at) FROM leads l WHERE l.customer_id = u.id)" : "NULL"} AS last_request_at,
      ${hasLeads ? "(SELECT l.phone FROM leads l WHERE l.customer_id = u.id AND l.phone IS NOT NULL AND TRIM(l.phone) <> '' ORDER BY l.created_at DESC LIMIT 1)" : "NULL"} AS phone,
      ${hasSales ? "(SELECT COUNT(*) FROM zalo_sales s WHERE s.customer_id = u.id)" : "0"} AS sale_count,
      ${hasSales ? "(SELECT COALESCE(SUM(s.total_amount), 0) FROM zalo_sales s WHERE s.customer_id = u.id)" : "0"} AS sale_total
    FROM "user" u
  `;
}

export async function listAdminCustomers(
  database: D1DatabaseLike,
  input: { page: number; pageSize: number; query?: string },
): Promise<{ customers: AdminCustomerSummary[]; ready: boolean; total: number }> {
  if (!(await tableExists(database, "user"))) return { customers: [], ready: false, total: 0 };
  const [hasLeads, hasSales] = await Promise.all([tableExists(database, "leads"), tableExists(database, "zalo_sales")]);
  const params: unknown[] = [];
  let where = "";
  const query = input.query?.trim();
  if (query) {
    const pattern = `%${escapeLike(query)}%`;
    where = `WHERE (u.name LIKE ? ESCAPE '\\' COLLATE NOCASE OR u.email LIKE ? ESCAPE '\\' COLLATE NOCASE OR u.username LIKE ? ESCAPE '\\' COLLATE NOCASE${
      hasLeads ? " OR EXISTS (SELECT 1 FROM leads l WHERE l.customer_id = u.id AND l.phone LIKE ? ESCAPE '\\')" : ""
    })`;
    params.push(pattern, pattern, pattern);
    if (hasLeads) params.push(pattern);
  }
  const count = await database.prepare(`SELECT COUNT(*) AS total FROM "user" u ${where}`).bind(...params).first<{ total: number }>();
  const rows = await database.prepare(`
    ${customerSelectSql(hasLeads, hasSales)}
    ${where}
    ORDER BY ${hasLeads ? "last_request_at IS NULL, last_request_at DESC, " : ""}u."createdAt" DESC
    LIMIT ? OFFSET ?
  `).bind(...params, input.pageSize, (input.page - 1) * input.pageSize).all<CustomerRow>();
  return { customers: rows.results.map(toSummary), ready: true, total: toNumber(count?.total) };
}

export async function getAdminCustomerDetail(
  database: D1DatabaseLike,
  id: string,
): Promise<AdminCustomerDetail | null> {
  if (!(await tableExists(database, "user"))) return null;
  const [hasLeads, hasSales] = await Promise.all([tableExists(database, "leads"), tableExists(database, "zalo_sales")]);
  const row = await database.prepare(`
    ${customerSelectSql(hasLeads, hasSales)}
    WHERE u.id = ?
    LIMIT 1
  `).bind(id).first<CustomerRow>();
  if (!row) return null;

  const requests: AdminCustomerRequest[] = [];
  if (hasLeads) {
    const leadRows = await database.prepare(`
      SELECT id, status, created_at
      FROM leads
      WHERE customer_id = ?
      ORDER BY created_at DESC
      LIMIT 20
    `).bind(id).all<{ created_at: string; id: string; status: string }>();
    const hasItems = leadRows.results.length > 0 && (await tableExists(database, "lead_items"));
    const itemsByLead = new Map<string, string[]>();
    if (hasItems) {
      const ids = leadRows.results.map((lead) => lead.id);
      const itemRows = await database.prepare(`
        SELECT lead_id, product_name, variant_name, quantity
        FROM lead_items
        WHERE lead_id IN (${ids.map(() => "?").join(", ")})
        ORDER BY id ASC
      `).bind(...ids).all<{ lead_id: string; product_name: string | null; quantity: number | null; variant_name: string | null }>();
      for (const item of itemRows.results) {
        const label = [item.product_name, item.variant_name].filter(Boolean).join(" · ");
        if (!label) continue;
        const list = itemsByLead.get(item.lead_id) ?? [];
        list.push(`${label} × ${toNumber(item.quantity) || 1}`);
        itemsByLead.set(item.lead_id, list);
      }
    }
    for (const lead of leadRows.results) {
      requests.push({
        createdAt: String(lead.created_at),
        id: lead.id,
        items: itemsByLead.get(lead.id) ?? [],
        status: lead.status,
      });
    }
  }

  const sales: AdminCustomerSale[] = [];
  if (hasSales) {
    const saleRows = await database.prepare(`
      SELECT id, sale_code, confirmed_at, total_amount
      FROM zalo_sales
      WHERE customer_id = ?
      ORDER BY confirmed_at DESC
      LIMIT 20
    `).bind(id).all<{ confirmed_at: string; id: string; sale_code: string; total_amount: number }>();
    for (const sale of saleRows.results) {
      sales.push({
        confirmedAt: String(sale.confirmed_at),
        id: sale.id,
        saleCode: sale.sale_code,
        totalAmount: toNumber(sale.total_amount),
      });
    }
  }

  return { ...toSummary(row), requests, sales };
}
