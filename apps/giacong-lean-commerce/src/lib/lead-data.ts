import "server-only";

import type { D1DatabaseLike, D1PreparedStatementLike } from "./admin-data";

interface D1DatabaseWithBatch extends D1DatabaseLike {
  batch(statements: D1PreparedStatementLike[]): Promise<unknown[]>;
}

export type LeadDeliveryStatus = "pending" | "queued" | "delivered" | "failed";

export interface LeadPersistenceResult {
  deliveryStatus: LeadDeliveryStatus;
  isDuplicate: boolean;
  leadId: string;
  publicReference: string;
  webhookReference: string | null;
}

export interface LeadPersistence {
  create(payload: unknown): Promise<LeadPersistenceResult>;
  markDelivery(
    leadId: string,
    result: { status: LeadDeliveryStatus; webhookReference?: string | null; error?: string | null },
  ): Promise<void>;
}

interface LeadRow {
  customer_id: string | null;
  delivery_status: LeadDeliveryStatus;
  id: string;
  public_reference: string;
  request_payload_sha256: string | null;
  webhook_reference: string | null;
}

interface LeadItem {
  currency: string | null;
  lineTotal: number | null;
  notes: string | null;
  productName: string | null;
  productSlug: string | null;
  quantity: number | null;
  serviceSlug: string | null;
  snapshot: Record<string, unknown>;
  unit: string | null;
  unitPrice: number | null;
  variantName: string | null;
  variantSku: string | null;
}

export function createLeadPersistence(database: D1DatabaseLike, customerId: string | null = null): LeadPersistence {
  return {
    create: (payload) => createLead(database, payload, customerId),
    markDelivery: (leadId, result) => markLeadDelivery(database, leadId, result),
  };
}

