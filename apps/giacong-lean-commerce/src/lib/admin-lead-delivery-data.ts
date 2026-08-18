import type { D1DatabaseLike } from "./admin-data.ts";

export interface AdminLeadDeliveryDetails {
  deliveredAt: string | null;
  deliveryAttempts: number;
  deliveryError: string | null;
  webhookReference: string | null;
}

interface DeliveryRow {
  delivered_at: string | null;
  delivery_attempts: number;
  delivery_error: string | null;
  id: string;
  webhook_reference: string | null;
}

export async function getAdminLeadDeliveryDetails(
  database: D1DatabaseLike,
  leadIds: string[],
): Promise<Map<string, AdminLeadDeliveryDetails>> {
  const ids = Array.from(new Set(leadIds.filter(Boolean))).slice(0, 100);
  if (ids.length === 0) return new Map();

  const rows = await database.prepare(`
    SELECT id, delivery_attempts, delivery_error, webhook_reference, delivered_at
    FROM leads
    WHERE id IN (${ids.map(() => "?").join(", ")})
  `).bind(...ids).all<DeliveryRow>();

  return new Map(rows.results.map((row) => [row.id, {
    deliveredAt: row.delivered_at,
    deliveryAttempts: normalizeAttempts(row.delivery_attempts),
    deliveryError: row.delivery_error,
    webhookReference: row.webhook_reference,
  }]));
}

function normalizeAttempts(value: number): number {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}
