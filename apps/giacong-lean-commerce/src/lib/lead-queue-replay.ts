import type {
  ContactLeadPersistence,
  ContactLeadQueue,
} from "./contact-webhook.ts";

export interface QueuedLeadReplayGuard {
  leadPersistence: ContactLeadPersistence;
  leadQueue: ContactLeadQueue | undefined;
}

/**
 * A browser retry can replay the same durable request while its first Queue
 * message is still waiting for a consumer. D1 already tells us that delivery
 * is queued, so sending the same message again only increases duplicate risk.
 *
 * Failed deliveries deliberately remain retryable. When no Queue binding is
 * available we preserve the existing synchronous fallback behavior.
 */
export function createQueuedLeadReplayGuard(
  persistence: ContactLeadPersistence,
  queue: ContactLeadQueue | undefined,
): QueuedLeadReplayGuard {
  let queuedReplayLeadId: string | null = null;

  const leadPersistence: ContactLeadPersistence = {
    async create(payload) {
      const result = await persistence.create(payload);
      queuedReplayLeadId = queue
        && result.isDuplicate
        && result.deliveryStatus === "queued"
        ? result.leadId
        : null;
      return result;
    },
    async markDelivery(leadId, result) {
      if (queuedReplayLeadId === leadId && result.status === "queued") {
        queuedReplayLeadId = null;
        return;
      }
      if (queuedReplayLeadId === leadId) queuedReplayLeadId = null;
      await persistence.markDelivery(leadId, result);
    },
  };

  const leadQueue: ContactLeadQueue | undefined = queue
    ? {
        async send(message) {
          if (queuedReplayLeadId === message.leadId) return;
          await queue.send(message);
        },
      }
    : undefined;

  return { leadPersistence, leadQueue };
}
