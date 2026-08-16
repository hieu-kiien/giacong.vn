import {
  deliverToWebhook,
  type ContactQueuedPayload,
} from "./contact-webhook.ts";

interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  run(): Promise<unknown>;
}

export interface LeadDeliveryDatabase {
  prepare(query: string): D1PreparedStatementLike;
}

export interface LeadDeliveryEnvironment {
  GOOGLE_SHEETS_WEBHOOK_SECRET?: string;
  GOOGLE_SHEETS_WEBHOOK_URL?: string;
}

export interface LeadDeliveryMessage {
  leadId: string;
  payload: ContactQueuedPayload;
}

export async function deliverQueuedLead(
  message: LeadDeliveryMessage,
  environment: LeadDeliveryEnvironment,
  database: LeadDeliveryDatabase,
): Promise<void> {
  let response: Response;
  try {
    response = await deliverToWebhook(message.payload, {
      environment: environment as Readonly<Record<string, string | undefined>>,
    });
  } catch (error) {
    const failureReason = error instanceof Error ? error.message.slice(0, 500) : "secondary_sink_exception";
    await markDelivery(database, message.leadId, "failed", null, failureReason);
    throw error;
  }

  if (!response.ok) {
    const error = `secondary_sink_http_${response.status}`;
    await markDelivery(database, message.leadId, "failed", null, error);
    throw new Error(error);
  }

  let reference: string | null = null;
  try {
    const body = await response.json() as { reference?: unknown };
    reference = typeof body.reference === "string" && body.reference.trim()
      ? body.reference.trim().slice(0, 200)
      : null;
  } catch {
    // The delivery itself succeeded; reference metadata is optional.
  }
  await markDelivery(database, message.leadId, "delivered", reference, null);
}

async function markDelivery(
  database: LeadDeliveryDatabase,
  leadId: string,
  status: "delivered" | "failed",
  webhookReference: string | null,
  error: string | null,
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
  `).bind(status, webhookReference, error, status, leadId).run();
}