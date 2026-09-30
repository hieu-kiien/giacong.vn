import "server-only";

import type { D1DatabaseLike, D1PreparedStatementLike } from "./admin-data.ts";
import { isAdminRequestId } from "./admin-request.ts";

export class AdminZaloSaleValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminZaloSaleValidationError";
  }
}

export class AdminZaloSaleConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminZaloSaleConflictError";
  }
}

export class AdminZaloSaleStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminZaloSaleStorageError";
  }
}

interface D1DatabaseWithBatch extends D1DatabaseLike {
  batch(statements: D1PreparedStatementLike[]): Promise<unknown[]>;
}

interface SaleCommandItem {
  leadItemId: string;
  quantity: number;
  unitPrice: number;
}

export interface AdminZaloSaleCommand {
  requestId: string;
  items: SaleCommandItem[];
}

interface LeadRow {
  id: string;
  customer_id: string | null;
  full_name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
}

interface LeadItemRow {
  id: string;
  product_slug: string | null;
  service_slug: string | null;
  product_name: string | null;
  variant_name: string | null;
  variant_sku: string | null;
  unit: string | null;
  quantity: number | null;
  unit_price: number | null;
  line_total: number | null;
  currency: string | null;
  notes: string | null;
}

interface ExistingSaleRow {
  id: string;
  source_lead_id: string;
  request_id: string;
  payload_sha256: string;
}

