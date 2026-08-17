import type { D1DatabaseLike, D1PreparedStatementLike } from "./admin-data";

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

interface D1BatchDatabaseLike extends D1DatabaseLike {
  batch(statements: D1PreparedStatementLike[]): Promise<unknown[]>;
}

interface LeadRow {
  delivery_status: LeadDeliveryStatus;
  id: string;
  public_reference: string;
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

export function createLeadPersistence(database: D1DatabaseLike): LeadPersistence {
  return {
    create: (payload) => createLead(database, payload),
    markDelivery: (leadId, result) => markLeadDelivery(database, leadId, result),
  };
}

async function createLead(database: D1DatabaseLike, rawPayload: unknown): Promise<LeadPersistenceResult> {
  const payload = asRecord(rawPayload);
  const requestId = readRequestId(payload.request_id) ?? crypto.randomUUID();
  const existing = await findByRequestId(database, requestId);
  if (existing) return toPersistenceResult(existing, true);

  const leadId = crypto.randomUUID();
  const publicReference = `LEAD-${leadId.replaceAll("-", "").slice(0, 10).toUpperCase()}`;
  const items = extractItems(payload);
  const batchDatabase = requireBatch(database);

  const statements: D1PreparedStatementLike[] = [
    database.prepare(`
      INSERT INTO leads (
        id, public_reference, request_id, full_name, company_name, email, phone,
        country, message, source, delivery_status, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).bind(
      leadId,
      publicReference,
      requestId,
      readText(payload.name, 120) || "Khách hàng chưa cung cấp tên",
      readNullableText(payload.company_name, 160),
      readNullableText(payload.email, 254),
      readNullableText(payload.phone, 24),
      readNullableText(payload.country, 80),
      readNullableText(payload.message, 2_000),
      readText(payload.source, 200) || "request_form",
      JSON.stringify(payload),
    ),
  ];

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
    // Cloudflare D1 batch has transactional semantics: either the lead, every item
    // and the initial event commit together, or none of them do.
    await batchDatabase.batch(statements);
  } catch (error) {
    if (!isUniqueError(error)) throw error;
    const duplicate = await findByRequestId(database, requestId);
    if (duplicate) return toPersistenceResult(duplicate, true);
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
    SELECT id, public_reference, delivery_status, webhook_reference
    FROM leads
    WHERE request_id = ?
    LIMIT 1
  `).bind(requestId).first<LeadRow>();
}

function requireBatch(database: D1DatabaseLike): D1BatchDatabaseLike {
  const candidate = database as D1DatabaseLike & { batch?: D1BatchDatabaseLike["batch"] };
  if (typeof candidate.batch !== "function") {
    throw new Error("D1 batch() is required for atomic lead persistence.");
  }
  return candidate as D1BatchDatabaseLike;
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
  const quantity = readNullableInteger(payload.qty);
  if (!product && !service && !payload.variant && quantity === null) return [];
  return [{
    currency: null,
    lineTotal: null,
    notes: readNullableText(payload.message, 500),
    productName: product,
    productSlug: null,
    quantity,
    serviceSlug: service,
    snapshot: {
      product: payload.product ?? null,
      qty: payload.qty ?? null,
      request_type: payload.request_type ?? null,
      service: payload.service ?? null,
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
