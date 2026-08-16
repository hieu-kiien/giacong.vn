import assert from "node:assert/strict";
import test from "node:test";
import { handleContactSubmission } from "../src/lib/contact-webhook.ts";
import { deliverQueuedLead } from "../src/lib/lead-delivery-worker.ts";

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