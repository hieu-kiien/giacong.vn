import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(pathname) {
  return readFile(new URL(pathname, root), "utf8");
}

test("G3 acceptance is chained after G2 and never deploys preview traffic", async () => {
  const workflow = await source("../../.github/workflows/cloudflare-staging-lead-delivery-acceptance-once.yml");

  assert.match(workflow, /Cloudflare staging News media acceptance once/);
  assert.match(workflow, /workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /cloudflare-staging-lead-delivery-acceptance-once\.yml/);
  assert.match(workflow, /G2_PREVIEW_ALIAS: g3-lead/);
  assert.match(workflow, /prepare-g2-preview-access\.mjs/);
  assert.match(workflow, /prepare-g3-preview-wrangler\.mjs/);
  assert.match(workflow, /opennextjs-cloudflare upload[^\n]*--preview-alias=g3-lead/);
  assert.match(workflow, /manage-g2-preview-routing\.mjs open/);
  assert.match(workflow, /if: always\(\) && steps\.gate\.outputs\.should_run == 'true'/);
  assert.match(workflow, /manage-g2-preview-routing\.mjs restore/);
  assert.match(workflow, /staging-lead-delivery-operator-qa\.mjs/);
  assert.match(workflow, /test "\$active" = "\$ACTIVE_STAGING_VERSION"/);
  assert.doesNotMatch(workflow, /opennextjs-cloudflare deploy/);
  assert.doesNotMatch(workflow, /cf:deploy/);
  assert.doesNotMatch(workflow, /--env=production/);
});

test("G3 preview changes staging-only admission while preserving production vars", async () => {
  const prepare = await source("scripts/prepare-g3-preview-wrangler.mjs");
  const policy = await source("src/lib/staging-direct-qa.ts");

  assert.match(prepare, /access-protected-g3-preview/);
  assert.match(prepare, /config\.env\.staging\.preview_urls = true/);
  assert.match(prepare, /config\.env\.staging\.workers_dev = false/);
  assert.match(prepare, /Preparing G3 preview config must not alter Production POLICY_AUD/);
  assert.match(prepare, /Preparing G3 preview config must not alter Production ADMIN_HOSTNAME/);
  assert.match(prepare, /Preparing G3 preview config must not alter Production STAGING_DIRECT_QA_MODE/);

  assert.match(policy, /STAGING_G3_PREVIEW_MODE = "access-protected-g3-preview"/);
  assert.match(policy, /pathname === "\/api\/gui-yeu-cau\/xac-thuc" \|\| pathname === "\/api\/contact"/);
  assert.match(policy, /method === "GET" && isLeadAdminApiPath\(pathname\)/);
});

test("G3 operator proves one real delivery, Admin visibility, invalid input guard and exact replay idempotency", async () => {
  const operator = await source("scripts/staging-lead-delivery-operator-qa.mjs");

  assert.match(operator, /staging-g3-queue-acceptance/);
  assert.match(operator, /\/api\/gui-yeu-cau\/xac-thuc/);
  assert.match(operator, /\/api\/contact/);
  assert.match(operator, /deliveryStatus, "queued"/);
  assert.match(operator, /waitForDeliveredLead\(requestId\)/);
  assert.match(operator, /delivery_status, "delivered"/);
  assert.match(operator, /webhook_reference/);
  assert.match(operator, /\/api\/admin\/leads\//);
  assert.match(operator, /Invalid contact payload persisted a D1 lead/);
  assert.match(operator, /Exact replay created a duplicate D1 lead/);
  assert.match(operator, /Exact replay enqueued or delivered the request again/);
  assert.match(operator, /delivery_attempts/);
  assert.match(operator, /request_id/);
});

test("staging runtime keeps a real Queue producer/consumer and visible failure bookkeeping", async () => {
  const wrangler = await source("wrangler.jsonc");
  const worker = await source("src/lib/lead-delivery-worker.ts");
  const contact = await source("src/lib/contact-webhook.ts");
  const adminLead = await source("src/lib/admin-lead-detail-data.ts");

  assert.match(wrangler, /"binding": "GIACONG_VN_LEAD_QUEUE"/);
  assert.match(wrangler, /"queue": "giacong-vn-leads-staging"/);
  assert.match(wrangler, /"dead_letter_queue": "giacong-vn-leads-staging-dlq"/);
  assert.match(worker, /markDelivery\(database, message\.leadId, "failed"/);
  assert.match(worker, /markDelivery\(database, message\.leadId, "delivered"/);
  assert.match(contact, /"script\.google\.com"/);
  assert.match(contact, /"script\.googleusercontent\.com"/);
  assert.match(contact, /MAX_REDIRECTS = 3/);
  assert.match(adminLead, /deliveryError: string \| null/);
  assert.match(adminLead, /deliveryAttempts: number/);
  assert.match(adminLead, /webhookReference: string \| null/);
});