interface SaleHeaderRow {
  id: string;
  sale_code: string;
  source_lead_id: string;
  customer_id: string;
  confirmed_at: string;
  confirmed_by: string;
  channel: "zalo";
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

export interface AdminZaloSale {
  id: string;
  saleCode: string;
  sourceLeadId: string;
  customerId: string;
  confirmedAt: string;
  confirmedBy: string;
  channel: "zalo";
  currency: "VND";
  totalAmount: number;
  customer: {
    fullName: string;
    companyName: string | null;
    email: string | null;
    phone: string | null;
  };
  items: Array<{
    id: string;
    sourceLeadItemId: string;
    productSlug: string | null;
    serviceSlug: string | null;
    productName: string;
    variantName: string | null;
    variantSku: string | null;
    unit: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    currency: "VND";
    notes: string | null;
  }>;
  sheetSync: {
    status: "blocked_contract" | "pending" | "delivered" | "failed";
    attempts: number;
    lastError: string | null;
    message: string;
  };
}

const MAX_SALE_ITEMS = 50;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseAdminZaloSaleCommand(payload: unknown): AdminZaloSaleCommand {
  const source = asRecord(payload);
  if (!source || !hasExactKeys(source, ["requestId", "items"])) {
    throw new AdminZaloSaleValidationError("Request cần đúng requestId và danh sách sản phẩm đã chốt.");
  }
  if (!isAdminRequestId(source.requestId)) {
    throw new AdminZaloSaleValidationError("requestId phải là UUID hợp lệ.");
  }
  if (!Array.isArray(source.items) || source.items.length < 1 || source.items.length > MAX_SALE_ITEMS) {
    throw new AdminZaloSaleValidationError(`Chọn từ 1 đến ${MAX_SALE_ITEMS} dòng hàng đã chốt.`);
  }

  const seen = new Set<string>();
  const items = source.items.map((value): SaleCommandItem => {
    const item = asRecord(value);
    if (!item || !hasExactKeys(item, ["leadItemId", "quantity", "unitPrice"])) {
      throw new AdminZaloSaleValidationError("Mỗi dòng chỉ được có leadItemId, quantity và unitPrice.");
    }
    if (typeof item.leadItemId !== "string" || !uuidPattern.test(item.leadItemId)) {
      throw new AdminZaloSaleValidationError("Mã dòng yêu cầu không hợp lệ.");
    }
    const leadItemId = item.leadItemId.toLowerCase();
    if (seen.has(leadItemId)) throw new AdminZaloSaleValidationError("Không gửi trùng một dòng hàng.");
    seen.add(leadItemId);
    const quantity = requireInteger(item.quantity, "Số lượng", 1);
    const unitPrice = requireInteger(item.unitPrice, "Đơn giá", 0);
    if (!Number.isSafeInteger(quantity * unitPrice)) {
      throw new AdminZaloSaleValidationError("Thành tiền vượt giới hạn cho phép.");
    }
    return { leadItemId, quantity, unitPrice };
  });

  return { requestId: source.requestId.trim().toLowerCase(), items };
}

export async function readAdminZaloSale(
  database: D1DatabaseLike,
  leadId: string,
): Promise<AdminZaloSale | null> {
  const header = await database.prepare(`
    SELECT sale.id, sale.sale_code, sale.source_lead_id, sale.customer_id,
      sale.confirmed_at, sale.confirmed_by, sale.channel, sale.currency,
      sale.total_amount, sale.full_name, sale.company_name, sale.email, sale.phone,
      outbox.status AS sheet_status, outbox.last_error AS sheet_error,
      outbox.attempts AS sheet_attempts
    FROM zalo_sales sale
    LEFT JOIN google_sheet_sales_outbox outbox ON outbox.sale_id = sale.id
    WHERE sale.source_lead_id = ?
    LIMIT 1
  `).bind(leadId).first<SaleHeaderRow & {
    sheet_status: AdminZaloSale["sheetSync"]["status"] | null;
    sheet_error: string | null;
    sheet_attempts: number | null;
  }>();
  if (!header) return null;

  const result = await database.prepare(`
    SELECT id, source_lead_item_id, product_slug, service_slug, product_name,
      variant_name, variant_sku, unit, quantity, unit_price, line_total, currency, notes
    FROM zalo_sale_items
    WHERE sale_id = ?
    ORDER BY rowid ASC
  `).bind(header.id).all<SaleItemRow>();
  const itemRows = result.results ?? [];
  if (!itemRows.length) throw new AdminZaloSaleStorageError("Giao dịch đã lưu nhưng chưa có dòng hàng để hiển thị.");

  return {
    id: header.id,
    saleCode: header.sale_code,
    sourceLeadId: header.source_lead_id,
    customerId: header.customer_id,
    confirmedAt: header.confirmed_at,
    confirmedBy: header.confirmed_by,
    channel: header.channel,
    currency: header.currency,
    totalAmount: header.total_amount,
    customer: {
      fullName: header.full_name,
      companyName: header.company_name,
      email: header.email,
      phone: header.phone,
    },
    items: itemRows.map((item) => ({
      id: item.id,
      sourceLeadItemId: item.source_lead_item_id,
      productSlug: item.product_slug,
      serviceSlug: item.service_slug,
      productName: item.product_name,
      variantName: item.variant_name,
      variantSku: item.variant_sku,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      lineTotal: item.line_total,
      currency: item.currency,
      notes: item.notes,
    })),
    sheetSync: {
      status: header.sheet_status ?? "pending",
      attempts: header.sheet_attempts ?? 0,
      lastError: header.sheet_error,
      message: sheetSyncMessage(header.sheet_status ?? "pending", header.sheet_attempts ?? 0),
    },
  };
}

export async function createAdminZaloSaleAtomically(
  database: D1DatabaseLike,
  leadId: string,
  actorSubject: string,
  command: AdminZaloSaleCommand,
): Promise<AdminZaloSale> {
  const lead = await database.prepare(`
    SELECT id, customer_id, full_name, company_name, email, phone
    FROM leads
    WHERE id = ?
    LIMIT 1
  `).bind(leadId).first<LeadRow>();
  if (!lead) throw new AdminZaloSaleConflictError("Không tìm thấy yêu cầu nguồn.");
  const customerId = lead.customer_id?.trim();
  if (!customerId) {
    throw new AdminZaloSaleConflictError("Yêu cầu này chưa gắn với tài khoản khách hàng nên chưa thể đưa vào lịch sử mua.");
  }
  const actor = actorSubject.trim();
  if (!actor || actor.length > 255) throw new AdminZaloSaleValidationError("Tài khoản nhân viên không hợp lệ.");

  const leadItems = await readSourceLeadItems(database, leadId);
  const leadItemsById = new Map(leadItems.map((item) => [item.id, item]));
  const selected = command.items.map((item) => {
    const source = leadItemsById.get(item.leadItemId);
    if (!source) throw new AdminZaloSaleValidationError("Có dòng hàng không thuộc yêu cầu này. Hãy tải lại chi tiết yêu cầu.");
    if (source.currency && source.currency !== "VND") {
      throw new AdminZaloSaleValidationError("Chỉ ghi nhận giao dịch bằng VND trong phiên bản này.");
    }
    return {
      ...item,
      source,
      lineTotal: item.quantity * item.unitPrice,
    };
  });
  const totalAmount = selected.reduce((total, item) => total + item.lineTotal, 0);
  if (!Number.isSafeInteger(totalAmount)) throw new AdminZaloSaleValidationError("Tổng giao dịch vượt giới hạn cho phép.");

  const payloadSha256 = await fingerprint({
    customerId,
    items: selected.map(({ leadItemId, quantity, unitPrice }) => ({ leadItemId, quantity, unitPrice })),
    leadId,
  });
  const existingRequest = await findByRequestId(database, command.requestId);
  if (existingRequest) {
    if (existingRequest.source_lead_id !== leadId || existingRequest.payload_sha256 !== payloadSha256) {
      throw new AdminZaloSaleConflictError("requestId đã được dùng cho một giao dịch khác. Hãy tải lại trước khi thử lại.");
    }
    const existingSale = await readAdminZaloSale(database, leadId);
    if (!existingSale) throw new AdminZaloSaleStorageError("Đã nhận yêu cầu ghi giao dịch nhưng chưa đọc lại được bản ghi.");
    return existingSale;
  }
  const existingLeadSale = await findByLeadId(database, leadId);
  if (existingLeadSale) {
    throw new AdminZaloSaleConflictError(`Yêu cầu này đã có giao dịch ${existingLeadSale.sale_code}. Không thể ghi trùng.`);
  }

  const saleId = crypto.randomUUID();
  const saleCode = `ZL-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${saleId.slice(0, 8).toUpperCase()}`;
  const statements: D1PreparedStatementLike[] = [database.prepare(`
    INSERT INTO zalo_sales (
      id, sale_code, source_lead_id, customer_id, confirmed_at, confirmed_by,
      channel, currency, total_amount, full_name, company_name, email, phone,
      request_id, payload_sha256
    )
    SELECT ?, ?, lead.id, lead.customer_id, CURRENT_TIMESTAMP, ?, 'zalo', 'VND',
      ?, lead.full_name, lead.company_name, lead.email, lead.phone, ?, ?
    FROM leads lead
    WHERE lead.id = ? AND lead.customer_id = ? AND NOT EXISTS (
      SELECT 1 FROM zalo_sales existing WHERE existing.source_lead_id = lead.id
    )
  `).bind(
    saleId,
    saleCode,
    actor,
    totalAmount,
    command.requestId,
    payloadSha256,
    leadId,
    customerId,
  )];

  for (const item of selected) {
    const source = item.source;
    statements.push(database.prepare(`
      INSERT INTO zalo_sale_items (
        id, sale_id, source_lead_item_id, product_slug, service_slug,
        product_name, variant_name, variant_sku, unit, quantity, unit_price,
        line_total, currency, notes
      )
      SELECT ?, sale.id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'VND', ?
      FROM zalo_sales sale
      WHERE sale.id = ?
    `).bind(
      crypto.randomUUID(),
      source.id,
      source.product_slug,
      source.service_slug,
      source.product_name || source.service_slug || source.product_slug || "Sản phẩm/dịch vụ",
      source.variant_name,
      source.variant_sku,
      source.unit,
      item.quantity,
      item.unitPrice,
      item.lineTotal,
      source.notes,
      saleId,
    ));
  }

  const auditMetadata = JSON.stringify({
    customerId,
    itemCount: selected.length,
    payloadSha256,
    requestId: command.requestId,
    saleCode,
    totalAmount,
  });
  statements.push(database.prepare(`
    INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
    SELECT ?, ?, 'zalo_sale.confirmed', 'zalo_sale', sale.id, ?
    FROM zalo_sales sale
    WHERE sale.id = ?
  `).bind(crypto.randomUUID(), actor, auditMetadata, saleId));
  statements.push(database.prepare(`
    INSERT INTO google_sheet_sales_outbox (sale_id, idempotency_key, status, last_error)
    SELECT sale.id, sale.id, 'pending', NULL
    FROM zalo_sales sale
    WHERE sale.id = ?
  `).bind(saleId));

  const databaseWithBatch = requireBatch(database);
  try {
    await databaseWithBatch.batch(statements);
  } catch (error) {
    const racedRequest = await findByRequestId(database, command.requestId);
    if (racedRequest) {
      if (racedRequest.source_lead_id !== leadId || racedRequest.payload_sha256 !== payloadSha256) {
        throw new AdminZaloSaleConflictError("requestId đã được dùng cho một giao dịch khác. Hãy tải lại trước khi thử lại.");
      }
      const racedSale = await readAdminZaloSale(database, leadId);
      if (racedSale) return racedSale;
    }
    const racedLead = await findByLeadId(database, leadId);
    if (racedLead) {
      throw new AdminZaloSaleConflictError(`Yêu cầu này đã có giao dịch ${racedLead.sale_code}. Không thể ghi trùng.`);
    }
    throw normalizeStorageError(error);
  }

  const sale = await readAdminZaloSale(database, leadId);
  if (!sale || sale.id !== saleId || sale.items.length !== selected.length) {
    throw new AdminZaloSaleStorageError("Không xác nhận được đầy đủ giao dịch, dòng hàng và outbox sau khi ghi D1.");
  }
  const complete = await database.prepare(`
    SELECT CASE WHEN
      EXISTS (SELECT 1 FROM audit_logs WHERE action = 'zalo_sale.confirmed' AND entity_id = ?)
      AND EXISTS (SELECT 1 FROM google_sheet_sales_outbox WHERE sale_id = ? AND idempotency_key = ? AND status = 'pending')
    THEN 1 ELSE 0 END AS complete
  `).bind(saleId, saleId, saleId).first<{ complete: number }>();
  if (Number(complete?.complete) !== 1) {
    throw new AdminZaloSaleStorageError("Không xác nhận được audit và trạng thái đồng bộ Sheet sau khi ghi D1.");
  }
  return sale;
}

function sheetSyncMessage(status: AdminZaloSale["sheetSync"]["status"], attempts: number): string {
  if (status === "delivered") return "Đã đồng bộ Google Sheets theo mã giao dịch.";
  if (status === "failed") return `Chưa đồng bộ Google Sheets sau ${attempts} lần thử. Kiểm tra cấu hình webhook hoặc hàng đợi.`;
  if (status === "blocked_contract") return "Đồng bộ Google Sheets đang bị chặn do hợp đồng webhook cũ.";
  return attempts > 0
    ? `Đang chờ thử lại đồng bộ Google Sheets (đã thử ${attempts} lần).`
    : "Đang chờ đồng bộ Google Sheets.";
}

async function readSourceLeadItems(database: D1DatabaseLike, leadId: string): Promise<LeadItemRow[]> {
  const result = await database.prepare(`
    SELECT id, product_slug, service_slug, product_name, variant_name, variant_sku,
      unit, quantity, unit_price, line_total, currency, notes
    FROM lead_items
    WHERE lead_id = ?
    ORDER BY rowid ASC
  `).bind(leadId).all<LeadItemRow>();
  return result.results ?? [];
}

async function findByRequestId(database: D1DatabaseLike, requestId: string): Promise<ExistingSaleRow | null> {
  return database.prepare(`
    SELECT id, source_lead_id, request_id, payload_sha256
    FROM zalo_sales
    WHERE request_id = ?
    LIMIT 1
  `).bind(requestId).first<ExistingSaleRow>();
}

async function findByLeadId(database: D1DatabaseLike, leadId: string): Promise<{ sale_code: string } | null> {
  return database.prepare(`
    SELECT sale_code FROM zalo_sales WHERE source_lead_id = ? LIMIT 1
  `).bind(leadId).first<{ sale_code: string }>();
}

function requireBatch(database: D1DatabaseLike): D1DatabaseWithBatch {
  const databaseWithBatch = database as D1DatabaseWithBatch;
  if (typeof databaseWithBatch.batch !== "function") {
    throw new AdminZaloSaleStorageError("D1 atomic batch chưa sẵn sàng cho giao dịch Zalo.");
  }
  return databaseWithBatch;
}

function normalizeStorageError(error: unknown): unknown {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  if (normalized.includes("zalo_sales") || normalized.includes("zalo_sale_items")
    || normalized.includes("audit_logs") || normalized.includes("google_sheet_sales_outbox")) {
    return new AdminZaloSaleStorageError("D1 đã rollback vì không ghi đồng bộ được giao dịch, audit và outbox.");
  }
  return error;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const expected = new Set(keys);
  return Object.keys(value).length === expected.size && Object.keys(value).every((key) => expected.has(key));
}

function requireInteger(value: unknown, label: string, min: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min) {
    throw new AdminZaloSaleValidationError(`${label} phải là số nguyên ${min ? "dương" : "không âm"}.`);
  }
  return value;
}

async function fingerprint(input: Record<string, unknown>): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(input));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
