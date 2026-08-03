import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

import { nextBinPath } from "./next-bin.mjs";

const REQUEST_TIMEOUT_MS = 5_000;
const SERVER_START_TIMEOUT_MS = 30_000;
const STORAGE_KEY = "giacong.request-cart.v1";

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchWithTimeout(url, options = {}, label = url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    throw new Error(`Timed out or failed fetching ${label}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timeout);
  }
}

function logsText(logs) {
  return logs.join("").slice(-8_000);
}

async function waitForServer(url, child, logs) {
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      if ((await fetchWithTimeout(url, {}, "server startup")).ok) return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    if (child.exitCode !== null) throw new Error(`Next exited before startup: ${lastError}\n${logsText(logs)}`);
    await delay(100);
  }
  throw new Error(`Next did not start: ${lastError}\n${logsText(logs)}`);
}

async function waitForPortToClose(port) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const probe = createNetServer();
    try {
      probe.listen(port, "127.0.0.1");
      await once(probe, "listening");
      await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
      return;
    } catch {
      probe.close();
      await delay(100);
    }
  }
  throw new Error(`Port ${port} remained open after cleanup.`);
}

async function stopChild(child, port, logs) {
  if (child.exitCode !== null) {
    await waitForPortToClose(port);
    return;
  }
  child.kill("SIGTERM");
  const stopped = await Promise.race([once(child, "exit").then(() => true), delay(5_000).then(() => false)]);
  if (!stopped && child.exitCode === null) {
    if (process.platform === "win32") {
      const result = spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true });
      if (result.status !== 0 && child.exitCode === null) throw new Error(`Could not stop Next process: ${logsText(logs)}`);
    } else {
      child.kill("SIGKILL");
    }
    await Promise.race([once(child, "exit"), delay(5_000).then(() => { throw new Error(`Next did not stop: ${logsText(logs)}`); })]);
  }
  await waitForPortToClose(port);
}

/** Ephemeral loopback ports only: this harness never touches 3000, 8000 or 8001. */
async function port() {
  const server = createNetServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

const category = { id: 2, parent_id: 1, slug: "dinh-duong", name: "Dinh duong", description: null, image: null };
const tier = (minQuantity, unitPrice) => ({ min_quantity: minQuantity, unit_price: unitPrice, currency: "VND" });
const variant = ({ id, sku, name, optionId, optionLabel, unit, moq, step, contact, prices, available = true }) => ({
  id,
  sku,
  name,
  option_values: [{ attribute_id: 50, attribute_code: "b2b_variant", option_id: optionId, option_label: optionLabel }],
  image: null,
  unit,
  moq,
  quantity_step: step,
  contact_from_quantity: contact,
  availability: { is_available: available },
  tier_prices: prices.map(([quantity, price]) => tier(quantity, price)),
});

const vanillaUnitPrice = 720_000;
const families = () => [
  {
    id: 10,
    sku: "B2B-DEMO-BOT-DINH-DUONG",
    slug: "b2b-demo-bot-dinh-duong",
    name: "Bot dinh duong",
    description: "Bot dinh duong dong thung.",
    variants: [
      variant({ id: 101, sku: "B2B-DEMO-BOT-VANI", name: "Bot dinh duong vi vani", optionId: 501, optionLabel: "Vani", unit: "thung", moq: 10, step: 5, contact: 100, prices: [[10, vanillaUnitPrice], [25, 690_000]] }),
      variant({ id: 102, sku: "B2B-DEMO-BOT-IT-NGOT", name: "Bot dinh duong vi it ngot", optionId: 502, optionLabel: "It ngot", unit: "thung", moq: 10, step: 5, contact: 100, prices: [[10, 735_000]], available: false }),
    ],
  },
  {
    id: 20,
    sku: "B2B-DEMO-NGU-COC",
    slug: "b2b-demo-ngu-coc",
    name: "Ngu coc dinh duong",
    description: "Ngu coc dinh duong tien loi.",
    variants: [
      variant({ id: 201, sku: "B2B-DEMO-NGU-COC-HAT", name: "Ngu coc hat", optionId: 503, optionLabel: "Hat", unit: "bao", moq: 12, step: 6, contact: 120, prices: [[12, 560_000], [30, 535_000]] }),
    ],
  },
];

const parent = (family) => ({
  id: family.id,
  type: "configurable",
  sku: family.sku,
  slug: family.slug,
  name: family.name,
  description: family.description,
  image: null,
  categories: [category],
  variant_count: family.variants.length,
  available_variant_count: family.variants.filter((item) => item.availability.is_available).length,
  starting_price: {
    unit_price: Math.min(...family.variants.filter((item) => item.availability.is_available).map((item) => item.tier_prices[0].unit_price)),
    currency: "VND",
  },
});
const detail = (family) => ({
  ...parent(family),
  option_groups: [{
    attribute_id: 50,
    code: "b2b_variant",
    label: "Phien ban",
    options: family.variants.map((item) => ({
      option_id: item.option_values[0].option_id,
      label: item.option_values[0].option_label,
      variant_ids: [item.id],
    })),
  }],
  variant_index: Object.fromEntries(family.variants.map((item) => [String(item.id), { b2b_variant: item.option_values[0].option_id }])),
  variants: family.variants,
});
const detailMeta = { channel: "default", locale: "vi", currency: "VND", contract_version: 2 };

function json(response, body) {
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

async function requestBody(request) {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  return JSON.parse(raw || "{}");
}

function resolveFakeCart(lines) {
  const resolvedLines = lines.map((line) => resolveFakeLine(line));
  const units = new Set(resolvedLines.map((line) => line.unit).filter(Boolean));
  const uniformUnit = units.size === 1 ? [...units][0] : null;
  const pricedSubtotal = resolvedLines.reduce((total, line) => total + (line.line_total ?? 0), 0);
  const hasPriceOnRequest = resolvedLines.some((line) => line.price_on_request);
  const snapshotToken = createHash("sha256").update(JSON.stringify(resolvedLines.map((line) => [
    line.parent_slug,
    line.variant_sku,
    line.quantity,
    line.unit_price,
    line.line_total,
    line.is_available,
    line.price_on_request,
    line.minimum_order_quantity,
    line.quantity_step,
    line.contact_from_quantity,
    line.is_submittable,
  ]).sort((left, right) => String(left[1]).localeCompare(String(right[1]))))).digest("hex");

  return {
    currency: "VND",
    has_price_on_request: hasPriceOnRequest,
    is_submittable: resolvedLines.length > 0 && resolvedLines.every((line) => line.is_submittable),
    line_count: resolvedLines.length,
    lines: resolvedLines,
    priced_subtotal: pricedSubtotal,
    request_type: hasPriceOnRequest ? "Tư vấn số lượng lớn" : "Đặt sản phẩm",
    snapshot_token: snapshotToken,
    total_quantity: uniformUnit === null ? null : resolvedLines.reduce((total, line) => total + line.quantity, 0),
    uniform_unit: uniformUnit,
  };
}

function resolveFakeLine(line) {
  const family = families().find((item) => item.slug === line.parent_slug);
  if (!family) {
    return unresolvedFakeLine(line, {
      code: "PRODUCT_NOT_FOUND",
      message: "Sản phẩm không còn tồn tại. Vui lòng xóa dòng này.",
    });
  }

  const selected = family.variants.find((item) => item.sku === line.variant_sku);
  if (!selected) {
    return {
      ...unresolvedFakeLine(line, {
        code: "VARIANT_NOT_FOUND",
        message: "Biến thể không còn tồn tại. Vui lòng xóa dòng này.",
      }),
      product_name: family.name,
    };
  }

  const base = {
    adjustments: [],
    contact_from_quantity: selected.contact_from_quantity,
    image_url: family.image ?? null,
    is_available: selected.availability.is_available,
    is_submittable: true,
    line_total: null,
    minimum_order_quantity: selected.moq,
    parent_slug: line.parent_slug,
    price_on_request: false,
    product_name: family.name,
    quantity: line.quantity,
    quantity_step: selected.quantity_step,
    unit: selected.unit,
    unit_price: null,
    variant_label: selected.name,
    variant_sku: selected.sku,
  };

  if (!selected.availability.is_available) {
    return blockedFakeLine(base, {
      code: "VARIANT_UNAVAILABLE",
      message: "Biến thể hiện không khả dụng. Vui lòng xóa dòng này.",
    });
  }
  if (line.quantity < selected.moq) {
    return blockedFakeLine(base, {
      code: "QUANTITY_BELOW_MOQ",
      message: `Số lượng tối thiểu là ${selected.moq} ${selected.unit}.`,
      suggested_quantity: selected.moq,
    });
  }
  if ((line.quantity - selected.moq) % selected.quantity_step !== 0) {
    const steps = Math.ceil((line.quantity - selected.moq) / selected.quantity_step);
    return blockedFakeLine(base, {
      code: "QUANTITY_OFF_STEP",
      message: `Số lượng phải theo bước ${selected.quantity_step} ${selected.unit}.`,
      suggested_quantity: selected.moq + steps * selected.quantity_step,
    });
  }
  if (line.quantity >= selected.contact_from_quantity) {
    return {
      ...base,
      adjustments: [{
        code: "PRICE_ON_REQUEST",
        message: `Từ ${selected.contact_from_quantity} ${selected.unit}, giá được báo riêng theo số lượng.`,
      }],
      price_on_request: true,
    };
  }

  const tier = [...selected.tier_prices]
    .filter((item) => item.min_quantity <= line.quantity)
    .sort((left, right) => right.min_quantity - left.min_quantity)[0];
  if (!tier) {
    return {
      ...base,
      adjustments: [{ code: "PRICE_ON_REQUEST", message: "Giá của số lượng này được báo riêng." }],
      price_on_request: true,
    };
  }
  return { ...base, line_total: tier.unit_price * line.quantity, unit_price: tier.unit_price };
}

function blockedFakeLine(line, adjustment) {
  return { ...line, adjustments: [adjustment], is_submittable: false };
}

function unresolvedFakeLine(line, adjustment) {
  return {
    adjustments: [adjustment],
    contact_from_quantity: null,
    image_url: null,
    is_available: false,
    is_submittable: false,
    line_total: null,
    minimum_order_quantity: null,
    parent_slug: line.parent_slug,
    price_on_request: false,
    product_name: "",
    quantity: line.quantity,
    quantity_step: null,
    unit: "",
    unit_price: null,
    variant_label: "",
    variant_sku: line.variant_sku,
  };
}

const seenDetailRequests = [];
const fakeSockets = new Set();
const fake = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (request.method === "POST" && url.pathname === "/api/b2b/catalog/resolve-cart") {
    const payload = await requestBody(request);
    return json(response, { cart: resolveFakeCart(payload.lines ?? []) });
  }
  if (!url.pathname.startsWith("/api/b2b/catalog/products/")) return response.writeHead(404).end();
  const slug = url.pathname.replace("/api/b2b/catalog/products/", "").replace(/\/$/, "");
  seenDetailRequests.push(slug);
  const family = families().find((item) => item.slug === slug);
  if (!family) return response.writeHead(404).end();
  return json(response, { data: detail(family), meta: detailMeta });
});
fake.on("connection", (socket) => {
  fakeSockets.add(socket);
  socket.on("close", () => fakeSockets.delete(socket));
});

const storedCart = (lines, overrides = {}) => JSON.stringify({
  lines,
  schemaVersion: 1,
  updatedAt: "2026-07-26T10:15:00.000Z",
  ...overrides,
});
const vanilla = { parentSlug: "b2b-demo-bot-dinh-duong", quantity: 15, variantSku: "B2B-DEMO-BOT-VANI" };
const oats = { parentSlug: "b2b-demo-ngu-coc", quantity: 18, variantSku: "B2B-DEMO-NGU-COC-HAT" };

const fakePort = await port();
fake.listen(fakePort, "127.0.0.1");
await once(fake, "listening");
const appPort = await port();
const logs = [];
const browserIssues = [];
const screenshots = join(tmpdir(), `request-cart-${process.pid}`);
let browser;
const app = spawn(process.execPath, [nextBinPath, "start", "-p", String(appPort)], {
  env: {
    ...process.env,
    BAGISTO_API_URL: `http://127.0.0.1:${fakePort}`,
    BAGISTO_API_TIMEOUT_MS: "500",
    CONTACT_WEBHOOK_TEST_MODE: "1",
    GOOGLE_SHEETS_WEBHOOK_SECRET: "request-cart-test-secret-32-characters",
    GOOGLE_SHEETS_WEBHOOK_URL: "https://script.google.com/macros/s/request-cart-test/exec",
    NODE_ENV: "production",
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --require=./scripts/contact-webhook-fetch-mock.cjs`,
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
app.stdout.on("data", (chunk) => logs.push(chunk.toString()));
app.stderr.on("data", (chunk) => logs.push(chunk.toString()));

try {
  const origin = `http://127.0.0.1:${appPort}`;
  await waitForServer(`${origin}/`, app, logs);
  await mkdir(screenshots, { recursive: true });

  assert.equal(
    (await fetchWithTimeout(`${origin}/gui-yeu-cau/`, {}, "cart route")).status,
    200,
    "/gui-yeu-cau must be served",
  );
  for (const removed of ["/gio-hang/", "/thanh-toan/"]) {
    assert.equal(
      (await fetchWithTimeout(`${origin}${removed}`, {}, removed)).status,
      404,
      `${removed} must not exist: /gui-yeu-cau is the only cart route`,
    );
  }

  browser = await chromium.launch({ headless: true });
  const openCart = async (page, cart) => {
    await page.addInitScript(([key, value]) => {
      window.localStorage.clear();
      if (value !== null) window.localStorage.setItem(key, value);
    }, [STORAGE_KEY, cart]);
    await page.goto(`${origin}/gui-yeu-cau/`);
  };
  const newPage = async (viewport = { width: 1440, height: 900 }) => {
    const page = await browser.newPage({ viewport });
    page.on("console", (message) => { if (message.type() === "error") browserIssues.push(message.text()); });
    page.on("pageerror", (error) => browserIssues.push(error.message));
    return page;
  };

  const submitOneRequest = async (target, contact = { email: "ha@example.com", phone: "0868408115" }) => {
    await openCart(target, storedCart([vanilla]));
    await target.locator("[data-cart-subtotal]").waitFor();
    await target.getByLabel(/^Họ và tên/).fill("Trần Thị B");
    await target.getByLabel(/^Số điện thoại/).fill(contact.phone);
    await target.getByLabel(/^Email/).fill(contact.email);
    await target.getByRole("button", { name: "Gửi yêu cầu báo giá" }).click();
    await target.locator("[data-request-reference]").waitFor();
  };

  const page = await newPage();

  // A priced, submittable cart renders server money only.
  await openCart(page, storedCart([vanilla, oats]));
  await page.getByRole("heading", { level: 1, name: "Giỏ hàng" }).waitFor();
  await page.locator("[data-cart-subtotal]").waitFor();
  assert.equal(
    await page.evaluate(() => {
      return document.querySelectorAll("#header, #footer").length === 2
        && document.querySelectorAll("[data-cart-image]").length === 2
        && document.querySelectorAll("button").length > 0;
    }),
    true,
    "The cart must use the captured Tin tức header/footer and show product images",
  );
  const vanillaRow = page.locator('[data-cart-line="B2B-DEMO-BOT-VANI"]');
  const oatsRow = page.locator('[data-cart-line="B2B-DEMO-NGU-COC-HAT"]');
  await vanillaRow.waitFor();
  assert.match(await vanillaRow.innerText(), /Bot dinh duong/, "A line must name its product");
  // `resolveCartProduct` maps `label` to the variant name, so that is the variant identity shown.
  assert.match(await vanillaRow.innerText(), /Bot dinh duong vi vani/, "A line must name its variant");
  assert.match(await vanillaRow.innerText(), /B2B-DEMO-BOT-VANI/, "A line must show the exact SKU");
  assert.match(await vanillaRow.innerText(), /thung/, "A line must show its unit");
  assert.match(
    await vanillaRow.locator("[data-cart-unit-price]").innerText(),
    /720\.000/,
    "Unit price must come from the server tier price",
  );
  assert.match(
    await vanillaRow.locator("[data-cart-line-total]").innerText(),
    /10\.800\.000/,
    "Line total must be the server computed unit price times quantity",
  );
  assert.equal(await vanillaRow.locator("[data-cart-quantity] output").innerText(), "15");
  assert.equal(await vanillaRow.locator("[data-cart-quantity] input").count(), 0, "Quantity must use a bounded stepper, not free entry");
  assert.match(
    await oatsRow.locator("[data-cart-line-total]").innerText(),
    /10\.080\.000/,
    "A second line must be priced independently",
  );
  assert.match(
    await page.locator("[data-cart-subtotal]").innerText(),
    /20\.880\.000/,
    "Priced subtotal must be the server sum",
  );
  assert.match(await page.locator("main").innerText(), /Tạm tính/, "The summary must be labelled as a provisional subtotal");
  assert.match(
    await page.locator("main").innerText(),
    /chưa gồm phí vận chuyển/i,
    "The subtotal must state that shipping is excluded",
  );
  assert.equal(
    await page.locator("[data-cart-line-warning]").count(),
    0,
    "A fully valid cart must not show warnings",
  );

  // The client sends only the three minimal line keys.
  const revalidateBody = await (async () => {
    const captured = page.waitForRequest((request) => request.url().endsWith("/api/gui-yeu-cau/xac-thuc") && request.method() === "POST");
    await vanillaRow.getByRole("button", { name: /^Tăng số lượng/ }).click();
    return JSON.parse((await captured).postData() ?? "{}");
  })();
  assert.deepEqual(Object.keys(revalidateBody), ["lines"], "The revalidate payload must carry only lines");
  assert.deepEqual(
    revalidateBody.lines.map((line) => Object.keys(line).sort()),
    [["parentSlug", "quantity", "variantSku"], ["parentSlug", "quantity", "variantSku"]],
    "A revalidate line must never carry price, total or PII",
  );

  // Price on request: at the inclusive threshold the server withholds a price.
  await openCart(page, storedCart([{ ...vanilla, quantity: 100 }]));
  await vanillaRow.waitFor();
  assert.match(
    await vanillaRow.innerText(),
    /Liên hệ báo giá/,
    "A line at the contact threshold must be shown as price on request",
  );
  assert.equal(
    await vanillaRow.locator("[data-cart-line-total]").count(),
    0,
    "A price-on-request line must not display a line total",
  );
  assert.match(
    await page.locator("main").innerText(),
    /Tạm tính chưa gồm|chưa có giá|báo giá riêng/i,
    "A cart with price-on-request lines must say the subtotal is partial",
  );

  // Below MOQ blocks the submit and offers the server suggestion.
  await openCart(page, storedCart([{ ...vanilla, quantity: 5 }]));
  const moqWarning = vanillaRow.locator("[data-cart-line-warning]");
  await moqWarning.waitFor();
  assert.match(await moqWarning.innerText(), /Số lượng tối thiểu là 10 thung/, "MOQ warnings come from the server");
  assert.equal(
    await page.locator("[data-cart-blocked]").count(),
    1,
    "An invalid line must block sending until it is fixed",
  );

  // Off-step quantity.
  await openCart(page, storedCart([{ ...vanilla, quantity: 13 }]));
  await vanillaRow.locator("[data-cart-line-warning]").waitFor();
  assert.match(
    await vanillaRow.locator("[data-cart-line-warning]").innerText(),
    /bước 5 thung/,
    "Off-step quantities must be reported with the server step",
  );

  // Unavailable variant and a product that no longer exists.
  await openCart(page, storedCart([{ parentSlug: "b2b-demo-bot-dinh-duong", quantity: 10, variantSku: "B2B-DEMO-BOT-IT-NGOT" }]));
  const unavailableRow = page.locator('[data-cart-line="B2B-DEMO-BOT-IT-NGOT"]');
  await unavailableRow.locator("[data-cart-line-warning]").waitFor();
  assert.match(
    await unavailableRow.locator("[data-cart-line-warning]").innerText(),
    /không khả dụng/,
    "An unavailable variant must be reported",
  );
  await openCart(page, storedCart([{ parentSlug: "khong-ton-tai", quantity: 10, variantSku: "KHONG-TON-TAI" }]));
  const missingRow = page.locator('[data-cart-line="KHONG-TON-TAI"]');
  await missingRow.locator("[data-cart-line-warning]").waitFor();
  assert.match(
    await missingRow.locator("[data-cart-line-warning]").innerText(),
    /không còn tồn tại/,
    "A missing product must be reported",
  );

  // Editing a quantity revalidates and rewrites local storage.
  await openCart(page, storedCart([vanilla]));
  await vanillaRow.locator("[data-cart-line-total]").waitFor();
  await vanillaRow.getByRole("button", { name: /^Tăng số lượng/ }).click();
  await vanillaRow.getByRole("button", { name: /^Tăng số lượng/ }).click();
  await vanillaRow.locator("[data-cart-line-total]").filter({ hasText: "17.250.000" }).waitFor();
  assert.match(
    await vanillaRow.locator("[data-cart-unit-price]").innerText(),
    /690\.000/,
    "A quantity edit must re-price against the server tier table",
  );
  assert.deepEqual(
    JSON.parse(await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY)).lines,
    [{ ...vanilla, quantity: 25 }],
    "A committed quantity must persist to the local cart",
  );

  // Removing a line revalidates the rest.
  await openCart(page, storedCart([vanilla, oats]));
  await oatsRow.waitFor();
  await oatsRow.getByRole("button", { name: /^Xóa/ }).click();
  await oatsRow.waitFor({ state: "detached" });
  await page.locator("[data-cart-subtotal]").filter({ hasText: "10.800.000" }).waitFor();
  assert.deepEqual(
    JSON.parse(await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY)).lines,
    [vanilla],
    "Removing a line must persist to the local cart",
  );

  // Removing the last line reaches the empty state.
  await vanillaRow.getByRole("button", { name: /^Xóa/ }).click();
  await page.getByText("Giỏ hàng đang trống.").waitFor();
  assert.equal(
    await page.getByRole("link", { name: "Xem sản phẩm" }).count(),
    1,
    "The empty cart must offer a way back to the catalog",
  );

  // An empty local cart never calls the server.
  const emptyPage = await newPage();
  let emptyCartRequests = 0;
  await emptyPage.route("**/api/gui-yeu-cau/xac-thuc", async (route) => {
    emptyCartRequests += 1;
    await route.continue();
  });
  await openCart(emptyPage, null);
  await emptyPage.getByText("Giỏ hàng đang trống.").waitFor();
  await delay(300);
  assert.equal(emptyCartRequests, 0, "An empty cart must not revalidate");
  await emptyPage.close();

  // A revalidation failure is recoverable.
  const errorPage = await newPage();
  let revalidateAttempts = 0;
  await errorPage.route("**/api/gui-yeu-cau/xac-thuc", async (route) => {
    revalidateAttempts += 1;
    if (revalidateAttempts === 1) {
      await route.fulfill({
        body: JSON.stringify({ message: "Không thể xác thực giỏ yêu cầu. Vui lòng thử lại.", ok: false }),
        contentType: "application/json",
        headers: { "Cache-Control": "no-store" },
        status: 502,
      });
      return;
    }
    await route.fallback();
  });
  await openCart(errorPage, storedCart([vanilla]));
  const errorAlert = errorPage.getByRole("alert").filter({ hasText: "Không thể xác thực giỏ yêu cầu" });
  await errorAlert.waitFor();
  await errorPage.getByRole("button", { name: "Thử lại" }).click();
  await errorPage.locator('[data-cart-line="B2B-DEMO-BOT-VANI"] [data-cart-line-total]').waitFor();
  assert.equal(revalidateAttempts, 2, "Retry must issue exactly one fresh revalidation");
  assert.deepEqual(
    browserIssues.splice(0),
    ["Failed to load resource: the server responded with a status of 502 (Bad Gateway)"],
    "The intentional 502 must be the only browser issue during error and retry",
  );
  await errorPage.close();

  // Corrupt and partially invalid local carts are sanitized, never crashed on.
  await openCart(page, "{not json");
  await page.getByText("Giỏ hàng đang trống.").waitFor();
  assert.match(
    await page.locator("main").innerText(),
    /đã được làm mới/,
    "A corrupt local cart must explain the reset",
  );
  assert.equal(
    await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY),
    null,
    "A corrupt local cart must be cleared",
  );
  await openCart(page, storedCart([vanilla, { parentSlug: "", quantity: 0, variantSku: "" }]));
  await vanillaRow.waitFor();
  assert.match(
    await page.locator("main").innerText(),
    /Đã bỏ 1 dòng/,
    "A repaired local cart must report the dropped line",
  );
  await openCart(page, storedCart([vanilla], { schemaVersion: 99 }));
  await page.getByText("Giỏ hàng đang trống.").waitFor();

  // The confirmation form: real labels, and a payload that matches the locked JSON contract.
  await openCart(page, storedCart([vanilla, oats]));
  await page.locator("[data-cart-subtotal]").waitFor();
  await page.getByRole("heading", { level: 2, name: "Thông tin liên hệ" }).waitFor();
  for (const [label, required] of [["Họ và tên", true], ["Số điện thoại", true], ["Email", true], ["Nội dung yêu cầu", false]]) {
    const field = page.getByLabel(new RegExp(`^${label}`));
    assert.equal(await field.count(), 1, `${label} must be a real labelled field`);
    assert.equal(
      await field.getAttribute("aria-required"),
      required ? "true" : null,
      `${label} must declare whether it is required`,
    );
  }
  const submitButton = page.getByRole("button", { name: "Gửi yêu cầu báo giá" });
  assert.equal(await submitButton.count(), 1, "The CTA must be the request wording, never a checkout wording");
  assert.equal(await page.getByRole("button", { name: "Trao đổi qua Zalo" }).count(), 1, "The Zalo handoff must be available beside the request CTA");
  assert.match(await page.getByLabel(/^Nội dung yêu cầu/).inputValue(), /Bot dinh duong/, "The request content must start with the selected cart lines");

  // Empty required fields are caught on the client without losing what was typed.
  await page.getByLabel(/^Nội dung yêu cầu/).fill("Cần báo giá sớm.");
  await submitButton.click();
  const nameField = page.getByLabel(/^Họ và tên/);
  await page.getByText("Vui lòng nhập họ và tên.").waitFor();
  assert.equal(await nameField.getAttribute("aria-invalid"), "true", "An invalid field must be marked for assistive tech");
  assert.equal(
    await page.getByLabel(/^Nội dung yêu cầu/).inputValue(),
    "Cần báo giá sớm.",
    "A validation error must never clear what the customer typed",
  );

  // A server rejected phone number comes back per field.
  await nameField.fill("Trần Thị B");
  await page.getByLabel(/^Số điện thoại/).fill("12");
  await page.getByLabel(/^Email/).fill("ha@example.com");
  const invalidSubmit = page.waitForResponse((response) => response.url().endsWith("/api/contact") && response.request().method() === "POST");
  await submitButton.click();
  assert.equal((await invalidSubmit).status(), 400, "A malformed phone must reach the server and be rejected there");
  await page.getByText("Số điện thoại không hợp lệ.").waitFor();
  assert.equal(await page.getByLabel(/^Số điện thoại/).getAttribute("aria-invalid"), "true");

  // A valid submit sends exactly the eight contract keys and no money.
  await page.getByLabel(/^Số điện thoại/).fill("0868 408 115");
  await page.getByLabel(/^Email/).fill("ha@example.com");
  const submitRequest = page.waitForRequest((request) => request.url().endsWith("/api/contact") && request.method() === "POST");
  await submitButton.click();
  const submitted = JSON.parse((await submitRequest).postData() ?? "{}");
  assert.deepEqual(
    Object.keys(submitted).sort(),
    ["email", "lines", "message", "name", "phone", "requestId", "snapshotToken", "source"],
    "The submit payload must match the locked JSON contract exactly",
  );
  assert.match(
    submitted.requestId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    "requestId must be a v4 UUID",
  );
  assert.match(submitted.snapshotToken, /^[0-9a-f]{64}$/, "snapshotToken must be the server digest");
  assert.equal(submitted.source, "/gui-yeu-cau/");
  assert.deepEqual(
    submitted.lines.map((line) => Object.keys(line).sort()),
    [["parentSlug", "quantity", "variantSku"], ["parentSlug", "quantity", "variantSku"]],
    "Submitted lines must carry no price and no total",
  );
  // The accepted state: the Mã, the demo channels, and a cart cleared only now.
  await page.locator("[data-request-reference]").waitFor();
  assert.equal(await page.locator("[data-request-reference]").innerText(), "YC-CAPTURED-001", "The Mã must be shown verbatim");
  assert.deepEqual(
    JSON.parse(await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY)).lines,
    [],
    "A 202 must clear the cart",
  );
  assert.equal(await page.getByRole("button", { name: "Gửi yêu cầu báo giá" }).count(), 0, "The form must not remain after acceptance");
  for (const [channel, href] of [
    ["email", "mailto:qtu1053@gmail.com"],
    ["hotline", "tel:0868408115"],
  ]) {
    const link = page.locator(`a[data-channel="${channel}"]`);
    assert.equal(await link.count(), 1, `${channel} must be a direct link`);
    assert.ok(
      (await link.getAttribute("href")).startsWith(href),
      `${channel} must use the locked demo target ${href}`,
    );
  }
  for (const channel of ["zalo", "messenger"]) {
    assert.equal(
      await page.locator(`button[data-channel="${channel}"]`).count(),
      1,
      `${channel} must copy prepared content before opening`,
    );
  }
  assert.match(
    await page.locator("main").innerText(),
    /dữ liệu demo/i,
    "The demo channels must be labelled as demo data",
  );
  const mailtoHref = await page.locator('a[data-channel="email"]').getAttribute("href");
  const mailtoBody = decodeURIComponent(new URL(mailtoHref).search.replace(/^\?/, "").split("body=")[1] ?? "");
  assert.match(mailtoBody, /YC-CAPTURED-001/, "The prepared email must carry the Mã");
  for (const pii of [/Trần/, /0868 408 115/, /ha@example\.com/]) {
    assert.doesNotMatch(mailtoBody, pii, `Prepared content must not carry ${pii}`);
  }

  // Copy then open, with a working clipboard and with a blocked one.
  const copyPage = await newPage();
  await copyPage.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await submitOneRequest(copyPage, { email: "copy@example.com", phone: "0868408116" });
  await copyPage.locator('button[data-channel="zalo"]').click();
  await copyPage.locator("[data-copy-status]").filter({ hasText: "Đã sao chép" }).waitFor();
  assert.match(
    await copyPage.evaluate(() => navigator.clipboard.readText()),
    /YC-CAPTURED-001/,
    "Copy then open must place the Mã on the clipboard",
  );
  await copyPage.close();

  const clipboardBlockedPage = await newPage();
  await clipboardBlockedPage.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("blocked")) },
    });
  });
  await submitOneRequest(clipboardBlockedPage, { email: "clipboard@example.com", phone: "0868408117" });
  await clipboardBlockedPage.locator('button[data-channel="messenger"]').click();
  await clipboardBlockedPage.locator("[data-copy-status]").filter({ hasText: "Không sao chép được" }).waitFor();
  const fallback = clipboardBlockedPage.locator("[data-copy-fallback]");
  await fallback.waitFor();
  assert.match(await fallback.inputValue(), /YC-CAPTURED-001/, "The fallback must expose the content to copy by hand");
  await clipboardBlockedPage.close();

  // A blocked cart cannot be submitted at all.
  const blockedPage = await newPage();
  let blockedSubmits = 0;
  await blockedPage.route("**/api/contact", async (route) => {
    blockedSubmits += 1;
    await route.fallback();
  });
  await openCart(blockedPage, storedCart([{ ...vanilla, quantity: 5 }]));
  await blockedPage.locator("[data-cart-blocked]").waitFor();
  assert.equal(
    await blockedPage.getByRole("button", { name: "Gửi yêu cầu báo giá" }).isDisabled(),
    true,
    "An invalid line must disable sending",
  );
  await delay(200);
  assert.equal(blockedSubmits, 0, "A blocked cart must never reach the submit endpoint");
  await blockedPage.close();

  // A 409 returns the fresh cart and blocks the submit until it is reviewed.
  const conflictPage = await newPage();
  await conflictPage.route("**/api/contact", async (route) => {
    const fresh = await (await fetch(`${origin}/api/gui-yeu-cau/xac-thuc`, {
      body: JSON.stringify({ lines: [{ ...vanilla, quantity: 25 }] }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    })).json();
    await route.fulfill({
      body: JSON.stringify({
        cart: fresh.cart,
        code: "CART_DRIFTED",
        message: "Giá hoặc tình trạng hàng đã thay đổi. Vui lòng xem lại giỏ yêu cầu.",
        ok: false,
      }),
      contentType: "application/json",
      headers: { "Cache-Control": "no-store" },
      status: 409,
    });
  });
  await openCart(conflictPage, storedCart([{ ...vanilla, quantity: 25 }]));
  await conflictPage.locator("[data-cart-subtotal]").waitFor();
  await conflictPage.getByLabel(/^Họ và tên/).fill("Trần Thị B");
  await conflictPage.getByLabel(/^Số điện thoại/).fill("0868408115");
  await conflictPage.getByLabel(/^Email/).fill("ha@example.com");
  await conflictPage.getByRole("button", { name: "Gửi yêu cầu báo giá" }).click();
  await conflictPage.getByRole("alert").filter({ hasText: "Giá hoặc tình trạng hàng đã thay đổi" }).waitFor();
  assert.match(
    await conflictPage.locator('[data-cart-line="B2B-DEMO-BOT-VANI"] [data-cart-unit-price]').innerText(),
    /690\.000/,
    "A 409 must repaint the cart from the fresh server snapshot",
  );
  assert.notEqual(
    await conflictPage.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY),
    null,
    "A rejected submit must never clear the cart",
  );
  await conflictPage.close();

  // 502 is indeterminate: the request may already be recorded, so the cart is kept.
  const indeterminatePage = await newPage();
  await openCart(indeterminatePage, storedCart([vanilla]));
  await indeterminatePage.locator("[data-cart-subtotal]").waitFor();
  await indeterminatePage.getByLabel(/^Họ và tên/).fill("Trần Thị B");
  await indeterminatePage.getByLabel(/^Số điện thoại/).fill("0868408119");
  await indeterminatePage.getByLabel(/^Email/).fill("indeterminate@example.com");
  await indeterminatePage.getByLabel(/^Nội dung yêu cầu/).fill("__upstream_5xx__");
  const firstRequestId = await (async () => {
    const captured = indeterminatePage.waitForRequest((request) => request.url().endsWith("/api/contact") && request.method() === "POST");
    await indeterminatePage.getByRole("button", { name: "Gửi yêu cầu báo giá" }).click();
    return JSON.parse((await captured).postData() ?? "{}").requestId;
  })();
  await indeterminatePage.getByRole("alert").filter({ hasText: "Chưa rõ yêu cầu đã được tiếp nhận" }).waitFor();
  assert.notEqual(
    await indeterminatePage.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY),
    null,
    "An indeterminate submit must keep the cart so nothing is silently lost",
  );

  // Retrying an indeterminate submit reuses the same requestId, so the Sheet cannot duplicate it.
  const retriedRequestId = await (async () => {
    const captured = indeterminatePage.waitForRequest((request) => request.url().endsWith("/api/contact") && request.method() === "POST");
    await indeterminatePage.getByRole("button", { name: "Gửi yêu cầu báo giá" }).click();
    return JSON.parse((await captured).postData() ?? "{}").requestId;
  })();
  assert.equal(retriedRequestId, firstRequestId, "A retry must reuse the idempotency key of the same attempt");
  await indeterminatePage.close();

  // Double submit: a second click while in flight must not produce a second request.
  const doublePage = await newPage();
  let contactSubmits = 0;
  await doublePage.route("**/api/contact", async (route) => {
    contactSubmits += 1;
    await delay(400);
    await route.fallback();
  });
  await openCart(doublePage, storedCart([vanilla]));
  await doublePage.locator("[data-cart-subtotal]").waitFor();
  await doublePage.getByLabel(/^Họ và tên/).fill("Trần Thị B");
  await doublePage.getByLabel(/^Số điện thoại/).fill("0868408120");
  await doublePage.getByLabel(/^Email/).fill("double@example.com");
  const doubleButton = doublePage.getByRole("button", { name: /Gửi yêu cầu báo giá|Đang gửi/ });
  await doubleButton.click();
  assert.equal(await doubleButton.isDisabled(), true, "The CTA must be disabled while a submit is in flight");
  await doublePage.getByText("YC-CAPTURED-001").waitFor();
  assert.equal(contactSubmits, 1, "A double click must produce exactly one submit");
  await doublePage.close();

  // Scope guards: no checkout, payment, order, shipping, rating, review or favorite surface.
  await openCart(page, storedCart([vanilla, oats]));
  await page.locator("[data-cart-subtotal]").waitFor();
  const cartText = await page.locator("main").innerText();
  for (const forbidden of [/thanh toán/i, /checkout/i, /đặt cọc/i, /chuyển khoản/i, /phí ship/i, /đánh giá/i, /yêu thích/i, /nhận xét/i]) {
    assert.doesNotMatch(cartText, forbidden, `The cart must not mention ${forbidden}`);
  }
  assert.equal(
    await page.locator("main a[href*='thanh-toan'], main a[href*='gio-hang']").count(),
    0,
    "The cart must not link to a checkout or a second cart route",
  );
  assert.deepEqual(
    await page.evaluate(() => Object.keys(window.localStorage)),
    [STORAGE_KEY],
    "The cart must not persist anything beyond the versioned cart key",
  );
  const persistedLineKeys = JSON.parse(await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY));
  assert.deepEqual(
    persistedLineKeys.lines.map((line) => Object.keys(line).sort()),
    [["parentSlug", "quantity", "variantSku"], ["parentSlug", "quantity", "variantSku"]],
    "Local storage must never hold price, total or PII",
  );

  // Every interactive control must carry a programmatic name, not just visual context.
  const unnamed = await page.evaluate(() => {
    const named = (control) => {
      if (control.getAttribute("aria-label")?.trim()) return true;
      const labelledBy = control.getAttribute("aria-labelledby");
      if (labelledBy && labelledBy.split(/\s+/).some((id) => document.getElementById(id)?.textContent?.trim())) return true;
      if (control.labels && control.labels.length > 0) return true;
      return control.tagName === "BUTTON" && (control.textContent ?? "").trim() !== "";
    };
    return Array.from(document.querySelectorAll("main button, main input, main textarea, main select"))
      .filter((control) => !named(control))
      .map((control) => `${control.tagName.toLowerCase()}#${control.id || "(no id)"}`);
  });
  assert.deepEqual(unnamed, [], "Every cart control must expose an accessible name");

  /** Computes the WCAG contrast of every visible text run inside `main`. */
  const contrastFailures = (target) => target.evaluate(() => {
    const parse = (value) => {
      const parts = value.match(/rgba?\(([^)]+)\)/)?.[1].split(/[,\s/]+/).filter(Boolean).map(Number);
      return parts ? { a: parts.length > 3 ? parts[3] : 1, b: parts[2], g: parts[1], r: parts[0] } : null;
    };
    const channel = (value) => {
      const ratio = value / 255;
      return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (colour) => 0.2126 * channel(colour.r) + 0.7152 * channel(colour.g) + 0.0722 * channel(colour.b);
    const backdrop = (element) => {
      for (let node = element; node; node = node.parentElement) {
        const colour = parse(getComputedStyle(node).backgroundColor);
        if (colour && colour.a > 0) return colour;
      }
      return { a: 1, b: 255, g: 255, r: 255 };
    };
    const failures = [];
    for (const element of document.querySelectorAll("main *")) {
      // The captured archive hero is painted by a background image, not a flat colour.
      // Its contrast is asserted below from its own computed presentation contract.
      if (element.closest(".archive-page-header")) continue;
      const own = Array.from(element.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() !== "")
        .map((node) => (node.textContent ?? "").trim())
        .join(" ");
      if (own === "") continue;
      if (element instanceof HTMLButtonElement && element.disabled) continue;
      const style = getComputedStyle(element);
      if (style.visibility === "hidden" || style.display === "none") continue;
      const opacity = Number(style.opacity);
      if (opacity === 0) continue;
      // Fractional opacity would make the computed colour a lie, so it is banned outright.
      if (opacity < 1) {
        failures.push({ ratio: null, reason: "opacity", text: own.slice(0, 40) });
        continue;
      }
      const foreground = parse(style.color);
      if (!foreground) continue;
      const size = Number.parseFloat(style.fontSize);
      const large = size >= 24 || (Number(style.fontWeight) >= 700 && size >= 18.66);
      const first = luminance(foreground);
      const second = luminance(backdrop(element));
      const ratio = (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
      const required = large ? 3 : 4.5;
      if (ratio + 0.005 < required) {
        failures.push({ ratio: Number(ratio.toFixed(2)), reason: `needs ${required}`, text: own.slice(0, 40) });
      }
    }
    return failures;
  });
  assert.deepEqual(await contrastFailures(page), [], "Every text run in a priced cart must meet WCAG AA contrast");
  const heroPresentation = await page.locator(".archive-page-header").evaluate((node) => ({
    backgroundImage: getComputedStyle(node).backgroundImage,
    headingColor: getComputedStyle(node.querySelector("h1")).color,
  }));
  assert.match(heroPresentation.backgroundImage, /form-bg\.jpg/, "The cart hero must retain the captured dark green background image");
  assert.equal(heroPresentation.headingColor, "rgb(255, 255, 255)", "The cart hero must retain its high-contrast white title");

  // Brand green carries the primary action; the warning accent is the handoff's only
  // warm token. This is the measured giacong.vn green, the same one the header above it
  // wears — the page previously used a darker green of its own here, which read as a
  // different site from the chrome. White on it is 3.11:1, so the contrast sweep above
  // only passes because the label qualifies as WCAG AA large text; that pairing is
  // asserted at the source in `scripts/commerce-foundation.test.mts`.
  const brandGreen = "rgb(90, 164, 0)";
  const primaryCta = page.getByRole("button", { name: "Gửi yêu cầu báo giá" });
  assert.equal(
    await primaryCta.evaluate((node) => getComputedStyle(node).backgroundColor),
    brandGreen,
    "The primary CTA must use the brand green",
  );
  assert.equal(await page.locator("#header").count(), 1, "The captured Tin tức header must remain present above the cart");
  const ctaTypography = await primaryCta.evaluate((node) => {
    const style = getComputedStyle(node);
    return { size: Number.parseFloat(style.fontSize), weight: Number(style.fontWeight) };
  });
  assert.ok(
    ctaTypography.size >= 24 || (ctaTypography.weight >= 700 && ctaTypography.size >= 18.66),
    `The brand green only clears AA as large text, so the CTA label must qualify (got ${ctaTypography.size}px/${ctaTypography.weight})`,
  );

  // A keyboard user must see where focus is.
  const outlineWidth = async (locator) => Number.parseFloat(await locator.evaluate((node) => {
    const style = getComputedStyle(node);
    return style.outlineStyle === "none" ? "0" : style.outlineWidth;
  }));
  await page.getByLabel(/^Họ và tên/).focus();
  assert.ok(await outlineWidth(page.getByLabel(/^Họ và tên/)) >= 2, "A focused field must show a visible focus ring");
  await page.locator("#noi-dung-yeu-cau").focus();
  await page.keyboard.press("Tab");
  const focusedCta = page.getByRole("button", { name: "Gửi yêu cầu báo giá" });
  assert.equal(await focusedCta.evaluate((node) => node === document.activeElement), true, "Tab must reach the CTA from the message field");
  assert.ok(await outlineWidth(focusedCta) >= 2, "The focused CTA must show a visible focus ring");

  assert.equal(
    await page.locator("main [style]").count(),
    0,
    "Cart markup must style through Tailwind utilities, not inline styles",
  );
  assert.equal(
    await page.locator("[aria-live='polite'] [data-cart-subtotal]").count(),
    1,
    "A recomputed subtotal must be announced to assistive technology",
  );

  /**
   * The sticky summary must never cover the content a customer is trying to reach. Checked
   * geometrically against the summary itself: the captured header is also sticky, and that is
   * pre-existing chrome outside this route's scope.
   */
  const summaryOverlaps = (target, selector) => target.evaluate((other) => {
    const aside = document.querySelector("main aside");
    const subject = document.querySelector(other);
    if (!aside || !subject) return "missing";
    const first = aside.getBoundingClientRect();
    const second = subject.getBoundingClientRect();
    const overlaps = first.right > second.left && first.left < second.right
      && first.bottom > second.top && first.top < second.bottom;
    return overlaps ? `overlaps ${other}` : "clear";
  }, selector);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  assert.equal(await summaryOverlaps(page, "main form"), "clear", "The sticky summary must not overlap the confirmation form");
  assert.equal(
    await summaryOverlaps(page, "form button[type='submit']"),
    "clear",
    "The sticky summary must not cover the CTA once the page is scrolled",
  );
  assert.equal(
    await summaryOverlaps(page, "main ul li[data-cart-line]"),
    "clear",
    "The sticky summary must not cover a cart line",
  );

  // Warning surfaces keep the accent colour and stay readable.
  await openCart(page, storedCart([vanilla, { ...vanilla, quantity: 5, variantSku: "B2B-DEMO-BOT-IT-NGOT" }]));
  await page.locator("[data-cart-blocked]").waitFor();
  assert.equal(
    await page.locator("[data-cart-line-warning] li").first().evaluate((node) => getComputedStyle(node).borderTopColor),
    "rgb(181, 71, 8)",
    "Warning surfaces must use the handoff warning accent",
  );
  assert.deepEqual(
    await contrastFailures(page),
    [],
    "Warning and blocked states must also meet WCAG AA contrast",
  );

  // A short viewport must not trap the summary off screen.
  const shortPage = await newPage({ width: 1024, height: 640 });
  await openCart(shortPage, storedCart([vanilla, oats, { ...vanilla, quantity: 5, variantSku: "B2B-DEMO-BOT-IT-NGOT" }]));
  await shortPage.locator("[data-cart-subtotal]").waitFor();
  assert.equal(
    await shortPage.evaluate(() => {
      const aside = document.querySelector("main aside");
      return aside !== null && aside.getBoundingClientRect().height <= window.innerHeight - 32;
    }),
    true,
    "A sticky summary must fit inside a short viewport instead of hiding its own controls",
  );
  await shortPage.close();

  // No horizontal overflow, and touch targets stay reachable, at the required widths.
  for (const width of [320, 768, 1024, 1440]) {
    const viewportPage = await newPage({ width, height: 900 });
    await openCart(viewportPage, storedCart([vanilla, oats, { ...vanilla, quantity: 5, variantSku: "B2B-DEMO-BOT-IT-NGOT" }]));
    await viewportPage.locator("[data-cart-subtotal]").waitFor();
    assert.equal(
      await viewportPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      true,
      `${width}px cart must not overflow horizontally`,
    );
    const smallTargets = await viewportPage.evaluate(() => Array.from(
      document.querySelectorAll("main button, main input, main textarea, main [data-cta]"),
    )
      .filter((control) => control.getBoundingClientRect().height < 44)
      .map((control) => {
        const height = Math.round(control.getBoundingClientRect().height * 100) / 100;
        return `${control.tagName.toLowerCase()}#${control.id || "(no id)"} is ${height}px`;
      }));
    assert.deepEqual(smallTargets, [], `${width}px controls must stay at least 44px tall`);
    if (width < 1024) {
      assert.equal(
        await viewportPage.evaluate(() => getComputedStyle(document.querySelector("main aside")).position),
        "static",
        `${width}px must lay the summary out in flow so it cannot obscure anything`,
      );
    }
    await viewportPage.screenshot({ path: join(screenshots, `cart-${width}.png`), fullPage: true });
    await viewportPage.close();
  }

  // The accepted state is held to the same bar.
  const acceptedPage = await newPage({ width: 390, height: 844 });
  await submitOneRequest(acceptedPage, { email: "accepted@example.com", phone: "0868408118" });
  assert.deepEqual(await contrastFailures(acceptedPage), [], "The accepted state must meet WCAG AA contrast");
  assert.equal(
    await acceptedPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    true,
    "The accepted state must not overflow on a phone",
  );
  await acceptedPage.screenshot({ path: join(screenshots, "accepted-390.png"), fullPage: true });
  await acceptedPage.close();

  await page.close();
  // The 400, 409 and 502 submits above are deliberate, and the browser logs each one.
  assert.deepEqual(
    browserIssues.filter((issue) => !/Failed to load resource: the server responded with a status of (400|409|502)/.test(issue)),
    [],
    "The cart browser console must be clean apart from the intentional error responses",
  );
  console.log(JSON.stringify({ screenshots, upstreamDetailReads: seenDetailRequests.length }));
} finally {
  await browser?.close();
  await stopChild(app, appPort, logs);
  fakeSockets.forEach((socket) => socket.destroy());
  await new Promise((resolve, reject) => fake.close((error) => error ? reject(error) : resolve()));
  await waitForPortToClose(fakePort);
}
