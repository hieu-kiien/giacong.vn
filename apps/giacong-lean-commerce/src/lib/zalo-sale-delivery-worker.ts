import {
  deliverZaloSaleToWebhook,
  type ZaloSaleWebhookPayload,
} from "./contact-webhook.ts";

interface ZaloSalePreparedStatement {
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  bind(...values: unknown[]): ZaloSalePreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}

export interface ZaloSaleDeliveryDatabase {
  prepare(query: string): ZaloSalePreparedStatement;
}

export interface ZaloSaleDeliveryEnvironment {
  GOOGLE_SHEETS_WEBHOOK_SECRET?: string;
  GOOGLE_SHEETS_WEBHOOK_URL?: string;
}

export interface ZaloSaleDeliveryMessage {
  saleId: string;
}

interface SaleRow {
  id: string;
  sale_code: string;
  source_lead_id: string;
  confirmed_at: string;
  currency: "VND";
  total_amount: number;
  full_name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
}

interface SaleItemRow {
  id: string;
  source_lead_item_id: string;
  product_slug: string | null;
  service_slug: string | null;
  product_name: string;
  variant_name: string | null;
  variant_sku: string | null;
  unit: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  currency: "VND";
  notes: string | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_SALE_ITEMS = 50;

export async function deliverQueuedZaloSale(
  message: ZaloSaleDeliveryMessage,
  environment: ZaloSaleDeliveryEnvironment,
  database: ZaloSaleDeliveryDatabase,
  willRetry: boolean,
): Promise<void> {
  if (!UUID_PATTERN.test(message.saleId)) throw new Error("invalid_sale_id");
  const outbox = await readSaleOutbox(database, message.saleId);
  if (!outbox) throw new Error("sale_outbox_not_found");
  if (outbox.status === "delivered") return;

  await database.prepare(`
    UPDATE google_sheet_sales_outbox
    SET status = 'pending', attempts = attempts + 1, last_error = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE sale_id = ? AND status <> 'delivered'
  `).bind(message.saleId).run();

  try {
    const payload = await loadZaloSaleSnapshot(database, message.saleId);
    const response = await deliverZaloSaleToWebhook(
      payload,
      environment as Readonly<Record<string, string | undefined>>,
    );
    if (!response.ok) throw new Error(`secondary_sink_http_${response.status}`);
    await database.prepare(`
      UPDATE google_sheet_sales_outbox
      SET status = 'delivered', last_error = NULL,
        delivered_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE sale_id = ?
    `).bind(message.saleId).run();
  } catch (error) {
    const failureReason = error instanceof Error ? error.message.slice(0, 500) : "secondary_sink_exception";
    await database.prepare(`
      UPDATE google_sheet_sales_outbox
      SET status = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP
      WHERE sale_id = ? AND status <> 'delivered'
    `).bind(willRetry ? "pending" : "failed", failureReason, message.saleId).run();
    throw error;
  }
}

async function readSaleOutbox(
  database: ZaloSaleDeliveryDatabase,
  saleId: string,
): Promise<{ status: string } | null> {
  return database.prepare(`
    SELECT status FROM google_sheet_sales_outbox WHERE sale_id = ? LIMIT 1
  `).bind(saleId).first<{ status: string }>();
}

async function loadZaloSaleSnapshot(
  database: ZaloSaleDeliveryDatabase,
  saleId: string,
): Promise<ZaloSaleWebhookPayload> {
  const sale = await database.prepare(`
    SELECT id, sale_code, source_lead_id, confirmed_at, currency, total_amount,
      full_name, company_name, email, phone
    FROM zalo_sales
    WHERE id = ?
    LIMIT 1
  `).bind(saleId).first<SaleRow>();
  if (!sale) throw new Error("sale_snapshot_not_found");

  const itemResult = await database.prepare(`
    SELECT id, source_lead_item_id, product_slug, service_slug, product_name,
      variant_name, variant_sku, unit, quantity, unit_price, line_total, currency, notes
    FROM zalo_sale_items
    WHERE sale_id = ?
    ORDER BY rowid ASC
  `).bind(saleId).all<SaleItemRow>();
  const rows = itemResult.results ?? [];
  if (!rows.length || rows.length > MAX_SALE_ITEMS) throw new Error("sale_snapshot_items_invalid");

  const items = rows.map((item) => {
    if (!UUID_PATTERN.test(item.id) || !UUID_PATTERN.test(item.source_lead_item_id)
      || !Number.isSafeInteger(item.quantity) || item.quantity < 1
      || !Number.isSafeInteger(item.unit_price) || item.unit_price < 0
      || !Number.isSafeInteger(item.line_total) || item.line_total !== item.quantity * item.unit_price
      || item.currency !== "VND") {
      throw new Error("sale_snapshot_item_invalid");
    }
    return {
      sale_line_id: item.id,
      source_lead_item_id: item.source_lead_item_id,
      product_slug: item.product_slug,
      service_slug: item.service_slug,
      product_name: requireText(item.product_name, "sale_snapshot_item_name"),
      variant_name: item.variant_name,
      variant_sku: item.variant_sku,
      unit: item.unit,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.line_total,
      currency: "VND" as const,
      notes: item.notes,
    };
  });
  const lineTotal = items.reduce((total, item) => total + item.line_total, 0);
  if (!Number.isSafeInteger(sale.total_amount) || sale.total_amount !== lineTotal || sale.currency !== "VND") {
    throw new Error("sale_snapshot_total_mismatch");
  }

  const canonical = {
    sale_id: sale.id,
    sale_code: requireText(sale.sale_code, "sale_snapshot_code"),
    source_lead_id: requireText(sale.source_lead_id, "sale_snapshot_lead_id"),
    confirmed_at: requireText(sale.confirmed_at, "sale_snapshot_confirmed_at"),
    currency: "VND" as const,
    total_amount: sale.total_amount,
    customer: {
      full_name: requireText(sale.full_name, "sale_snapshot_customer_name"),
      company_name: sale.company_name,
      email: sale.email,
      phone: sale.phone,
    },
    items,
  };
  return { event: "sale.confirmed", ...canonical, snapshot_sha256: await fingerprint(canonical) };
}

function requireText(value: string | null, error: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(error);
  return value;
}

async function fingerprint(input: Record<string, unknown>): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(input));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
