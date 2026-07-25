import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { chromium } from "playwright";

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
  }, {
    id: 22,
    published: true,
    unit: "hộp",
    moq: 20,
    quantity_step: 10,
    contact_from_quantity: 60,
    tier_prices: [
      { min_quantity: 20, unit_price: 18000 },
      { min_quantity: 40, unit_price: 16000 },
    ],
  }],
};
function detailPayload(version = ETAG, rules = snapshot) {
  return {
    data: {
      id: 11, type: "configurable", sku: "BOT-001", slug: "bot-nghe", name: "Bột nghệ", description: null, image: null,
      categories: [], variant_count: rules.variants.length, available_variant_count: rules.variants.length, starting_price: { unit_price: rules.variants[0].tier_prices[0].unit_price, currency: "VND" },
      published: rules.published, resource_version: version, validation_errors: [], option_groups: [], variant_index: Object.fromEntries(rules.variants.map((variant) => [String(variant.id), {}])),
      variants: rules.variants.map((variant, index) => ({ id: variant.id, sku: `BOT-001-${index === 0 ? "100" : "200"}`, name: `Bột nghệ ${index === 0 ? "100g" : "200g"}`, published: variant.published, option_values: [], image: null, unit: variant.unit, moq: variant.moq, quantity_step: variant.quantity_step, contact_from_quantity: variant.contact_from_quantity, availability: { is_available: true }, tier_prices: variant.tier_prices.map((tier) => ({ ...tier, currency: "VND" })), validation_errors: [] })),
    },
    meta: { channel: "default", locale: "vi", currency: "VND", contract_version: 1, resource_version: version },
  };
}
function parserFixture(mode) {
  const payload = detailPayload();
  if (mode === "duplicate") payload.data.variants[1].id = 21;
  if (mode === "missing") delete payload.data.variant_index[22];
  if (mode === "extra") payload.data.variant_index[23] = {};
  return payload;
}

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
let catalogListRequests = 0;
let browserTimeoutsRemaining = 1;
const upstream = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (url.pathname === "/api/b2b/catalog/categories") {
    return json(response, 200, { data: [], meta: { channel: "default", locale: "vi", contract_version: 2 } });
  }
  if (url.pathname === "/api/b2b/catalog/products") {
    catalogListRequests += 1;
    return json(response, 200, { data: [], links: { first: null, last: null, prev: null, next: null }, meta: { current_page: 1, from: null, last_page: 1, path: "/api/b2b/catalog/products", per_page: 12, to: null, total: 0, channel: "default", locale: "vi", currency: "VND", contract_version: 2 } });
  }
  if (url.pathname.endsWith("/me")) {
    if (!request.headers.cookie?.includes("laravel_session=")) return json(response, 401, errorPayload("unauthenticated"));
    const readOnly = request.headers.cookie?.includes("laravel_session=readonly");
    return json(response, 200, { data: { id: 8, name: readOnly ? "Chỉ đọc" : "Biên tập", email: "writer@example.test", role: { id: 2, name: "Catalog" }, permissions: readOnly ? ["b2b.catalog.read"] : ["b2b.catalog.read", "b2b.catalog.write"] } });
  }
  if (url.pathname.endsWith("/product-aggregates/bot-nghe") && request.method === "GET") {
    const parserMode = request.headers.cookie?.match(/laravel_session=parser-([^;]+)/)?.[1];
    const payload = parserMode ? parserFixture(parserMode) : detailPayload();
    if (request.headers.cookie?.includes("laravel_session=readonly")) {
      payload.data.starting_price = null;
      payload.data.validation_errors = ["variant_configuration_invalid"];
      Object.assign(payload.data.variants[0], { unit: null, moq: null, quantity_step: 0, contact_from_quantity: null, tier_prices: [{ min_quantity: 0, unit_price: null, currency: "VND" }], validation_errors: ["missing_b2b_config", "tier_prices_invalid"] });
    }
    return json(response, 200, payload, { ETag: ETAG });
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
  assert.deepEqual(Object.keys(received.payload).sort(), ["published", "variants"], "The BFF must strip the browser-only version field.");
  assert.deepEqual(Object.keys(received.payload.variants[0]).sort(), ["contact_from_quantity", "id", "moq", "published", "quantity_step", "tier_prices", "unit"]);
  assert.deepEqual(received.payload.variants.map((variant) => variant.id), [21, 22], "Every upstream snapshot must contain the exact aggregate variant IDs.");
  const mode = request.headers.cookie?.match(/laravel_session=writer-([^;]+)/)?.[1];
  if (mode === "conflict") return json(response, 412, errorPayload("precondition_failed"), { ETag: NEXT_ETAG });
  if (mode === "precondition") return json(response, 428, errorPayload("precondition_required"));
  if (mode === "validation") return json(response, 422, errorPayload("validation_failed", { "variants.0.moq": ["Unsafe details must not pass through verbatim."] }));
  if (mode === "forbidden") return json(response, 403, errorPayload("forbidden"));
  if (mode === "expired") return json(response, 419, errorPayload("csrf_mismatch"), { "Set-Cookie": ["laravel_session=; Path=/; Max-Age=0; HttpOnly", "XSRF-TOKEN=; Path=/; Max-Age=0"] });
  if (mode === "failure") return request.socket.destroy();
  if (mode === "timeout-direct" || (mode === "timeout" && browserTimeoutsRemaining-- > 0)) {
    await delay(6_000);
    return;
  }
  if (mode === "slow") await delay(350);
  return json(response, 200, detailPayload(NEXT_ETAG, received.payload), { ETag: NEXT_ETAG });
});

