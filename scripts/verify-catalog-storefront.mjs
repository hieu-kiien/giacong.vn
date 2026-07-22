import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { chromium } from "playwright";

const REQUEST_TIMEOUT_MS = 5_000;
const SERVER_START_TIMEOUT_MS = 30_000;

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
  if (child.exitCode === null) child.kill("SIGTERM");
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

async function port() {
  const server = createNetServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

const category = {
  id: 2,
  parent_id: 1,
  slug: "dinh-duong",
  name: "Dinh dưỡng",
  description: null,
  image: null,
};
const tier = (minQuantity, unitPrice) => ({ min_quantity: minQuantity, unit_price: unitPrice, currency: "VND" });
const optionValue = (optionId, optionLabel) => ({
  attribute_id: 50,
  attribute_code: "b2b_variant",
  option_id: optionId,
  option_label: optionLabel,
});
const variant = ({ id, sku, name, optionId, optionLabel, moq, step, contact, prices, available = true }) => ({
  id,
  sku,
  name,
  option_values: [optionValue(optionId, optionLabel)],
  image: null,
  unit: "thùng",
  moq,
  quantity_step: step,
  contact_from_quantity: contact,
  availability: { is_available: available },
  tier_prices: prices.map(([quantity, price]) => tier(quantity, price)),
});
const families = [
  {
    id: 10,
    sku: "B2B-DEMO-BOT-DINH-DUONG",
    slug: "b2b-demo-bot-dinh-duong",
    name: "Bột dinh dưỡng",
    description: "Bột dinh dưỡng đóng thùng với nhiều lựa chọn hương vị.",
    variants: [
      variant({ id: 101, sku: "B2B-DEMO-BOT-VANI", name: "Bột dinh dưỡng vị vani", optionId: 501, optionLabel: "Vani", moq: 10, step: 5, contact: 100, prices: [[10, 720000], [25, 690000]] }),
      variant({ id: 102, sku: "B2B-DEMO-BOT-IT-NGOT", name: "Bột dinh dưỡng vị ít ngọt", optionId: 502, optionLabel: "Ít ngọt", moq: 10, step: 5, contact: 100, prices: [[10, 735000], [25, 705000]], available: false }),
    ],
  },
  {
    id: 20,
    sku: "B2B-DEMO-THUC-UONG-DINH-DUONG",
    slug: "b2b-demo-thuc-uong-dinh-duong",
    name: "Thức uống dinh dưỡng",
    description: "Thức uống dinh dưỡng đóng thùng dành cho phân phối.",
    variants: [
      variant({ id: 201, sku: "B2B-DEMO-LUA-MACH", name: "Thức uống dinh dưỡng lúa mạch", optionId: 503, optionLabel: "Lúa mạch", moq: 12, step: 6, contact: 120, prices: [[12, 480000], [30, 455000]] }),
      variant({ id: 202, sku: "B2B-DEMO-SUA-HAT", name: "Sữa hạt pha sẵn", optionId: 504, optionLabel: "Sữa hạt", moq: 12, step: 6, contact: 120, prices: [[12, 510000], [30, 485000]] }),
    ],
  },
  {
    id: 30,
    sku: "B2B-DEMO-NGU-COC-DINH-DUONG",
    slug: "b2b-demo-ngu-coc-dinh-duong",
    name: "Ngũ cốc dinh dưỡng",
    description: "Ngũ cốc dinh dưỡng tiện lợi cho đơn hàng số lượng lớn.",
    variants: [
      variant({ id: 301, sku: "B2B-DEMO-NGU-COC-HAT", name: "Ngũ cốc dinh dưỡng hạt", optionId: 505, optionLabel: "Hạt", moq: 10, step: 5, contact: 100, prices: [[10, 560000], [25, 535000]] }),
      variant({ id: 302, sku: "B2B-DEMO-YEN-MACH", name: "Bột yến mạch hòa tan", optionId: 506, optionLabel: "Yến mạch", moq: 12, step: 6, contact: 120, prices: [[12, 420000], [30, 398000]] }),
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
    label: "Phiên bản",
    options: family.variants.map((item) => ({
      option_id: item.option_values[0].option_id,
      label: item.option_values[0].option_label,
      variant_ids: [item.id],
    })),
  }],
  variant_index: Object.fromEntries(family.variants.map((item) => [String(item.id), { b2b_variant: item.option_values[0].option_id }])),
  variants: family.variants,
});
const parents = families.map(parent);
const detailBySlug = new Map(families.map((family) => [family.slug, detail(family)]));
const listMeta = {
  current_page: 1,
  from: 1,
  last_page: 1,
  path: "/api/b2b/catalog/products",
  per_page: 12,
  to: 3,
  total: 3,
  channel: "default",
  locale: "vi",
  currency: "VND",
  contract_version: 2,
};
const links = { first: null, last: null, prev: null, next: null };
const detailMeta = { channel: "default", locale: "vi", currency: "VND", contract_version: 2 };

