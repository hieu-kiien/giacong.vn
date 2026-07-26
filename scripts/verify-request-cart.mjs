import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
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

const seenDetailRequests = [];
const fakeSockets = new Set();
const fake = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
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
  env: { ...process.env, BAGISTO_API_URL: `http://127.0.0.1:${fakePort}`, BAGISTO_API_TIMEOUT_MS: "500", NODE_ENV: "production" },
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

  const page = await newPage();

  // A priced, submittable cart renders server money only.
  await openCart(page, storedCart([vanilla, oats]));
  await page.getByRole("heading", { level: 1, name: "Giỏ yêu cầu đặt hàng" }).waitFor();
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
  assert.equal(await vanillaRow.locator("[data-cart-quantity] input").inputValue(), "15");
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
    await page.getByRole("button", { name: "Làm mới giá" }).click();
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
  const quantityInput = vanillaRow.locator("[data-cart-quantity] input");
  await quantityInput.fill("25");
  await quantityInput.press("Enter");
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
  await page.getByText("Giỏ yêu cầu đang trống.").waitFor();
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
  await emptyPage.getByText("Giỏ yêu cầu đang trống.").waitFor();
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
  await page.getByText("Giỏ yêu cầu đang trống.").waitFor();
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
  await page.getByText("Giỏ yêu cầu đang trống.").waitFor();

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

  // No horizontal overflow at the required widths.
  for (const width of [320, 768, 1024, 1440]) {
    const viewportPage = await newPage({ width, height: 900 });
    await openCart(viewportPage, storedCart([vanilla, oats, { ...vanilla, quantity: 5, variantSku: "B2B-DEMO-BOT-IT-NGOT" }]));
    await viewportPage.locator("[data-cart-subtotal]").waitFor();
    assert.equal(
      await viewportPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      true,
      `${width}px cart must not overflow horizontally`,
    );
    await viewportPage.screenshot({ path: join(screenshots, `cart-${width}.png`), fullPage: true });
    await viewportPage.close();
  }

  await page.close();
  assert.deepEqual(browserIssues, [], "The cart browser console must be clean");
  console.log(JSON.stringify({ screenshots, upstreamDetailReads: seenDetailRequests.length }));
} finally {
  await browser?.close();
  await stopChild(app, appPort, logs);
  fakeSockets.forEach((socket) => socket.destroy());
  await new Promise((resolve, reject) => fake.close((error) => error ? reject(error) : resolve()));
  await waitForPortToClose(fakePort);
}