async function createLead(
  database: D1DatabaseLike,
  rawPayload: unknown,
  customerId: string | null,
): Promise<LeadPersistenceResult> {
  const payload = asRecord(rawPayload);
  const requestId = readRequestId(payload.request_id) ?? crypto.randomUUID();
  const items = extractItems(payload);
  const payloadSha256 = await fingerprintLeadRequest(payload, customerId, items);
  const existing = await findByRequestId(database, requestId);
  if (existing) {
    await assertMatchingCompleteLead(database, existing, customerId, payloadSha256, items.length);
    return toPersistenceResult(existing, true);
  }

  const leadId = crypto.randomUUID();
  const publicReference = `LEAD-${leadId.replaceAll("-", "").slice(0, 10).toUpperCase()}`;
  const statements: D1PreparedStatementLike[] = [database.prepare(`
    INSERT INTO leads (
      id, public_reference, request_id, customer_id, request_payload_sha256,
      full_name, company_name, email, phone, country, message, source,
      delivery_status, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
  `).bind(
    leadId,
    publicReference,
    requestId,
    customerId,
    payloadSha256,
    readText(payload.name, 120) || "Khách hàng chưa cung cấp tên",
    readNullableText(payload.company_name, 160),
    readNullableText(payload.email, 254),
    readNullableText(payload.phone, 24),
    readNullableText(payload.country, 80),
    readNullableText(payload.message, 2_000),
    readText(payload.source, 200) || "request_form",
    JSON.stringify(payload),
  )];

  for (const item of items) {
    statements.push(database.prepare(`
      INSERT INTO lead_items (
        id, lead_id, product_slug, service_slug, quantity, unit, notes,
        variant_sku, product_name, variant_name, unit_price, line_total,
        currency, snapshot_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      leadId,
      item.productSlug,
      item.serviceSlug,
      item.quantity,
      item.unit,
      item.notes,
      item.variantSku,
      item.productName,
      item.variantName,
      item.unitPrice,
      item.lineTotal,
      item.currency,
      JSON.stringify(item.snapshot),
    ));
  }
  statements.push(database.prepare(`
    INSERT INTO lead_events (id, lead_id, actor_subject, event_type, message)
    VALUES (?, ?, NULL, 'received', ?)
  `).bind(
    crypto.randomUUID(),
    leadId,
    items.length > 0 ? `${items.length} dòng nhu cầu được lưu cùng lead.` : "Lead được lưu từ request form.",
  ));

  try {
    const databaseWithBatch = requireLeadBatch(database);
    const results = await databaseWithBatch.batch(statements);
    if (results.length !== statements.length) throw new Error("lead_batch_result_incomplete");

    const created = await findByRequestId(database, requestId);
    if (!created || created.id !== leadId) throw new Error("lead_batch_readback_failed");
    await assertMatchingCompleteLead(database, created, customerId, payloadSha256, items.length);
  } catch (error) {
    if (!isUniqueError(error)) throw error;
    const duplicate = await findByRequestId(database, requestId);
    if (duplicate) {
      await assertMatchingCompleteLead(database, duplicate, customerId, payloadSha256, items.length);
      return toPersistenceResult(duplicate, true);
    }
    throw error;
  }

  return {
    deliveryStatus: "pending",
    isDuplicate: false,
    leadId,
    publicReference,
    webhookReference: null,
  };
}

async function markLeadDelivery(
  database: D1DatabaseLike,
  leadId: string,
  result: { status: LeadDeliveryStatus; webhookReference?: string | null; error?: string | null },
): Promise<void> {
  await database.prepare(`
    UPDATE leads
    SET delivery_status = ?,
      webhook_reference = COALESCE(?, webhook_reference),
      delivery_error = ?,
      delivered_at = CASE WHEN ? = 'delivered' THEN CURRENT_TIMESTAMP ELSE delivered_at END,
      delivery_attempts = delivery_attempts + 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    result.status,
    result.webhookReference ?? null,
    result.error ?? null,
    result.status,
    leadId,
  ).run();
}

async function findByRequestId(database: D1DatabaseLike, requestId: string): Promise<LeadRow | null> {
  return database.prepare(`
    SELECT id, public_reference, customer_id, delivery_status, webhook_reference,
      request_payload_sha256
    FROM leads
    WHERE request_id = ?
    LIMIT 1
  `).bind(requestId).first<LeadRow>();
}

async function assertMatchingCompleteLead(
  database: D1DatabaseLike,
  lead: LeadRow,
  customerId: string | null,
  payloadSha256: string,
  expectedItemCount: number,
): Promise<void> {
  if (lead.customer_id !== customerId) {
    throw new Error("Request ID already belongs to a different customer.");
  }
  if (lead.request_payload_sha256 !== payloadSha256) {
    throw new Error("Request ID already belongs to different request content.");
  }

  const completeness = await database.prepare(`
    SELECT
      (SELECT COUNT(*) FROM lead_items WHERE lead_id = ?) AS item_count,
      EXISTS(SELECT 1 FROM lead_events WHERE lead_id = ? AND event_type = 'received') AS has_received_event
  `).bind(lead.id, lead.id).first<{ item_count: number; has_received_event: number }>();
  if (!completeness
    || Number(completeness.item_count) !== expectedItemCount
    || Number(completeness.has_received_event) !== 1) {
    throw new Error("Stored request is incomplete; refusing duplicate acceptance.");
  }
}

async function fingerprintLeadRequest(
  payload: Record<string, unknown>,
  customerId: string | null,
  items: LeadItem[],
): Promise<string> {
  const canonical = stableJsonValue({
    customerId,
    items,
    payload,
  });
  const bytes = new TextEncoder().encode(JSON.stringify(canonical));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (typeof value !== "object" || value === null) return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(Object.keys(record).sort().map((key) => [key, stableJsonValue(record[key])]));
}

function requireLeadBatch(database: D1DatabaseLike): D1DatabaseWithBatch {
  const databaseWithBatch = database as D1DatabaseWithBatch;
  if (typeof databaseWithBatch.batch !== "function") {
    throw new Error("D1 atomic batch is unavailable for lead submission.");
  }
  return databaseWithBatch;
}

function toPersistenceResult(row: LeadRow, isDuplicate: boolean): LeadPersistenceResult {
  return {
    deliveryStatus: row.delivery_status,
    isDuplicate,
    leadId: row.id,
    publicReference: row.public_reference || `LEAD-${row.id.replaceAll("-", "").slice(0, 10).toUpperCase()}`,
    webhookReference: row.webhook_reference,
  };
}

function extractItems(payload: Record<string, unknown>): LeadItem[] {
  if (Array.isArray(payload.cart)) {
    const items = payload.cart.map((value) => {
      const row = asRecord(value);
      return {
        currency: readNullableText(row.currency, 3),
        lineTotal: readNullableNumber(row.line_total),
        notes: readNullableText(row.note, 500),
        productName: readNullableText(row.product, 200),
        productSlug: readNullableText(row.product_slug, 160),
        quantity: readNullableInteger(row.qty),
        serviceSlug: null,
        snapshot: row,
        unit: readNullableText(row.unit, 40),
        unitPrice: readNullableNumber(row.unit_price),
        variantName: readNullableText(row.variant, 200),
        variantSku: readNullableText(row.variant_sku, 160),
      };
    });
    if (items.length > 0) return items;
  }

  const product = readNullableText(payload.product, 200);
  const service = readNullableText(payload.service, 160);
  const serviceSlug = readNullableText(payload.service_code, 160) ?? service;
  const quantity = readNullableInteger(payload.qty);
  if (!product && !service && !payload.variant && quantity === null) return [];
  return [{
    currency: null,
    lineTotal: null,
    notes: readNullableText(payload.message, 500),
    productName: product,
    productSlug: null,
    quantity,
    serviceSlug,
    snapshot: {
      product: payload.product ?? null,
      qty: payload.qty ?? null,
      request_type: payload.request_type ?? null,
      service: payload.service ?? null,
      service_code: payload.service_code ?? null,
      service_name: payload.service_name ?? null,
      service_url: payload.service_url ?? null,
      variant: payload.variant ?? null,
    },
    unit: null,
    unitPrice: null,
    variantName: readNullableText(payload.variant, 200),
    variantSku: null,
  }];
}

function readRequestId(value: unknown): string | null {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)
    ? value
    : null;
}

function readText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function readNullableText(value: unknown, maxLength: number): string | null {
  const text = readText(value, maxLength);
  return text || null;
}

function readNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readNullableInteger(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function isUniqueError(error: unknown): boolean {
  return error instanceof Error && /unique|constraint/i.test(error.message);
}
