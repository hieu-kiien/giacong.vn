import assert from "node:assert/strict";
import test from "node:test";
import { handleContactSubmission } from "../src/lib/contact-webhook.ts";
import { deliverQueuedLead } from "../src/lib/lead-delivery-worker.ts";
import { createQueuedLeadReplayGuard } from "../src/lib/lead-queue-replay.ts";

function formRequest() {
  const form = new FormData();
  form.set("name", "Nguyễn Demo");
  form.set("phone", "0912345678");
  form.set("source", "queue-test");
  return new Request("https://giacong.vn/api/contact", { method: "POST", body: form });
}

test("persists before enqueueing and returns queued without synchronous webhook delivery", async () => {
  const sent: unknown[] = [];
  const statuses: string[] = [];
  let webhookCalls = 0;
  const response = await handleContactSubmission(formRequest(), {
    environment: {},
    fetch: async () => {
      webhookCalls += 1;
      return Response.json({ ok: true, reference: "unexpected" });
    },
    leadPersistence: {
      async create() {
        return {
          deliveryStatus: "pending" as const,
          isDuplicate: false,
          leadId: "lead-queue-test",
          publicReference: "LEAD-QUEUE",
          webhookReference: null,
        };
      },
      async markDelivery(_leadId, result) {
        statuses.push(result.status);
      },
    },
    leadQueue: {
      async send(message) {
        sent.push(message);
      },
    },
  });
  const body = await response.json() as { deliveryStatus?: string; ok?: boolean };
  assert.equal(response.status, 202);
  assert.equal(body.ok, true);
  assert.equal(body.deliveryStatus, "queued");
  assert.equal(webhookCalls, 0);
  assert.deepEqual(statuses, ["queued"]);
  assert.equal(sent.length, 1);
});

test("queue-backed form delivery persists and sends the same generated request id", async () => {
  let persistedPayload: unknown;
  const sent: Array<{ leadId: string; payload: unknown }> = [];
  const delivery = createQueuedLeadReplayGuard({
    async create(payload) {
      persistedPayload = payload;
      return {
        deliveryStatus: "pending" as const,
        isDuplicate: false,
        leadId: "lead-form-request-id",
        publicReference: "LEAD-FORM-ID",
        webhookReference: null,
      };
    },
    async markDelivery() {},
  }, {
    async send(message) {
      sent.push({ leadId: message.leadId, payload: message.payload });
    },
  });

  const response = await handleContactSubmission(formRequest(), {
    environment: {},
    leadPersistence: delivery.leadPersistence,
    leadQueue: delivery.leadQueue,
  });
  assert.equal(response.status, 202);

  const persisted = persistedPayload as Record<string, unknown>;
  const sentPayload = sent[0]?.payload as Record<string, unknown>;
  const requestId = String(persisted.request_id ?? "");
  assert.match(requestId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.leadId, "lead-form-request-id");
  assert.equal(sentPayload.request_id, requestId);
});

test("a duplicate already queued in D1 does not enqueue or increment delivery bookkeeping again", async () => {
  const sent: unknown[] = [];
  const statuses: string[] = [];
  const delivery = createQueuedLeadReplayGuard({
    async create() {
      return {
        deliveryStatus: "queued" as const,
        isDuplicate: true,
        leadId: "lead-queued-replay",
        publicReference: "LEAD-QUEUED",
        webhookReference: null,
      };
    },
    async markDelivery(_leadId, result) {
      statuses.push(result.status);
    },
  }, {
    async send(message) {
      sent.push(message);
    },
  });

  const response = await handleContactSubmission(formRequest(), {
    environment: {},
    leadPersistence: delivery.leadPersistence,
    leadQueue: delivery.leadQueue,
  });
  const body = await response.json() as { deliveryStatus?: string; ok?: boolean; reference?: string };

  assert.equal(response.status, 202);
  assert.equal(body.ok, true);
  assert.equal(body.deliveryStatus, "queued");
  assert.equal(body.reference, "LEAD-QUEUED");
  assert.deepEqual(sent, []);
  assert.deepEqual(statuses, []);
});

test("a duplicate failed delivery remains retryable through the queue", async () => {
  const sent: unknown[] = [];
  const statuses: string[] = [];
  const delivery = createQueuedLeadReplayGuard({
    async create() {
      return {
        deliveryStatus: "failed" as const,
        isDuplicate: true,
        leadId: "lead-failed-replay",
        publicReference: "LEAD-FAILED",
        webhookReference: null,
      };
    },
    async markDelivery(_leadId, result) {
      statuses.push(result.status);
    },
  }, {
    async send(message) {
      sent.push(message);
    },
  });

  const response = await handleContactSubmission(formRequest(), {
    environment: {},
    leadPersistence: delivery.leadPersistence,
    leadQueue: delivery.leadQueue,
  });
  const body = await response.json() as { deliveryStatus?: string; ok?: boolean };

  assert.equal(response.status, 202);
  assert.equal(body.ok, true);
  assert.equal(body.deliveryStatus, "queued");
  assert.equal(sent.length, 1);
  assert.deepEqual(statuses, ["queued"]);
});

test("queue consumer marks failed delivery and throws for Cloudflare retry", async () => {
  const updates: unknown[][] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ ok: false }, { status: 502 });
  try {
    await assert.rejects(
      deliverQueuedLead(
        { leadId: "lead-queue-test", payload: { email: "", message: "", name: "Nguyễn Demo", phone: "0912345678", product: "", qty: "", request_type: "Tư vấn dịch vụ", service: "", source: "queue-test", variant: "" } },
        { GOOGLE_SHEETS_WEBHOOK_URL: "https://script.google.com/macros/s/demo/exec" },
        {
          prepare() {
            const statement = {
              bind(...values: unknown[]) {
                updates.push(values);
                return statement;
              },
              run: async () => undefined,
            };
            return statement;
          },
        },
      ),
      /secondary_sink_http_502/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual(updates[0]?.slice(0, 2), ["failed", null]);
});