function json(response, body) {
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const seenQueries = [];
const fakeSockets = new Set();
const fake = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (url.pathname === "/api/b2b/catalog/categories") {
    return json(response, { data: [category], meta: { channel: "default", locale: "vi", contract_version: 2 } });
  }
  const slug = url.pathname.replace("/api/b2b/catalog/products/", "").replace(/\/$/, "");
  if (url.pathname.startsWith("/api/b2b/catalog/products/") && detailBySlug.has(slug)) {
    return json(response, { data: detailBySlug.get(slug), meta: detailMeta });
  }
  if (slug === "detail-bad-option-index") {
    const malformed = structuredClone(detail(families[0]));
    malformed.variant_index[101].b2b_variant = 999999;
    return json(response, { data: malformed, meta: detailMeta });
  }
  if (slug === "detail-duplicate-sku") {
    const malformed = structuredClone(detail(families[0]));
    malformed.variants[1].sku = malformed.variants[0].sku;
    return json(response, { data: malformed, meta: detailMeta });
  }
  if (slug === "detail-bad-contact") {
    const malformed = structuredClone(detail(families[0]));
    malformed.variants[0].contact_from_quantity = 11;
    return json(response, { data: malformed, meta: detailMeta });
  }
  if (slug === "detail-bad-version") return json(response, { data: detail(families[0]), meta: { ...detailMeta, contract_version: 1 } });
  if (url.pathname.startsWith("/api/b2b/catalog/products/")) return response.writeHead(404).end();
  if (url.pathname !== "/api/b2b/catalog/products") return response.writeHead(404).end();
  const query = url.searchParams.get("q") ?? "";
  seenQueries.push(query);
  if (query === "redirect") return response.writeHead(302, { Location: "/api/b2b/catalog/products" }).end();
  if (query === "timeout") return;
  if (query === "bad-root") return json(response, { data: [] });
  if (query === "empty") return json(response, { data: [], links, meta: { ...listMeta, from: null, to: null, total: 0 } });
  if (query === "bad-version") return json(response, { data: parents, links, meta: { ...listMeta, contract_version: 1 } });
  if (query === "bad-currency") return json(response, { data: parents, links, meta: { ...listMeta, currency: "USD" } });
  if (query === "bad-parent-shape") return json(response, { data: [{ ...parents[0], extra: true }], links, meta: { ...listMeta, total: 1, to: 1 } });
  if (query === "bad-starting-price") return json(response, { data: [{ ...parents[0], starting_price: { unit_price: 720000, currency: "USD" } }], links, meta: { ...listMeta, total: 1, to: 1 } });
  if (query === "bad-image") return json(response, { data: [{ ...parents[0], image: { url: "ftp://bad", alt: "x" } }], links, meta: { ...listMeta, total: 1, to: 1 } });
  return json(response, { data: parents, links, meta: listMeta });
});
fake.on("connection", (socket) => {
  fakeSockets.add(socket);
  socket.on("close", () => fakeSockets.delete(socket));
});

const fakePort = await port();
fake.listen(fakePort, "127.0.0.1");
await once(fake, "listening");
const appPort = await port();
const logs = [];
let browser;
const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(appPort)], {
  env: { ...process.env, BAGISTO_API_URL: `http://127.0.0.1:${fakePort}`, BAGISTO_API_TIMEOUT_MS: "500", NODE_ENV: "production" },
  stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
});
app.stdout.on("data", (chunk) => logs.push(chunk.toString()));
app.stderr.on("data", (chunk) => logs.push(chunk.toString()));

