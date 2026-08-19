import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const origin = requiredEnv("G3_STAGING_ORIGIN").replace(/\/$/, "");
const database = process.env.STAGING_DATABASE?.trim() || "giacong-vn-catalog-staging";
const accessClientId = requiredEnv("CLOUDFLARE_ACCESS_CLIENT_ID");
const accessClientSecret = requiredEnv("CLOUDFLARE_ACCESS_CLIENT_SECRET");
const serviceSubject = `service:${accessClientId}`;
const qaMemberId = "staging-lead-delivery-qa-service";
const evidencePath = process.env.G3_EVIDENCE_PATH?.trim() || "";
const accessHeaders = {
  "CF-Access-Client-Id": accessClientId,
  "CF-Access-Client-Secret": accessClientSecret,
};
const cartLines = [
  { parentSlug: "bot-gao-lut-xay-min", variantSku: "B2B-DEMO-BGL-05", quantity: 25 },
];

let qaMembershipOwned = false;
let evidence = null;
let acceptanceSucceeded = false;

console.log(`G3 lead delivery acceptance target: ${origin}`);

try {
  qaMembershipOwned = ensureQaAdminMembership();

  const cartResponse = await previewFetch("/api/gui-yeu-cau/xac-thuc", {
    method: "POST",
    json: { lines: cartLines },
  });
  const cartBody = await readJson(cartResponse);
  assert.equal(cartResponse.status, 200, `Cart revalidation returned HTTP ${cartResponse.status}: ${JSON.stringify(cartBody)}`);
  assert.equal(cartBody?.ok, true, "Cart revalidation did not return success.");
  assert.equal(cartBody?.cart?.isSubmittable, true, "G3 cart fixture is not submittable.");
  assert.match(cartBody?.cart?.snapshotToken ?? "", /^[0-9a-f]{64}$/i, "Cart revalidation did not return a valid snapshot token.");
  const snapshotToken = cartBody.cart.snapshotToken;

  const invalidRequestId = crypto.randomUUID();
  const invalidPayload = {
    email: "",
    lines: cartLines,
    message: "Controlled staging G3 invalid-input check.",
    name: "Staging G3 QA",
    phone: "0868408115",
    requestId: invalidRequestId,
    snapshotToken,
    source: "staging-g3-invalid-input",
  };
  const invalidResponse = await previewFetch("/api/contact", { method: "POST", json: invalidPayload });
  const invalidBody = await readJson(invalidResponse);
  assert.equal(invalidResponse.status, 400, `Invalid contact payload returned HTTP ${invalidResponse.status}: ${JSON.stringify(invalidBody)}`);
  assert.equal(invalidBody?.ok, false, "Invalid contact payload unexpectedly succeeded.");
  assert.equal(countLeadsByRequestId(invalidRequestId), 0, "Invalid contact payload persisted a D1 lead.");

  const requestId = crypto.randomUUID();
  const submission = {
    email: "qa+g3@kienhieu.id.vn",
    lines: cartLines,
    message: `Controlled staging-only G3 Queue delivery acceptance ${requestId}.`,
    name: "Staging G3 QA",
    phone: "0868408115",
    requestId,
    snapshotToken,
    source: "staging-g3-queue-acceptance",
  };

  const acceptedResponse = await previewFetch("/api/contact", { method: "POST", json: submission });
  const acceptedBody = await readJson(acceptedResponse);
  assert.equal(acceptedResponse.status, 202, `Contact intake returned HTTP ${acceptedResponse.status}: ${JSON.stringify(acceptedBody)}`);
  assert.equal(acceptedBody?.ok, true, "Contact intake did not accept the request.");
  assert.equal(acceptedBody?.deliveryStatus, "queued", `Real staging Queue path was not used: ${JSON.stringify(acceptedBody)}`);
  assert.match(acceptedBody?.reference ?? "", /^LEAD-[A-Z0-9]+$/, "Initial intake did not return the durable D1 public reference.");

  const delivered = await waitForDeliveredLead(requestId);
  assert.equal(delivered.delivery_status, "delivered", "Queued lead did not reach delivered state.");
  assert.equal(delivered.public_reference, acceptedBody.reference, "D1 public reference drifted after Queue delivery.");
  assert.match(delivered.webhook_reference ?? "", /^YC-[A-Z0-9-]+$/i, "Secondary delivery did not persist a Google Apps Script reference.");
  assert.equal(delivered.delivery_error, null, "Delivered lead retained a delivery error.");
  assert.ok(delivered.delivered_at, "Delivered lead did not persist delivered_at.");
  assert.ok(Number(delivered.delivery_attempts) >= 2, "Delivery bookkeeping did not record enqueue + consumer delivery transitions.");
  assert.equal(countLeadsByRequestId(requestId), 1, "Request id did not map to exactly one durable lead.");

  const itemState = readLeadItemState(delivered.id);
  assert.equal(itemState.itemCount, 1, "G3 accepted request did not persist exactly one lead item.");
  assert.equal(itemState.eventCount >= 1, true, "G3 accepted request did not persist its initial lead event.");

  const adminResponse = await previewFetch(`/api/admin/leads/${encodeURIComponent(delivered.id)}`);
  const adminBody = await readJson(adminResponse);
  assert.equal(adminResponse.status, 200, `Admin lead detail returned HTTP ${adminResponse.status}: ${JSON.stringify(adminBody)}`);
  assert.equal(adminBody?.ok, true, "Admin lead detail did not return a success envelope.");
  const adminLead = adminBody?.data?.lead;
  assert.equal(adminLead?.id, delivered.id, "Admin inbox returned a different lead id.");
  assert.equal(adminLead?.requestId, requestId, "Admin inbox request id mapping drifted.");
  assert.equal(adminLead?.publicReference, delivered.public_reference, "Admin inbox public reference drifted.");
  assert.equal(adminLead?.webhookReference, delivered.webhook_reference, "Admin inbox secondary reference drifted.");
  assert.equal(adminLead?.deliveryStatus, "delivered", "Admin inbox does not show delivered status.");
  assert.equal(adminLead?.deliveryError, null, "Admin inbox shows a delivery error for a delivered lead.");
  assert.ok(Number(adminLead?.deliveryAttempts) >= 2, "Admin inbox does not expose delivery attempts.");

  const attemptsBeforeReplay = Number(delivered.delivery_attempts);
  const replayResponse = await previewFetch("/api/contact", { method: "POST", json: submission });
  const replayBody = await readJson(replayResponse);
  assert.equal(replayResponse.status, 202, `Exact replay returned HTTP ${replayResponse.status}: ${JSON.stringify(replayBody)}`);
  assert.equal(replayBody?.ok, true, "Exact replay was not accepted idempotently.");
  assert.equal(replayBody?.deliveryStatus, "delivered", "Exact replay did not resolve to the already delivered request.");
  assert.equal(replayBody?.reference, delivered.webhook_reference, "Exact replay did not return the stable secondary reference.");

  await sleep(5000);
  const afterReplay = readLeadByRequestId(requestId);
  assert.ok(afterReplay, "Durable lead disappeared after replay.");
  assert.equal(countLeadsByRequestId(requestId), 1, "Exact replay created a duplicate D1 lead.");
  assert.equal(afterReplay.id, delivered.id, "Exact replay changed the durable lead id.");
  assert.equal(afterReplay.webhook_reference, delivered.webhook_reference, "Exact replay changed the secondary reference.");
  assert.equal(Number(afterReplay.delivery_attempts), attemptsBeforeReplay, "Exact replay enqueued or delivered the request again.");
  assert.equal(afterReplay.delivery_status, "delivered", "Exact replay changed the delivered status.");

  evidence = {
    adminInbox: {
      deliveryAttempts: Number(adminLead.deliveryAttempts),
      deliveryStatus: adminLead.deliveryStatus,
      visible: true,
    },
    deliveryAttempts: attemptsBeforeReplay,
    deliveryStatus: delivered.delivery_status,
    deliveredAt: delivered.delivered_at,
    invalidInputHttpStatus: invalidResponse.status,
    invalidInputPersistedLeadCount: 0,
    itemCount: itemState.itemCount,
    leadId: delivered.id,
    observedAt: new Date().toISOString(),
    publicReference: delivered.public_reference,
    queueAcceptedStatus: acceptedBody.deliveryStatus,
    replay: {
      deliveryAttemptsAfter: Number(afterReplay.delivery_attempts),
      deliveryAttemptsBefore: attemptsBeforeReplay,
      durableLeadCount: countLeadsByRequestId(requestId),
      httpStatus: replayResponse.status,
      stableLeadId: afterReplay.id === delivered.id,
      stableWebhookReference: afterReplay.webhook_reference === delivered.webhook_reference,
      status: replayBody.deliveryStatus,
    },
    requestId,
    source: submission.source,
    webhookReference: delivered.webhook_reference,
  };
  acceptanceSucceeded = true;
  console.log(`G3 real Queue + secondary delivery acceptance passed for ${delivered.public_reference}.`);
} finally {
  const membershipRemoved = cleanupQaMembership();
  if (evidence) evidence.membershipRemoved = membershipRemoved;
  if (evidencePath && evidence) {
    writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  }
  if (!acceptanceSucceeded) {
    console.error("G3 lead delivery acceptance did not complete successfully.");
  }
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for G3 lead delivery acceptance.`);
  return value;
}

function ensureQaAdminMembership() {
  const existing = d1Results(`
    SELECT id, access_subject, role, is_active
    FROM admin_members
    WHERE access_subject = ${sqlString(serviceSubject)}
    LIMIT 1;
  `)[0] ?? null;

  if (existing) {
    assert.equal(Number(existing.is_active), 1, "Existing G3 service admin membership is inactive.");
    console.log(`Using existing staging admin membership ${existing.id} for Access service identity.`);
    return existing.id === qaMemberId;
  }

  d1Execute(`
    INSERT INTO admin_members (id, access_subject, email, display_name, role, is_active)
    VALUES (
      ${sqlString(qaMemberId)},
      ${sqlString(serviceSubject)},
      NULL,
      'Staging lead delivery QA service',
      'viewer',
      1
    );
  `);
  const inserted = d1Results(`
    SELECT id, access_subject, role, is_active
    FROM admin_members
    WHERE id = ${sqlString(qaMemberId)}
    LIMIT 1;
  `)[0] ?? null;
  assert.equal(inserted?.access_subject, serviceSubject, "G3 service admin membership insert did not persist.");
  assert.equal(inserted?.role, "viewer", "G3 service admin membership role drifted.");
  console.log(`Created temporary staging admin membership ${qaMemberId}.`);
  return true;
}

function cleanupQaMembership() {
  if (!qaMembershipOwned) return false;
  d1Execute(`
    DELETE FROM admin_members
    WHERE id = ${sqlString(qaMemberId)}
      AND access_subject = ${sqlString(serviceSubject)};
  `);
  const remaining = d1Results(`
    SELECT COUNT(*) AS total
    FROM admin_members
    WHERE id = ${sqlString(qaMemberId)}
      AND access_subject = ${sqlString(serviceSubject)};
  `)[0]?.total;
  assert.equal(Number(remaining ?? -1), 0, "Temporary G3 service admin membership cleanup failed.");
  return true;
}

async function waitForDeliveredLead(requestId) {
  let last = null;
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    last = readLeadByRequestId(requestId);
    if (last?.delivery_status === "delivered") return last;
    if (last?.delivery_status === "failed") {
      console.log(`G3 delivery attempt ${attempt}/30 is currently failed and eligible for Queue retry: ${last.delivery_error ?? "unknown_error"}.`);
    } else {
      console.log(`Waiting for G3 Queue delivery ${attempt}/30: ${last?.delivery_status ?? "lead-not-visible-yet"}.`);
    }
    await sleep(3000);
  }
  throw new Error(`G3 Queue delivery did not reach delivered state: ${JSON.stringify(last)}`);
}

function readLeadByRequestId(requestId) {
  return d1Results(`
    SELECT id, public_reference, request_id, delivery_status, webhook_reference,
      delivery_error, delivered_at, delivery_attempts, source
    FROM leads
    WHERE request_id = ${sqlString(requestId)}
    LIMIT 1;
  `)[0] ?? null;
}

function countLeadsByRequestId(requestId) {
  const value = d1Results(`
    SELECT COUNT(*) AS total
    FROM leads
    WHERE request_id = ${sqlString(requestId)};
  `)[0]?.total;
  return Number(value ?? 0);
}

function readLeadItemState(leadId) {
  const payload = d1Execute(`
    SELECT COUNT(*) AS total
    FROM lead_items
    WHERE lead_id = ${sqlString(leadId)};

    SELECT COUNT(*) AS total
    FROM lead_events
    WHERE lead_id = ${sqlString(leadId)};
  `);
  assert.ok(Array.isArray(payload) && payload.length >= 2, "G3 lead item/event query returned an unexpected shape.");
  return {
    itemCount: Number(payload[0]?.results?.[0]?.total ?? 0),
    eventCount: Number(payload[1]?.results?.[0]?.total ?? 0),
  };
}

async function previewFetch(pathname, options = {}) {
  const url = new URL(pathname, `${origin}/`);
  const headers = new Headers(options.headers ?? {});
  for (const [key, value] of Object.entries(accessHeaders)) headers.set(key, value);

  let body = options.body;
  if (Object.prototype.hasOwnProperty.call(options, "json")) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.json);
  }

  return fetch(url, {
    method: options.method ?? "GET",
    headers,
    body,
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });
}

async function readJson(response) {
  return response.json().catch(() => null);
}

function d1Results(command) {
  const payload = d1Execute(command);
  assert.ok(Array.isArray(payload) && payload.length >= 1, "D1 query returned an unexpected payload.");
  return payload[0]?.results ?? [];
}

function d1Execute(command) {
  const output = execFileSync(
    "npx",
    [
      "--yes",
      "wrangler@4.115.0",
      "d1",
      "execute",
      database,
      "--remote",
      "--json",
      `--command=${command}`,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  return JSON.parse(output);
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
