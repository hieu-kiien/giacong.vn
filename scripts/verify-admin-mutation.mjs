import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";

const ETAG = '"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"';
const NEXT_ETAG = '"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"';
const snapshot = {
  published: true,
  variants: [{
    id: 21,
    published: true,
    unit: "gói",
    moq: 10,
    quantity_step: 5,
    contact_from_quantity: 30,
    tier_prices: [
      { min_quantity: 10, unit_price: 10000 },
      { min_quantity: 20, unit_price: 9000 },
    ],
  }],
};

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function freePort() {
  const server = createNetServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}
async function waitFor(url, process, logs) {
  for (let index = 0; index < 300; index += 1) {
    try { if ((await fetch(url)).ok) return; } catch {}
    if (process.exitCode !== null) throw new Error(logs.join(""));
    await delay(100);
  }
  throw new Error("Admin mutation test server did not start.");
}
async function stop(process) {
  if (process.exitCode === null) process.kill("SIGTERM");
  await Promise.race([once(process, "exit"), delay(3000)]);
  if (process.exitCode === null) spawnSync("taskkill", ["/pid", String(process.pid), "/t", "/f"], { windowsHide: true });
}
function json(response, status, payload, headers = {}) {
  response.writeHead(status, { "Content-Type": "application/json", ...headers });
  response.end(JSON.stringify(payload));
}
function errorPayload(code, fields) {
  return {
    code,
    message: "unsafe upstream message",
    trace_id: "00000000-0000-4000-8000-000000000000",
    ...(fields ? { fields } : {}),
  };
}

const writes = [];
const upstream = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (url.pathname.endsWith("/me")) {
    return json(response, 200, { data: { id: 8, name: "Biên tập", email: "writer@example.test", role: { id: 2, name: "Catalog writer" }, permissions: ["b2b.catalog.read", "b2b.catalog.write"] } });
  }
  if (!url.pathname.endsWith("/product-aggregates/bot-nghe/commercial-rules") || request.method !== "PUT") {
    response.writeHead(404).end();
    return;
  }
  let raw = "";
  for await (const chunk of request) raw += chunk;
  const received = {
    cookie: request.headers.cookie ?? "",
    ifMatch: request.headers["if-match"],
    xsrf: request.headers["x-xsrf-token"],
    payload: JSON.parse(raw),
  };
  writes.push(received);
  assert.doesNotMatch(received.cookie, /marketing=/);
  assert.match(received.cookie, /laravel_session=writer/);
  assert.equal(received.xsrf, "token value");
  assert.deepEqual(received.payload, snapshot, "The BFF must strip the browser-only version field.");
  const mode = request.headers.cookie?.match(/laravel_session=writer-([^;]+)/)?.[1];
  if (mode === "conflict") return json(response, 412, errorPayload("precondition_failed"), { ETag: NEXT_ETAG });
  if (mode === "precondition") return json(response, 428, errorPayload("precondition_required"));
  if (mode === "validation") return json(response, 422, errorPayload("validation_failed", { "variants.0.moq": ["Unsafe details must not pass through verbatim."] }));
  if (mode === "forbidden") return json(response, 403, errorPayload("forbidden"));
  if (mode === "failure") return request.socket.destroy();
  return json(response, 200, {
    data: {
      id: 11, type: "configurable", sku: "BOT-001", slug: "bot-nghe", name: "Bột nghệ", description: null, image: null,
      categories: [], variant_count: 1, available_variant_count: 1, starting_price: { unit_price: 10000, currency: "VND" },
      published: true, resource_version: NEXT_ETAG, validation_errors: [], option_groups: [], variant_index: { 21: {} },
      variants: [{ id: 21, sku: "BOT-001-100", name: "Bột nghệ 100g", published: true, option_values: [], image: null, unit: "gói", moq: 10, quantity_step: 5, contact_from_quantity: 30, availability: { is_available: true }, tier_prices: [{ min_quantity: 10, unit_price: 10000, currency: "VND" }, { min_quantity: 20, unit_price: 9000, currency: "VND" }], validation_errors: [] }],
    },
    meta: { channel: "default", locale: "vi", currency: "VND", contract_version: 1, resource_version: NEXT_ETAG },
  }, { ETag: NEXT_ETAG });
});

const upstreamPort = await freePort();
upstream.listen(upstreamPort, "127.0.0.1");
await once(upstream, "listening");
const appPort = await freePort();
const logs = [];
const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(appPort)], {
  env: { ...process.env, BAGISTO_ADMIN_API_URL: `http://127.0.0.1:${upstreamPort}/api/b2b/admin/v1` },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
app.stdout.on("data", (chunk) => logs.push(String(chunk)));
app.stderr.on("data", (chunk) => logs.push(String(chunk)));

try {
  const origin = `http://localhost:${appPort}`;
  await waitFor(`http://127.0.0.1:${appPort}/`, app, logs);
  const baseHeaders = {
    "Content-Type": "application/json",
    Origin: origin,
    Cookie: "laravel_session=writer; XSRF-TOKEN=token%20value; marketing=private",
  };
  const beforeInvalid = writes.length;
  const invalidVersion = await fetch(`${origin}/api/quan-tri/san-pham/bot-nghe`, { method: "PUT", headers: baseHeaders, body: JSON.stringify({ version: "not-an-etag", ...snapshot }) });
  assert.equal(invalidVersion.status, 422);
  assert.equal(writes.length, beforeInvalid, "Invalid versions must be rejected before upstream I/O.");

  const success = await fetch(`${origin}/api/quan-tri/san-pham/bot-nghe`, { method: "PUT", headers: baseHeaders, body: JSON.stringify({ version: ETAG, ...snapshot }) });
  assert.equal(success.status, 200);
  assert.equal(success.headers.get("etag"), NEXT_ETAG);
  assert.equal(writes.at(-1)?.ifMatch, ETAG);
  assert.equal((await success.json()).data.resource_version, NEXT_ETAG);

  for (const [mode, expectedStatus, expectedCode] of [
    ["conflict", 412, "version_conflict"],
    ["precondition", 428, "precondition_required"],
    ["validation", 422, "validation_failed"],
    ["forbidden", 403, "forbidden"],
    ["failure", 502, "upstream_unavailable"],
  ]) {
    const response = await fetch(`${origin}/api/quan-tri/san-pham/bot-nghe`, {
      method: "PUT",
      headers: { ...baseHeaders, Cookie: `laravel_session=writer-${mode}; XSRF-TOKEN=token%20value; marketing=private` },
      body: JSON.stringify({ version: ETAG, ...snapshot }),
    });
    assert.equal(response.status, expectedStatus, mode);
    const payload = await response.json();
    assert.equal(payload.code, expectedCode, mode);
    assert.doesNotMatch(JSON.stringify(payload), /unsafe upstream/i);
    if (mode === "conflict") assert.equal(response.headers.get("etag"), NEXT_ETAG);
    if (mode === "validation") assert.deepEqual(payload.fields, { "variants.0.moq": ["Giá trị không hợp lệ."] });
  }

  const oversized = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("x".repeat(262_145))); controller.close(); } });
  const tooLarge = await fetch(`${origin}/api/quan-tri/san-pham/bot-nghe`, { method: "PUT", headers: baseHeaders, body: oversized, duplex: "half" });
  assert.equal(tooLarge.status, 422);

  console.log("admin commercial-rules BFF contract passed");
} finally {
  await stop(app);
  await new Promise((resolve) => upstream.close(resolve));
}
