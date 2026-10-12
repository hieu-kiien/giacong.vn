import type { D1DatabaseLike } from "./admin-data.ts";
import type { ContactLeadQueue, ContactQueuedPayload } from "./contact-webhook.ts";

/** Reuses the canonical D1 snapshot; never re-prices or creates another request. */
export async function retryFailedLead(database: D1DatabaseLike, queue: ContactLeadQueue, leadId: string, actorSubject: string, requestId: string): Promise<"queued" | "delivered" | "busy" | "missing"> {
  const row = await database.prepare("SELECT request_id, payload_json, delivery_status FROM leads WHERE id = ?")
    .bind(leadId).first<{ request_id: string; payload_json: string; delivery_status: string }>();
  if (!row) return "missing";
  if (row.delivery_status === "delivered") return "delivered";
  if (row.delivery_status !== "failed" && row.delivery_status !== "queued") return "busy";
  const storedPayload: unknown = JSON.parse(row.payload_json);
  if (!storedPayload || typeof storedPayload !== "object" || Array.isArray(storedPayload)
    || typeof row.request_id !== "string" || !row.request_id.trim()) {
    throw new Error("lead_retry_payload_invalid");
  }
  const snapshot = storedPayload as Record<string, unknown>;
  if (typeof snapshot.name !== "string" || typeof snapshot.phone !== "string"
    || (snapshot.request_id !== undefined && snapshot.request_id !== row.request_id)) {
    throw new Error("lead_retry_payload_invalid");
  }
  // Older canonical D1 snapshots predate request_id in payload_json. Restore the
  // idempotency key from the row without rewriting the historical snapshot.
  const payload = { ...snapshot, request_id: row.request_id } as ContactQueuedPayload;
  if (!isRetryableContactSnapshot(payload)) throw new Error("lead_retry_legacy_payload_unreconstructable");
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

function isRetryableContactSnapshot(payload: ContactQueuedPayload): boolean {
  if (typeof payload.email !== "string" || typeof payload.message !== "string" || typeof payload.source !== "string") return false;
  if (payload.request_type === "Tư vấn dịch vụ") {
    return typeof payload.service === "string" && payload.service.trim().length > 0
      && payload.product === "" && payload.variant === "" && payload.qty === "";
  }
  if (payload.request_type !== "Đặt sản phẩm" && payload.request_type !== "Tư vấn số lượng lớn") return false;
  if (payload.service !== "" || payload.product === "") return false;
  if ("cart" in payload && Array.isArray(payload.cart)) {
    return payload.cart.length > 0 && payload.cart.length <= 20
      && typeof payload.cart_subtotal === "number" && typeof payload.cart_price_incomplete === "boolean"
      && payload.cart.every((line) => Number.isSafeInteger(line.index) && line.index > 0
        && Boolean(line.product) && Boolean(line.variant) && Boolean(line.unit)
        && Number.isSafeInteger(line.qty) && line.qty > 0 && typeof line.note === "string"
        && (line.unit_price === "" || Number.isFinite(line.unit_price))
        && (line.line_total === "" || Number.isFinite(line.line_total)));
  }
  return !("cart" in payload) && Boolean(payload.variant)
    && Number.isSafeInteger(payload.qty) && typeof payload.qty === "number" && payload.qty > 0;
}
