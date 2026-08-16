import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { ContactLeadQueue } from "./contact-webhook.ts";
import type { ContactQueuedPayload } from "./contact-webhook.ts";

export interface CloudflareQueueLike {
  send(message: LeadQueueMessage): Promise<void>;
}

export interface LeadQueueMessage {
  leadId: string;
  payload: ContactQueuedPayload;
}

interface QueueEnv {
  GIACONG_VN_LEAD_QUEUE?: CloudflareQueueLike;
}

/**
 * Queue is optional during local development and before Cloudflare provisions
 * the named queue. Returning undefined preserves the synchronous delivery path.
 */
export function getLeadQueue(): ContactLeadQueue | undefined {
  try {
    const { env } = getCloudflareContext();
    const queue = (env as unknown as QueueEnv).GIACONG_VN_LEAD_QUEUE;
    if (!queue) return undefined;
    return {
      send: (message) => queue.send(message),
    };
  } catch {
    return undefined;
  }
}