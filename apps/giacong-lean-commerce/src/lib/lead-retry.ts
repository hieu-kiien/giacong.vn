import type { D1DatabaseLike } from "./admin-data.ts";
import type { ContactLeadQueue, ContactQueuedPayload } from "./contact-webhook.ts";

/** Reuses the canonical D1 snapshot; never re-prices or creates another request. */
export async function retryFailedLead(database: D1DatabaseLike, queue: ContactLeadQueue, leadId: string, actorSubject: string, requestId: string): Promise<"queued" | "delivered" | "busy" | "missing"> {
  const row = await database.prepare("SELECT request_id, payload_json, delivery_status FROM leads WHERE id = ?")
    .bind(leadId).first<{ request_id: string; payload_json: string; delivery_status: string }>();
  if (!row) return "missing";
  if (row.delivery_status === "delivered") return "delivered";
  if (row.delivery_status !== "failed" && row.delivery_status !== "queued") return "busy";
  const payload: unknown = JSON.parse(row.payload_json);
  if (!payload || typeof payload !== "object" || !("request_id" in payload) || payload.request_id !== row.request_id
    || !("name" in payload) || typeof payload.name !== "string" || !("phone" in payload) || typeof payload.phone !== "string") {
    throw new Error("lead_retry_payload_invalid");
  }
  // A stale lease can be reclaimed if the previous request stopped before enqueueing.
  const claimed = await database.prepare("UPDATE leads SET delivery_status = 'queued', delivery_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND (delivery_status = 'failed' OR (delivery_status = 'queued' AND datetime(updated_at) <= datetime('now', '-10 minutes'))) RETURNING id")
    .bind(leadId).first<{ id: string }>();
  if (!claimed) return "busy";
  try {
    await database.prepare("INSERT INTO lead_events (id, lead_id, actor_subject, event_type, message) VALUES (?, ?, ?, 'delivery_retry_requested', ?)")
      .bind(requestId, leadId, actorSubject, "Gửi lại cùng mã yêu cầu; dữ liệu gốc được giữ nguyên.").run();
    await queue.send({ leadId, payload: payload as ContactQueuedPayload });
  } catch (error) {
    await database.prepare("UPDATE leads SET delivery_status = 'failed', delivery_error = 'queue_enqueue_failed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND delivery_status = 'queued'")
      .bind(leadId).run();
    throw error;
  }
  return "queued";
}
