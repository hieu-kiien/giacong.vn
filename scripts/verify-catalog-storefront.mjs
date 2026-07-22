import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
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
const seenCatalogRequests = [];
let malformedCategoryResponsesRemaining = 1;
const fakeSockets = new Set();
const fake = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (url.pathname.startsWith("/api/b2b/catalog/")) {
    seenCatalogRequests.push({ pathname: url.pathname, query: url.search });
  }
  if (url.pathname === "/api/b2b/catalog/categories") {
    if (malformedCategoryResponsesRemaining > 0) {
      malformedCategoryResponsesRemaining -= 1;
      return json(response, { data: [category] });
    }
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
  if (query === "pending-probe") {
    setTimeout(() => json(response, { data: parents, links, meta: listMeta }), 250);
    return;
  }
  if (query === "bad-root") return json(response, { data: [] });
  if (query === "recover-after-malformed" && seenQueries.filter((item) => item === query).length === 1) {
    return json(response, { data: [] });
  }
  if (query === "empty" || query === "không tồn tại") {
    return json(response, { data: [], links, meta: { ...listMeta, from: null, to: null, total: 0 } });
  }
  if (query === "bad-version") return json(response, { data: parents, links, meta: { ...listMeta, contract_version: 1 } });
  if (query === "bad-currency") return json(response, { data: parents, links, meta: { ...listMeta, currency: "USD" } });
  if (query === "bad-parent-shape") return json(response, { data: [{ ...parents[0], extra: true }], links, meta: { ...listMeta, total: 1, to: 1 } });
  if (query === "bad-starting-price") return json(response, { data: [{ ...parents[0], starting_price: { unit_price: 720000, currency: "USD" } }], links, meta: { ...listMeta, total: 1, to: 1 } });
  if (query === "bad-image") return json(response, { data: [{ ...parents[0], image: { url: "ftp://bad", alt: "x" } }], links, meta: { ...listMeta, total: 1, to: 1 } });
  if (query === "ngũ cốc") return json(response, {
    data: [parents[2]],
    links,
    meta: { ...listMeta, from: 1, to: 1, total: 1 },
  });
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
const browserIssues = [];
const screenshots = join(tmpdir(), `storefront-task-2-${Date.now()}`);
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
  const categoryRecoveryStart = seenCatalogRequests.length;
  assert.equal(
    (await fetchWithTimeout(`${origin}/san-pham/?q=category-recovery`, {}, "malformed category payload")).status,
    500,
    "Malformed category HTTP 200 must fail strict parsing",
  );
  assert.equal(
    (await fetchWithTimeout(`${origin}/san-pham/?q=category-recovery`, {}, "valid category retry")).status,
    200,
    "Category retry must recover after a malformed HTTP 200",
  );
  assert.equal(
    seenCatalogRequests.slice(categoryRecoveryStart).filter((item) => item.pathname === "/api/b2b/catalog/categories").length,
    2,
    "Malformed category HTTP 200 must not enter the validated cache",
  );
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
    ["/san-pham/?q=recover-after-malformed", 500],
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
  for (const request of seenCatalogRequests) {
    const parameters = new URLSearchParams(request.query);
    assert.equal(parameters.get("channel"), "default", `${request.pathname} cache key must include channel`);
    assert.equal(parameters.get("locale"), "vi", `${request.pathname} cache key must include locale`);
  }
  const apiSource = await readFile("src/lib/bagisto-api.ts", "utf8");
  const catalogSource = await readFile("src/lib/bagisto-catalog.ts", "utf8");
  assert.match(catalogSource, /searchParams\.set\("channel"/, "Public catalog cache key must include the channel");
  assert.match(catalogSource, /searchParams\.set\("locale"/, "Public catalog cache key must include the locale");
  assert.match(catalogSource, /catalog-products-v2[\s\S]*?revalidate:\s*30/, "Validated product DTOs need a 30 second cache wrapper");
  assert.match(catalogSource, /catalog-categories-v2[\s\S]*?revalidate:\s*300/, "Validated category DTOs need a 300 second cache wrapper");
  assert.match(catalogSource, /fetchBagistoJson\(url, \{ cache:\s*"no-store"/, "Raw catalog responses must never enter the fetch cache");
  assert.doesNotMatch(apiSource, /force-cache/, "The shared Bagisto transport must not cache unvalidated responses");
  const recovered = await fetchWithTimeout(`${origin}/san-pham/?q=recover-after-malformed`, {}, "validated retry after malformed payload");
  assert.equal(recovered.status, 200, "A malformed HTTP 200 response must not poison the validated catalog cache");
  assert.equal(
    seenQueries.filter((item) => item === "recover-after-malformed").length,
    2,
    "Retry after malformed HTTP 200 must reach the upstream API again",
  );
  const cachedListStart = seenCatalogRequests.length;
  await fetchWithTimeout(`${origin}/san-pham/?q=cache-probe`, {}, "first cached catalog request");
  await fetchWithTimeout(`${origin}/san-pham/?q=cache-probe`, {}, "second cached catalog request");
  const cachedListRequests = seenCatalogRequests.slice(cachedListStart);
  assert.equal(
    cachedListRequests.filter((item) => item.pathname === "/api/b2b/catalog/products" && item.query.includes("q=cache-probe")).length,
    1,
    "Repeat public catalog requests must reuse the Next data cache",
  );
  assert.ok(
    cachedListRequests.filter((item) => item.pathname === "/api/b2b/catalog/categories").length <= 1,
    "Repeat category requests must reuse the Next data cache",
  );
  const coldTimings = [];
  const warmTimings = [];
  const measure = async (label, target) => {
    const start = performance.now();
    await fetchWithTimeout(target, {}, label);
    return performance.now() - start;
  };
  coldTimings.push(await measure("cold catalog timing", `${origin}/san-pham/?q=timing-probe`));
  for (let index = 0; index < 5; index += 1) warmTimings.push(await measure(`warm catalog timing ${index}`, `${origin}/san-pham/?q=timing-probe`));
  const detailUrl = `${origin}/san-pham/b2b-demo-bot-dinh-duong/`;
  const detailStart = seenCatalogRequests.length;
  await fetchWithTimeout(detailUrl, {}, "first uncached detail request");
  await fetchWithTimeout(detailUrl, {}, "second uncached detail request");
  assert.equal(
    seenCatalogRequests.slice(detailStart).filter((item) => item.pathname === "/api/b2b/catalog/products/b2b-demo-bot-dinh-duong").length,
    2,
    "Inventory-sensitive detail requests must not be cached across page loads",
  );
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
  await mkdir(screenshots, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("console", (message) => { if (message.type() === "error") browserIssues.push(message.text()); });
  page.on("pageerror", (error) => browserIssues.push(error.message));
  const directDetailStart = seenCatalogRequests.length;
  await page.goto(`${origin}/san-pham/`);
  await page.getByText("3 dòng sản phẩm", { exact: true }).waitFor();
  assert.equal(
    seenCatalogRequests.slice(directDetailStart).filter((item) => item.pathname.startsWith("/api/b2b/catalog/products/")).length,
    0,
    "Catalog discovery must not request product details before explicit intent",
  );
  assert.equal(await page.getByRole("button", { name: "Lọc sản phẩm" }).count(), 0, "Catalog filters must not require a separate submit action");
  const combinedFilterStart = seenCatalogRequests.length;
  await page.getByLabel("Tìm sản phẩm").fill("ngũ cốc");
  await page.getByRole("button", { name: "Dinh dưỡng" }).click();
  await page.waitForURL((url) => url.searchParams.get("q") === "ngũ cốc" && url.searchParams.get("category") === "dinh-duong");
  await page.getByText("1 dòng sản phẩm", { exact: true }).waitFor();
  assert.ok(
    seenCatalogRequests.slice(combinedFilterStart).some((item) => {
      const parameters = new URLSearchParams(item.query);
      return parameters.get("q") === "ngũ cốc" && parameters.get("category") === "dinh-duong";
    }),
    "Category selection must submit the current search draft to the upstream API",
  );
  await page.goBack();
  await page.getByText("3 dòng sản phẩm", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("Tìm sản phẩm").inputValue(), "", "Back must restore the previous search input");
  assert.equal(await page.getByRole("button", { name: "Tất cả" }).getAttribute("aria-pressed"), "true", "Back must restore the previous category chip");
  await page.goForward();
  await page.getByText("1 dòng sản phẩm", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("Tìm sản phẩm").inputValue(), "ngũ cốc", "Forward must restore the submitted search draft");
  assert.equal(await page.getByRole("button", { name: "Dinh dưỡng" }).getAttribute("aria-pressed"), "true", "Forward must restore the selected category chip");
  await page.goBack();
  await page.getByText("3 dòng sản phẩm", { exact: true }).waitFor();
  await page.getByLabel("Tìm sản phẩm").fill("ngũ cốc");
  await page.getByLabel("Tìm sản phẩm").press("Enter");
  await page.getByText("1 dòng sản phẩm", { exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("q"), "ngũ cốc", "Enter search must update the catalog URL");
  assert.ok(seenQueries.includes("ngũ cốc"), "Client search must request the server-filtered catalog result");
  await page.getByLabel("Tìm sản phẩm").fill("");
  await page.getByLabel("Tìm sản phẩm").press("Enter");
  await page.getByText("3 dòng sản phẩm", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Dinh dưỡng" }).click();
  await page.getByText("3 dòng sản phẩm", { exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("category"), "dinh-duong", "Category chip must update the catalog URL");
  await page.goBack();
  await page.getByText("3 dòng sản phẩm", { exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.has("category"), false, "Back navigation must restore the prior category URL");
  assert.equal(await page.getByRole("button", { name: "Tất cả" }).getAttribute("aria-pressed"), "true", "Back navigation must restore the active category chip");
  await page.goForward();
  await page.waitForURL((url) => url.searchParams.get("category") === "dinh-duong");
  assert.equal(await page.getByRole("button", { name: "Dinh dưỡng" }).getAttribute("aria-pressed"), "true", "Forward navigation must restore the selected category chip");
  await page.goBack();
  await page.getByText("3 dòng sản phẩm", { exact: true }).waitFor();
  await page.getByLabel("Tìm sản phẩm").fill("pending-probe");
  await page.getByLabel("Tìm sản phẩm").press("Enter");
  await page.getByText("Đang cập nhật danh mục...", { exact: true }).waitFor();
  await page.getByText("3 dòng sản phẩm", { exact: true }).waitFor();
  await page.getByLabel("Tìm sản phẩm").fill("");
  await page.getByLabel("Tìm sản phẩm").press("Enter");
  await page.getByText("3 dòng sản phẩm", { exact: true }).waitFor();
  await page.getByLabel("Tìm sản phẩm").fill("không tồn tại");
  await page.getByLabel("Tìm sản phẩm").press("Enter");
  await page.getByText("Chưa tìm thấy sản phẩm phù hợp.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Xem toàn bộ sản phẩm" }).click();
  await page.getByText("3 dòng sản phẩm", { exact: true }).waitFor();
  assert.equal(await page.getByText("2 phiên bản", { exact: true }).count(), 3, "Parent cards must expose variant count");
  assert.equal(await page.locator(".echbay-sms-messenger, .bottom-contact").count(), 0, "Catalog routes must not render floating contact bubbles");
  assert.equal(await page.locator(`${"[data-catalog-card]"} a[href*='/san-pham/']`).count(), 3, "Each parent card needs one clear detail action");
  await page.screenshot({ path: join(screenshots, "catalog-1440.png"), fullPage: true });
  await page.getByText(/Từ 720\.000/).waitFor();
  assert.equal(await page.getByText(/Mua từ|Liên hệ từ/).count(), 0, "Parent cards must not invent parent MOQ or contact rules");
  await page.goto(`${origin}/san-pham/?q=empty`);
  await page.getByText("Chưa tìm thấy sản phẩm phù hợp.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Xem toàn bộ sản phẩm" }).click();
  await page.getByText("3 dòng sản phẩm", { exact: true }).waitFor();
  assert.equal(new URL(page.url()).search, "", "Clearing a server-rendered empty result must restore the full catalog URL");
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
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mobile.on("console", (message) => { if (message.type() === "error") browserIssues.push(message.text()); });
  mobile.on("pageerror", (error) => browserIssues.push(error.message));
  await mobile.goto(`${origin}/san-pham/`);
  await mobile.getByText("3 dòng sản phẩm", { exact: true }).waitFor();
  assert.equal(await mobile.locator(".echbay-sms-messenger, .bottom-contact").count(), 0, "Mobile catalog must not render floating overlays");
  assert.equal(await mobile.locator("[data-catalog-grid]").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length), 1, "390px catalog must render one card column");
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, "390px catalog must not overflow horizontally");
  await mobile.screenshot({ path: join(screenshots, "catalog-390.png"), fullPage: true });
  await mobile.close();
  assert.deepEqual(browserIssues, [], "Catalog browser console must be clean");
  assert.ok(median(warmTimings) <= 800, `Warm catalog p50 must remain under 800ms (received ${median(warmTimings).toFixed(1)}ms)`);
  console.log(JSON.stringify({ coldCatalogP50Ms: median(coldTimings), screenshots, warmCatalogP50Ms: median(warmTimings) }));
} finally {
  await browser?.close();
  await stopChild(app, appPort, logs);
  fakeSockets.forEach((socket) => socket.destroy());
  await new Promise((resolve, reject) => fake.close((error) => error ? reject(error) : resolve()));
  await waitForPortToClose(fakePort);
}