try {
  const origin = `http://127.0.0.1:${appPort}`;
  await waitForServer(`${origin}/`, app, logs);
  for (const [path, status] of [
    ["/san-pham/", 200],
    ["/san-pham/b2b-demo-bot-dinh-duong/", 200],
    ["/san-pham/b2b-demo-thuc-uong-dinh-duong/", 200],
    ["/san-pham/b2b-demo-ngu-coc-dinh-duong/", 200],
    ["/san-pham/missing/", 404],
    ["/san-pham/detail-bad-option-index/", 500],
    ["/san-pham/detail-duplicate-sku/", 500],
    ["/san-pham/detail-bad-contact/", 500],
    ["/san-pham/detail-bad-version/", 500],
    ["/san-pham/a/b/", 404], ["/sua-bot-cho-nguoi-gia/", 200],
    ["/san-pham/?q=empty", 200],
    ["/san-pham/?q=bad-root", 500],
    ["/san-pham/?q=bad-version", 500],
    ["/san-pham/?q=bad-currency", 500],
    ["/san-pham/?q=bad-parent-shape", 500],
    ["/san-pham/?q=bad-starting-price", 500],
    ["/san-pham/?q=bad-image", 500],
    ["/san-pham/?q=redirect", 500], ["/san-pham/?q=timeout", 500],
  ]) {
    const response = await fetchWithTimeout(`${origin}${path}`, {}, path);
    assert.equal(response.status, status, `${path} returned ${response.status}`);
  }
  await fetchWithTimeout(`${origin}/san-pham/?q=${"a".repeat(101)}`, {}, "101 character query");
  assert.equal(seenQueries.at(-1)?.length, 100, "Catalog query must cap at 100 characters");
  const listHtml = await (await fetchWithTimeout(`${origin}/san-pham/`, {}, "catalog input markup")).text();
  assert.match(listHtml, /maxLength="100"/i, "Catalog search input must cap at 100 characters");
  const detailUrl = `${origin}/san-pham/b2b-demo-bot-dinh-duong/`;
  const redirects = new Map([
    ["b2b-demo-bot-dinh-duong-vi-vani", ["b2b-demo-bot-dinh-duong", "B2B-DEMO-BOT-VANI"]],
    ["b2b-demo-bot-dinh-duong-vi-it-ngot", ["b2b-demo-bot-dinh-duong", "B2B-DEMO-BOT-IT-NGOT"]],
    ["b2b-demo-thuc-uong-dinh-duong-lua-mach", ["b2b-demo-thuc-uong-dinh-duong", "B2B-DEMO-LUA-MACH"]],
    ["b2b-demo-sua-hat-pha-san", ["b2b-demo-thuc-uong-dinh-duong", "B2B-DEMO-SUA-HAT"]],
    ["b2b-demo-ngu-coc-dinh-duong-hat", ["b2b-demo-ngu-coc-dinh-duong", "B2B-DEMO-NGU-COC-HAT"]],
    ["b2b-demo-bot-yen-mach-hoa-tan", ["b2b-demo-ngu-coc-dinh-duong", "B2B-DEMO-YEN-MACH"]],
  ]);
  for (const [legacySlug, [parentSlug, sku]] of redirects) {
    const response = await fetchWithTimeout(`${origin}/san-pham/${legacySlug}`, { redirect: "manual" }, legacySlug);
    assert.equal(response.status, 308, `${legacySlug} must permanently redirect`);
    assert.equal(new URL(response.headers.get("location"), origin).pathname, `/san-pham/${parentSlug}/`);
    assert.equal(new URL(response.headers.get("location"), origin).searchParams.get("variant"), sku);
  }

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${origin}/san-pham/`);
  await page.getByText("3 dòng sản phẩm", { exact: true }).waitFor();
  assert.equal(await page.getByText("2 lựa chọn", { exact: true }).count(), 3, "Parent cards must expose variant count");
  await page.getByText(/Từ 720\.000/).waitFor();
  assert.equal(await page.getByText(/Mua từ|Liên hệ từ/).count(), 0, "Parent cards must not invent parent MOQ or contact rules");
  await page.goto(`${origin}/san-pham/?q=empty`);
  await page.getByText("Chưa tìm thấy sản phẩm phù hợp.", { exact: true }).waitFor();
  await page.goto(`${detailUrl}?variant=KHONG-TON-TAI`);
  await page.getByText(/Lựa chọn trong liên kết không còn khả dụng/).waitFor();
  assert.equal(await page.getByRole("radio", { checked: true }).count(), 0, "Invalid variant query must not select a fallback");
  await page.goto(`${detailUrl}?variant=B2B-DEMO-BOT-VANI`);
  assert.equal(await page.getByLabel("Số lượng (thùng)").getAttribute("min"), "10", "Valid variant query must preselect and expose MOQ");
  await page.goto(detailUrl);
  await page.getByText("Chọn Hương vị", { exact: true }).waitFor();
  assert.equal(await page.getByText(/720\.000|Số lượng đặt tối thiểu|Giá theo số lượng|Gửi yêu cầu đặt|Liên hệ nhận giá/).count(), 0, "Unselected detail must hide variant commerce data");
  assert.equal(await page.getByRole("radio", { name: "Ít ngọt" }).isDisabled(), true, "Unavailable variant must remain visible and disabled");
  assert.equal(await page.getByText("Tạm hết hàng").count(), 1, "Unavailable variant needs a reason");
  assert.equal(await page.getByRole("link", { name: /Gửi yêu cầu đặt|Liên hệ nhận giá/ }).count(), 0, "No purchase CTA may exist before selection");
  await page.getByRole("radio", { name: "Vani" }).check();
  const quantity = page.getByLabel("Số lượng (thùng)");
  assert.equal(await quantity.inputValue(), "10", "Selecting a variant resets quantity to its MOQ");
  await quantity.fill("95");
  const orderHref = await page.getByRole("link", { name: /Gửi yêu cầu đặt/ }).getAttribute("href");
  assert.equal(new URL(orderHref, origin).searchParams.get("intent"), "order");
  assert.equal(new URL(orderHref, origin).searchParams.get("product"), "b2b-demo-bot-dinh-duong");
  assert.equal(new URL(orderHref, origin).searchParams.get("variant_sku"), "B2B-DEMO-BOT-VANI");
  assert.equal(new URL(orderHref, origin).searchParams.get("quantity"), "95");
  await quantity.fill("100");
  const quoteHref = await page.getByRole("link", { name: /Liên hệ nhận giá/ }).getAttribute("href");
  assert.equal(new URL(quoteHref, origin).searchParams.get("intent"), "quote", "Contact threshold must be inclusive");

  await page.goto(`${origin}/san-pham/b2b-demo-ngu-coc-dinh-duong/`);
  await page.getByRole("radio", { name: "Hạt" }).check();
  await page.getByLabel("Số lượng (thùng)").fill("95");
  await page.getByRole("radio", { name: "Yến mạch" }).check();
  const switchedQuantity = page.getByLabel("Số lượng (thùng)");
  assert.equal(await switchedQuantity.inputValue(), "12", "Variant switch must reset quantity to the new MOQ");
  assert.equal(await switchedQuantity.getAttribute("step"), "6");
  assert.match(await page.locator("main").innerText(), /420\.000[\s\S]*?120 thùng/i, "Variant switch must update price and contact threshold atomically");
  const homeHtml = await (await fetchWithTimeout(`${origin}/`, {}, "home navigation markup")).text();
  assert.match(homeHtml, />Mua hàng</i, "Primary navigation must expose the shopping path");
  assert.match(homeHtml, />Thuê gia công</i, "Primary navigation must expose the manufacturing-service path");
  assert.match(
    homeHtml,
    /<button[^>]*aria-controls="clone-service-menu-desktop"[^>]*aria-expanded="false"[^>]*aria-label="Mở menu Thuê gia công"[^>]*>/i,
    "Manufacturing-service navigation must expose a separate accessible disclosure",
  );
  assert.doesNotMatch(
    homeHtml,
    /<li[^>]*id="menu-item-1742"[^>]*has-dropdown/i,
    "Shopping navigation must be a direct link without a mega menu",
  );
  assert.doesNotMatch(
    homeHtml,
    /Mua hàng<i class="icon-angle-down"><\/i>/i,
    "Shopping navigation must not render a dropdown affordance",
  );
} finally {
  await browser?.close();
  await stopChild(app, appPort, logs);
  fakeSockets.forEach((socket) => socket.destroy());
  await new Promise((resolve, reject) => fake.close((error) => error ? reject(error) : resolve()));
  await waitForPortToClose(fakePort);
}