const upstreamPort = await freePort();
upstream.listen(upstreamPort, "127.0.0.1");
await once(upstream, "listening");
const appPort = await freePort();
const logs = [];
const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(appPort)], {
  env: { ...process.env, BAGISTO_API_URL: `http://127.0.0.1:${upstreamPort}`, BAGISTO_ADMIN_API_URL: `http://127.0.0.1:${upstreamPort}/api/b2b/admin/v1` },
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
  for (const [mode, expectedStatus] of [["valid", 200], ["duplicate", 502], ["missing", 502], ["extra", 502]]) {
    const response = await fetch(`${origin}/api/quan-tri/san-pham/bot-nghe`, { headers: { Cookie: `laravel_session=parser-${mode}` } });
    assert.equal(response.status, expectedStatus, `variant_index parser fixture: ${mode}`);
  }
  const beforeInvalid = writes.length;
  const invalidVersion = await fetch(`${origin}/api/quan-tri/san-pham/bot-nghe`, { method: "PUT", headers: baseHeaders, body: JSON.stringify({ version: "not-an-etag", ...snapshot }) });
  assert.equal(invalidVersion.status, 422);
  assert.equal(writes.length, beforeInvalid, "Invalid versions must be rejected before upstream I/O.");

  const success = await fetch(`${origin}/api/quan-tri/san-pham/bot-nghe`, { method: "PUT", headers: baseHeaders, body: JSON.stringify({ version: ETAG, ...snapshot }) });
  assert.equal(success.status, 200);
  assert.equal(success.headers.get("etag"), NEXT_ETAG);
  assert.equal(writes.at(-1)?.ifMatch, ETAG);
  assert.deepEqual(writes.at(-1)?.payload, snapshot, "The direct BFF request body must reach Bagisto exactly.");
  assert.equal((await success.json()).data.resource_version, NEXT_ETAG);

  for (const [mode, expectedStatus, expectedCode] of [
    ["conflict", 412, "version_conflict"],
    ["precondition", 428, "precondition_required"],
    ["validation", 422, "validation_failed"],
    ["forbidden", 403, "forbidden"],
    ["expired", 419, "session_expired"],
    ["failure", 502, "upstream_unavailable"],
    ["timeout-direct", 504, "upstream_timeout"],
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

  const catalogUrl = `${origin}/san-pham?q=mutation-cache-probe`;
  assert.equal((await fetch(catalogUrl)).status, 200);
  assert.equal((await fetch(catalogUrl)).status, 200);
  assert.equal(catalogListRequests, 1, "The public catalog list should be warm before mutation.");
  const cacheInvalidatingWrite = await fetch(`${origin}/api/quan-tri/san-pham/bot-nghe`, { method: "PUT", headers: baseHeaders, body: JSON.stringify({ version: ETAG, ...snapshot }) });
  assert.equal(cacheInvalidatingWrite.status, 200);
  assert.equal((await fetch(catalogUrl)).status, 200);
  assert.equal(catalogListRequests, 2, "A successful admin write must immediately expire the public catalog list tag.");

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const unsavable = await browser.newPage();
    await unsavable.context().addCookies([{ name: "laravel_session", value: "parser-duplicate", domain: "localhost", path: "/" }]);
    await unsavable.goto(`${origin}/quan-tri/san-pham/bot-nghe`, { waitUntil: "networkidle" });
    assert.equal(await unsavable.getByText(/Dịch vụ quản trị tạm thời không khả dụng/).count(), 1, "An unsavable aggregate must fail closed before the editor loads.");
    assert.equal(await unsavable.getByRole("button", { name: "Lưu thay đổi" }).count(), 0);
    await unsavable.close();

    const readOnly = await browser.newPage();
    await readOnly.context().addCookies([{ name: "laravel_session", value: "readonly", domain: "localhost", path: "/" }]);
    await readOnly.goto(`${origin}/quan-tri/san-pham/bot-nghe`, { waitUntil: "networkidle" });
    assert.equal(await readOnly.getByRole("button", { name: "Lưu thay đổi" }).count(), 0, "Read-only users must not receive write controls.");
    assert.equal(await readOnly.getByText(/Dữ liệu sản phẩm cần/).count(), 1, "Legacy null and invalid values must remain inspectable.");
    await readOnly.close();

    const writer = await browser.newPage();
    await writer.context().addCookies([{ name: "laravel_session", value: "writer", domain: "localhost", path: "/" }, { name: "XSRF-TOKEN", value: "token%20value", domain: "localhost", path: "/" }]);
    await writer.goto(`${origin}/quan-tri/san-pham/bot-nghe`, { waitUntil: "networkidle" });
    const unit = writer.getByLabel("Đơn vị · Bột nghệ 100g");
    await unit.fill("");
    await writer.getByRole("button", { name: "Lưu thay đổi" }).click();
    await writer.getByText("Nhập đơn vị bán.").waitFor();
    await unit.fill("hộp");
    await writer.getByRole("button", { name: "Lưu thay đổi" }).click();
    await writer.getByText("Đã lưu thay đổi.").waitFor();
    assert.equal(await unit.inputValue(), "hộp");
    await writer.screenshot({ path: "docs/design-references/qa-admin-editor-desktop.png", fullPage: true });
    await writer.close();

    const conflict = await browser.newPage();
    await conflict.context().addCookies([{ name: "laravel_session", value: "writer-conflict", domain: "localhost", path: "/" }, { name: "XSRF-TOKEN", value: "token%20value", domain: "localhost", path: "/" }]);
    await conflict.goto(`${origin}/quan-tri/san-pham/bot-nghe`, { waitUntil: "networkidle" });
    const conflictUnit = conflict.getByLabel("Đơn vị · Bột nghệ 100g");
    await conflictUnit.fill("thùng");
    await conflict.getByRole("button", { name: "Lưu thay đổi" }).click();
    await conflict.getByText(/Dữ liệu đã thay đổi/).waitFor();
    assert.equal(await conflictUnit.inputValue(), "thùng", "Conflicts must retain the current draft.");
    assert.equal(await conflict.getByRole("button", { name: "Tải dữ liệu mới nhất" }).count(), 1);
    await conflict.close();

    const failure = await browser.newPage();
    await failure.context().addCookies([{ name: "laravel_session", value: "writer-failure", domain: "localhost", path: "/" }, { name: "XSRF-TOKEN", value: "token%20value", domain: "localhost", path: "/" }]);
    await failure.goto(`${origin}/quan-tri/san-pham/bot-nghe`, { waitUntil: "networkidle" });
    const failureUnit = failure.getByLabel("Đơn vị · Bột nghệ 100g");
    await failureUnit.fill("khay");
    await failure.getByRole("button", { name: "Lưu thay đổi" }).click();
    await failure.getByText(/tạm thời không khả dụng|Không thể kết nối/).waitFor();
    assert.equal(await failureUnit.inputValue(), "khay", "Upstream failures must retain the current draft.");
    await failure.close();

    const timeout = await browser.newPage();
    await timeout.context().addCookies([{ name: "laravel_session", value: "writer-timeout", domain: "localhost", path: "/" }, { name: "XSRF-TOKEN", value: "token%20value", domain: "localhost", path: "/" }]);
    await timeout.goto(`${origin}/quan-tri/san-pham/bot-nghe`, { waitUntil: "networkidle" });
    const timeoutUnit = timeout.getByLabel("Đơn vị · Bột nghệ 100g");
    await timeoutUnit.fill("túi");
    await timeout.getByRole("button", { name: "Lưu thay đổi" }).click();
    await timeout.getByText(/phản hồi chậm/).waitFor();
    assert.equal(await timeoutUnit.inputValue(), "túi", "Timeouts must retain the current draft.");
    await timeout.getByRole("button", { name: "Lưu thay đổi" }).click();
    await timeout.getByText("Đã lưu thay đổi.").waitFor();
    assert.equal(await timeoutUnit.inputValue(), "túi", "Retry must save the retained timeout draft.");
    await timeout.close();

    const expired = await browser.newPage();
    await expired.context().addCookies([{ name: "laravel_session", value: "writer-expired", domain: "localhost", path: "/" }, { name: "XSRF-TOKEN", value: "token%20value", domain: "localhost", path: "/" }]);
    await expired.goto(`${origin}/quan-tri/san-pham/bot-nghe`, { waitUntil: "networkidle" });
    await expired.getByRole("button", { name: "Lưu thay đổi" }).click();
    await expired.waitForURL(/\/quan-tri\/dang-nhap\?returnTo=/);
    await expired.close();

    const doubleSubmit = await browser.newPage();
    await doubleSubmit.context().addCookies([{ name: "laravel_session", value: "writer-slow", domain: "localhost", path: "/" }, { name: "XSRF-TOKEN", value: "token%20value", domain: "localhost", path: "/" }]);
    await doubleSubmit.goto(`${origin}/quan-tri/san-pham/bot-nghe`, { waitUntil: "networkidle" });
    const slowWritesBefore = writes.filter((write) => write.cookie.includes("laravel_session=writer-slow")).length;
    await doubleSubmit.getByRole("button", { name: "Lưu thay đổi" }).evaluate((button) => { button.click(); button.click(); });
    await doubleSubmit.getByText("Đã lưu thay đổi.").waitFor();
    assert.equal(writes.filter((write) => write.cookie.includes("laravel_session=writer-slow")).length, slowWritesBefore + 1, "Rapid double-submit must create one upstream write.");
    await doubleSubmit.close();

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await mobile.context().addCookies([{ name: "laravel_session", value: "writer", domain: "localhost", path: "/" }, { name: "XSRF-TOKEN", value: "token%20value", domain: "localhost", path: "/" }]);
    await mobile.goto(`${origin}/quan-tri/san-pham/bot-nghe`, { waitUntil: "networkidle" });
    const saveBar = mobile.locator('[data-admin-save-bar="true"]');
    assert.equal(await saveBar.evaluate((element) => getComputedStyle(element).position), "sticky");
    const addTier = mobile.getByRole("button", { name: "Thêm mức giá · Bột nghệ 100g" });
    await addTier.focus();
    await addTier.press("Enter");
    assert.equal(await mobile.getByLabel(/Số lượng mức 3/).count(), 1);
    await mobile.screenshot({ path: "docs/design-references/qa-admin-editor-mobile.png", fullPage: true });
    await mobile.close();
  } finally {
    await browser.close();
  }

  console.log("admin commercial-rules BFF and editor flows passed");
} finally {
  await stop(app);
  await new Promise((resolve) => upstream.close(resolve));
}
