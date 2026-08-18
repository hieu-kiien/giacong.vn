import type { D1DatabaseLike, LeadStatus } from "./admin-data.ts";

export interface AdminLeadDetail {
  assignedTo: string | null;
  companyName: string | null;
  country: string | null;
  createdAt: string;
  deliveredAt: string | null;
  deliveryAttempts: number;
  deliveryError: string | null;
  deliveryStatus: "pending" | "queued" | "delivered" | "failed";
  email: string | null;
  events: AdminLeadEvent[];
  fullName: string;
  id: string;
  items: AdminLeadItem[];
  message: string | null;
  payload: unknown;
  phone: string | null;
  publicReference: string | null;
  requestId: string | null;
  source: string;
  status: LeadStatus;
  updatedAt: string;
  webhookReference: string | null;
}

export interface AdminLeadItem {
  currency: string | null;
  id: string;
  lineTotal: number | null;
  notes: string | null;
  productName: string | null;
  productSlug: string | null;
  quantity: number | null;
  serviceSlug: string | null;
  snapshot: unknown;
  unit: string | null;
  unitPrice: number | null;
  variantName: string | null;
  variantSku: string | null;
}

export interface AdminLeadEvent {
  actorSubject: string | null;
  createdAt: string;
  eventType: string;
  id: string;
  message: string | null;
}

interface LeadRow {
  assigned_to: string | null;
  company_name: string | null;
  country: string | null;
  created_at: string;
  delivered_at: string | null;
  delivery_attempts: number;
  delivery_error: string | null;
  delivery_status: AdminLeadDetail["deliveryStatus"];
  email: string | null;
  full_name: string;
  id: string;
  message: string | null;
  payload_json: string;
  phone: string | null;
  public_reference: string | null;
  request_id: string | null;
  source: string;
  status: LeadStatus;
  updated_at: string;
  webhook_reference: string | null;
}

interface ItemRow {
  currency: string | null;
  id: string;
  line_total: number | null;
  notes: string | null;
  product_name: string | null;
  product_slug: string | null;
  quantity: number | null;
  service_slug: string | null;
  snapshot_json: string;
  unit: string | null;
  unit_price: number | null;
  variant_name: string | null;
  variant_sku: string | null;
}

interface EventRow {
  actor_subject: string | null;
  created_at: string;
  event_type: string;
  id: string;
  message: string | null;
}

export async function getAdminLeadDetail(
  database: D1DatabaseLike,
  leadId: string,
): Promise<AdminLeadDetail | null> {
  const lead = await database.prepare(`
    SELECT id, public_reference, request_id, status, full_name, company_name,
      email, phone, country, message, source, delivery_status, assigned_to,
      payload_json, webhook_reference, delivery_error, delivered_at,
      delivery_attempts, created_at, updated_at
    FROM leads
    WHERE id = ?
    LIMIT 1
  `).bind(leadId).first<LeadRow>();
  if (!lead) return null;

  const [items, events] = await Promise.all([
    database.prepare(`
      SELECT id, product_slug, service_slug, quantity, unit, notes,
        variant_sku, product_name, variant_name, unit_price, line_total,
        currency, snapshot_json
      FROM lead_items
      WHERE lead_id = ?
      ORDER BY rowid ASC
    `).bind(leadId).all<ItemRow>(),
    database.prepare(`
      SELECT id, actor_subject, event_type, message, created_at
      FROM lead_events
      WHERE lead_id = ?
      ORDER BY created_at DESC, rowid DESC
      LIMIT 50
    `).bind(leadId).all<EventRow>(),
  ]);

  return {
    assignedTo: lead.assigned_to,
    companyName: lead.company_name,
    country: lead.country,
    createdAt: lead.created_at,
    deliveredAt: lead.delivered_at,
    deliveryAttempts: nonNegativeInteger(lead.delivery_attempts),
    deliveryError: lead.delivery_error,
    deliveryStatus: lead.delivery_status,
    email: lead.email,
    events: events.results.map((event) => ({
      actorSubject: event.actor_subject,
      createdAt: event.created_at,
      eventType: event.event_type,
      id: event.id,
      message: event.message,
    })),
    fullName: lead.full_name,
    id: lead.id,
    items: items.results.map((item) => ({
      currency: item.currency,
      id: item.id,
      lineTotal: item.line_total,
      notes: item.notes,
      productName: item.product_name,
      productSlug: item.product_slug,
      quantity: item.quantity,
      serviceSlug: item.service_slug,
      snapshot: parseJson(item.snapshot_json),
      unit: item.unit,
      unitPrice: item.unit_price,
      variantName: item.variant_name,
      variantSku: item.variant_sku,
    })),
    message: lead.message,
    payload: parseJson(lead.payload_json),
    phone: lead.phone,
    publicReference: lead.public_reference,
    requestId: lead.request_id,
    source: lead.source,
    status: lead.status,
    updatedAt: lead.updated_at,
    webhookReference: lead.webhook_reference,
  };
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function nonNegativeInteger(value: number): number {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}
