import type {
  ContactLeadPersistence,
  ContactLeadQueue,
  ContactQueuedPayload,
} from "./contact-webhook.ts";

export interface QueuedLeadReplayGuard {
  leadPersistence: ContactLeadPersistence;
  leadQueue: ContactLeadQueue | undefined;
}

interface QueuedPayloadSnapshot {
  leadId: string;
  payload: ContactQueuedPayload;
}

/**
 * A browser retry can replay the same durable request while its first Queue
 * message is still waiting for a consumer. D1 already tells us that delivery
 * is queued, so sending the same message again only increases duplicate risk.
 *
 * Queue-backed form submissions also receive a stable request_id before they
 * are persisted and enqueued. The secondary Apps Script sink uses that key to
 * deduplicate Cloudflare Queue retries, including legacy form payloads that do
 * not carry a client-generated request ID.
 *
 * Failed deliveries deliberately remain retryable. When no Queue binding is
 * available we preserve the existing synchronous fallback behavior.
 */
export function createQueuedLeadReplayGuard(
  persistence: ContactLeadPersistence,
  queue: ContactLeadQueue | undefined,
): QueuedLeadReplayGuard {
  let queuedReplayLeadId: string | null = null;
  let queuedPayload: QueuedPayloadSnapshot | null = null;

  const leadPersistence: ContactLeadPersistence = {
    async create(payload) {
      const persistedPayload = queue ? ensureQueueRequestId(payload) : payload;
      const result = await persistence.create(persistedPayload);
      queuedReplayLeadId = queue
        && result.isDuplicate
        && result.deliveryStatus === "queued"
        ? result.leadId
        : null;
      queuedPayload = queue
        ? { leadId: result.leadId, payload: persistedPayload as ContactQueuedPayload }
        : null;
      return result;
    },
    async markDelivery(leadId, result) {
      if (queuedReplayLeadId === leadId && result.status === "queued") {
        queuedReplayLeadId = null;
        clearQueuedPayload(leadId);
        return;
      }
      if (queuedReplayLeadId === leadId) queuedReplayLeadId = null;
      clearQueuedPayload(leadId);
      await persistence.markDelivery(leadId, result);
    },
  };

  const leadQueue: ContactLeadQueue | undefined = queue
    ? {
        async send(message) {
          if (queuedReplayLeadId === message.leadId) return;
          const payload = queuedPayload?.leadId === message.leadId
            ? queuedPayload.payload
            : message.payload;
          clearQueuedPayload(message.leadId);
          await queue.send({ ...message, payload });
        },
      }
    : undefined;

  return { leadPersistence, leadQueue };

  function clearQueuedPayload(leadId: string) {
    if (queuedPayload?.leadId === leadId) queuedPayload = null;
  }
}

function ensureQueueRequestId(payload: unknown): unknown {
  if (!isRecord(payload)) return payload;
  if (typeof payload.request_id === "string" && payload.request_id.trim()) return payload;
  return { ...payload, request_id: crypto.randomUUID() };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
