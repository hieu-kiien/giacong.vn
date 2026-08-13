import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

import { nextBinPath } from "./next-bin.mjs";

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

/** Upstream product-list requests recorded after `start`, filtered by query. */
function listRequestsSince(start, predicate) {
  return seenCatalogRequests
    .slice(start)
    .filter((item) => item.pathname === "/api/b2b/catalog/products")
    .filter((item) => predicate(new URLSearchParams(item.query)));
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function catalogSearch(page) {
  return page.getByRole("searchbox", { name: "Tìm sản phẩm" });
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

/**
 * A flavour x size matrix. Bagisto can serve this today: `product_super_attributes`
 * is many-to-many, `CatalogProductResource::optionGroups()` maps every super
 * attribute, and the variant SQL counts option values against the parent's full
 * super-attribute set. The Next parser and `ProductConfigurator` are single-axis,
 * so the contract rejects the payload rather than rendering a selector that would
 * resolve the wrong SKU. Locked deliberately until the configurator is multi-axis.
 */
const twoAxisAttributes = [
  { attribute_id: 50, code: "b2b_variant", label: "Hương vị", options: [[501, "Vani"], [502, "Ít ngọt"]] },
  { attribute_id: 51, code: "b2b_size", label: "Quy cách", options: [[601, "500g"], [602, "1kg"]] },
];
const twoAxisVariants = [
  [501, "Vani", 601, "500g"],
  [501, "Vani", 602, "1kg"],
  [502, "Ít ngọt", 601, "500g"],
  [502, "Ít ngọt", 602, "1kg"],
].map(([flavourId, flavourLabel, sizeId, sizeLabel], index) => ({
  id: 401 + index,
  sku: `B2B-DEMO-MATRIX-${401 + index}`,
  name: `Bột dinh dưỡng ${flavourLabel} ${sizeLabel}`,
  option_values: [
    { attribute_id: 50, attribute_code: "b2b_variant", option_id: flavourId, option_label: flavourLabel },
    { attribute_id: 51, attribute_code: "b2b_size", option_id: sizeId, option_label: sizeLabel },
  ],
  image: null,
  unit: "thùng",
  moq: 10,
  quantity_step: 5,
  contact_from_quantity: 100,
  availability: { is_available: true },
  tier_prices: [tier(10, 720000 + index * 1000), tier(25, 690000 + index * 1000)],
}));
const twoAxisDetail = {
  id: 40,
  type: "configurable",
  sku: "B2B-DEMO-MATRIX",
  slug: "detail-two-axis",
  name: "Bột dinh dưỡng ma trận",
  description: "Bột dinh dưỡng với hai trục lựa chọn.",
  image: null,
  categories: [category],
  variant_count: twoAxisVariants.length,
  available_variant_count: twoAxisVariants.length,
  starting_price: {
    unit_price: Math.min(...twoAxisVariants.map((item) => item.tier_prices[0].unit_price)),
    currency: "VND",
  },
  option_groups: twoAxisAttributes.map((attribute) => ({
    attribute_id: attribute.attribute_id,
    code: attribute.code,
    label: attribute.label,
    options: attribute.options.map(([optionId, label]) => ({
      option_id: optionId,
      label,
      variant_ids: twoAxisVariants
        .filter((item) => item.option_values.some((value) => value.option_id === optionId))
        .map((item) => item.id),
    })),
  })),
  variant_index: Object.fromEntries(twoAxisVariants.map((item) => [
    String(item.id),
    Object.fromEntries(item.option_values.map((value) => [value.attribute_code, value.option_id])),
  ])),
  variants: twoAxisVariants,
};
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
  if (slug === "detail-two-axis") return json(response, { data: twoAxisDetail, meta: detailMeta });
  if (slug === "preview-invalid-upstream") return response.writeHead(422).end();
  if (slug === "preview-malformed") {
    response.writeHead(200, { "Content-Type": "application/json" });
    return response.end("{");
  }
  if (slug === "preview-network") return request.socket.destroy();
  if (slug === "preview-timeout") return;
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
  const requestedPerPage = Number(url.searchParams.get("per_page"));
  const perPage = Number.isInteger(requestedPerPage) && requestedPerPage > 0 ? requestedPerPage : listMeta.per_page;
  const ordered = url.searchParams.get("direction") === "desc" ? [...parents].reverse() : parents;
  return json(response, { data: ordered, links, meta: { ...listMeta, per_page: perPage } });
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
const app = spawn(process.execPath, [nextBinPath, "start", "-p", String(appPort)], {
  env: { ...process.env, BAGISTO_API_URL: `http://127.0.0.1:${fakePort}`, BAGISTO_API_TIMEOUT_MS: "500", NODE_ENV: "production" },
  stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
});
app.stdout.on("data", (chunk) => logs.push(chunk.toString()));
app.stderr.on("data", (chunk) => logs.push(chunk.toString()));

try {
  const origin = `http://127.0.0.1:${appPort}`;
  await waitForServer(`${origin}/`, app, logs);
  const purchaseAlias = await fetchWithTimeout(
    `${origin}/mua-hang?q=bot&category=dinh-duong`,
    { redirect: "manual" },
    "permanent purchase alias",
  );
  assert.equal(purchaseAlias.status, 308, "The /mua-hang alias must be a permanent redirect");
  assert.equal(
    purchaseAlias.headers.get("location"),
    "/san-pham?q=bot&category=dinh-duong",
    "The purchase alias must preserve catalog query parameters",
  );
  for (const [slug, status, error] of [
    ["x".repeat(161), 422, "invalid_product"],
    ["missing", 404, "product_not_found"],
    ["preview-invalid-upstream", 422, "catalog_unavailable"],
    ["preview-malformed", 502, "catalog_unavailable"],
    ["detail-bad-option-index", 502, "catalog_unavailable"],
    ["preview-network", 502, "catalog_unavailable"],
    ["preview-timeout", 504, "catalog_unavailable"],
  ]) {
    const response = await fetchWithTimeout(`${origin}/api/catalog/products/${slug}`, {}, `safe catalog detail endpoint ${slug}`);
    assert.equal(response.status, status, `Catalog detail endpoint must map ${slug} to a safe status`);
    assert.equal(response.headers.get("cache-control"), "no-store", "Catalog detail responses must be no-store");
    assert.deepEqual(await response.json(), { error }, "Catalog detail endpoint must not expose upstream errors or payloads");
  }
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
    ["/san-pham/detail-two-axis/", 500],
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
  assert.match(catalogSource, /catalog is deliberately read fresh on every request/i, "Catalog reads must stay fresh after an Admin save");
  assert.doesNotMatch(catalogSource, /revalidate:\s*\d+/, "Catalog must not retain validated DTOs across requests");
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
  await fetchWithTimeout(`${origin}/san-pham/?q=cache-probe`, {}, "first fresh catalog request");
  await fetchWithTimeout(`${origin}/san-pham/?q=cache-probe`, {}, "second fresh catalog request");
  const cachedListRequests = seenCatalogRequests.slice(cachedListStart);
  assert.equal(
    cachedListRequests.filter((item) => item.pathname === "/api/b2b/catalog/products" && item.query.includes("q=cache-probe")).length,
    2,
    "Repeat public catalog requests must reread Bagisto after an Admin save",
  );
  assert.ok(
    cachedListRequests.filter((item) => item.pathname === "/api/b2b/catalog/categories").length,
    2,
    "Repeat category requests must reread Bagisto while each render dedupes locally",
  );
  const sortStart = seenCatalogRequests.length;
  assert.equal(
    (await fetchWithTimeout(`${origin}/san-pham/?sort=starting_price&direction=desc`, {}, "sorted catalog")).status,
    200,
    "A sorted catalog request must render",
  );
  assert.equal(
    listRequestsSince(sortStart, (parameters) => (
      parameters.get("sort") === "starting_price" && parameters.get("direction") === "desc"
    )).length,
    1,
    "Sort and direction must reach the upstream catalog API",
  );

  const ascendingStart = seenCatalogRequests.length;
  await fetchWithTimeout(`${origin}/san-pham/?sort=starting_price&direction=asc`, {}, "ascending catalog");
  assert.equal(
    listRequestsSince(ascendingStart, (parameters) => parameters.get("direction") === "asc").length,
    1,
    "A different direction must reach the upstream catalog API",
  );
  const repeatSortStart = seenCatalogRequests.length;
  await fetchWithTimeout(`${origin}/san-pham/?sort=starting_price&direction=desc`, {}, "repeat sorted catalog");
  assert.equal(
    listRequestsSince(repeatSortStart, () => true).length,
    1,
    "An identical sorted request must reread Bagisto after an Admin save",
  );

  const pageSizeStart = seenCatalogRequests.length;
  await fetchWithTimeout(`${origin}/san-pham/?per_page=24`, {}, "explicit page size");
  assert.equal(
    listRequestsSince(pageSizeStart, (parameters) => parameters.get("per_page") === "24").length,
    1,
    "An allowlisted page size must reach the upstream catalog API",
  );

  const rejectedStart = seenCatalogRequests.length;
  await fetchWithTimeout(
    `${origin}/san-pham/?q=reject-probe&sort=catalog_name%3B+DROP+TABLE+products&direction=rand()&per_page=7`,
    {},
    "rejected catalog parameters",
  );
  const rejected = listRequestsSince(rejectedStart, (parameters) => parameters.get("q") === "reject-probe");
  assert.equal(rejected.length, 1, "A request with unsupported parameters must still reach the upstream API once");
  const rejectedParameters = new URLSearchParams(rejected[0].query);
  assert.equal(rejectedParameters.get("sort"), "name", "An unsupported sort column must normalise to the default");
  assert.equal(rejectedParameters.get("direction"), "asc", "An unsupported direction must normalise to the default");
  assert.equal(rejectedParameters.get("per_page"), "12", "An unsupported page size must normalise to the default");
  assert.doesNotMatch(rejected[0].query, /DROP\+TABLE|DROP%20TABLE|rand\(\)/, "Rejected values must never be forwarded");

  const collapseStart = seenCatalogRequests.length;
  await fetchWithTimeout(
    `${origin}/san-pham/?sort=not-a-column&direction=sideways&per_page=99&page=0`,
    {},
    "unsupported parameters collapsing onto the canonical entry",
  );
  assert.equal(
    listRequestsSince(collapseStart, () => true).length,
    1,
    "Unsupported parameters must normalise before a fresh Bagisto read",
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
  await page.getByText("Hiển thị 1–3 trong 3 sản phẩm", { exact: true }).waitFor();
  assert.equal(
    seenCatalogRequests.slice(directDetailStart).filter((item) => item.pathname.startsWith("/api/b2b/catalog/products/")).length,
    0,
    "Catalog discovery must not request product details before explicit intent",
  );
  const initialMetrics = await page.evaluate(() => {
    const scripts = performance.getEntriesByType("resource")
      .filter((entry) => entry instanceof PerformanceResourceTiming && entry.initiatorType === "script");
    return {
      domNodes: document.querySelectorAll("*").length,
      scriptEncodedBodyBytes: scripts.reduce((total, entry) => total + entry.encodedBodySize, 0),
      scriptRequests: scripts.length,
      scriptTransferBytes: scripts.reduce((total, entry) => total + entry.transferSize, 0),
    };
  });
  // The catalog tab uses the shared captured News frame; request-cart behavior
  // has its own browser check in `qa:cart`.
  const header = page.locator("#header");
  await header.waitFor();
  assert.equal(await header.count(), 1, "Catalog routes must render exactly one captured header");
  assert.match(await header.locator("#menu-item-1742").getAttribute("class") ?? "", /\bactive\b/, "The catalog tab must be active in the captured navigation");
  assert.equal(await header.locator("#menu-item-1742 > a").getAttribute("href"), "/san-pham/", "The captured product tab must point to the catalog");

  // Catalog list hierarchy. Breadcrumb → H1 → count → search → filters → grid,
  // with filter state in the URL so a filtered list is shareable.
  assert.equal(await page.locator("h1").innerText(), "SẢN PHẨM", "The catalog needs the captured archive heading");
  // giacong.vn's shop archive is full width — its markup is `col large-12`, with no
  // filter rail at any breakpoint. The 230px sidebar this harness used to require was
  // drawn for `SCR-02` before the captured pages became the reference, and
  // `scripts/catalog-listing.test.mts` now forbids that element outright. The filters
  // live in a toolbar above the grid instead, so what is asserted here is that the
  // rail is gone and the controls are still reachable.
  const sidebar = page.getByRole("complementary", { name: "Bộ lọc sản phẩm" });
  assert.equal(await sidebar.count(), 0, "1440px must not render a filter sidebar the real archive lacks");
  assert.equal(
    await page.getByRole("button", { name: "Tất cả" }).evaluate((element) => getComputedStyle(element).backgroundColor),
    "rgb(90, 164, 0)",
    "The active category chip must use the brand green, not a generic grayscale fill",
  );
  const sortStart2 = seenCatalogRequests.length;
  // `available_variant_count` is not used by an earlier assertion, so this must
  // reach the upstream API. The sort control offers the archive's own ordering set, in which
  // `available_variant_count` is the column behind `Nhiều quy cách nhất`; the plain
  // `variant_count` this used to select is still a valid upstream column but no
  // longer one the UI exposes.
  await page.getByLabel("Sắp xếp").selectOption("available_variant_count:desc");
  await page.waitForURL((url) => url.searchParams.get("sort") === "available_variant_count" && url.searchParams.get("direction") === "desc");
  assert.ok(
    listRequestsSince(sortStart2, (parameters) => (
      parameters.get("sort") === "available_variant_count" && parameters.get("direction") === "desc"
    )).length >= 1,
    "The sort control must reach the upstream catalog API",
  );
  const ascendingSortStart = seenCatalogRequests.length;
  await page.getByLabel("Sắp xếp").selectOption("name:asc");
  // `catalogHref` omits the default sort and direction to keep one canonical URL
  // per result set; the upstream request still carries both explicitly.
  await page.waitForURL((url) => !url.searchParams.has("sort") && !url.searchParams.has("direction"));
  assert.ok(
    listRequestsSince(ascendingSortStart, (parameters) => (
      parameters.get("sort") === "name" && parameters.get("direction") === "asc"
    )).length >= 1,
    "Returning to the default sort must reread Bagisto",
  );
  assert.equal(new URL(page.url()).search, "", "Returning to the default sort must restore the canonical catalog URL");

  // Responsive sweep on a throwaway page so the locked 1440px flow is untouched.
  const responsive = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  responsive.on("pageerror", (error) => browserIssues.push(error.message));
  await responsive.goto(`${origin}/san-pham/`);
  await responsive.getByText("Hiển thị 1–3 trong 3 sản phẩm", { exact: true }).waitFor();
  // The current responsive grid is 1 → 2 → 3 → 4 columns.
  for (const [width, columns] of [[1440, 4], [1024, 4], [768, 3], [320, 1]]) {
    await responsive.setViewportSize({ width, height: 900 });
    assert.equal(
      await responsive.locator("[data-catalog-grid]").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length),
      columns,
      `${width}px catalog must render ${columns} card column(s)`,
    );
    // Native select options can have an intrinsic scroll width larger than the
    // closed control. Measure rendered bounds rather than that internal width.
    assert.deepEqual(
      await responsive.locator("#main *").evaluateAll((elements) => elements
        .filter((element) => !element.classList.contains("sr-only"))
        .filter((element) => {
          const { left, right } = element.getBoundingClientRect();
          return left < -1 || right > window.innerWidth + 1;
        })
        .map((element) => `${element.tagName.toLowerCase()}.${element.className}`.slice(0, 60))
        .slice(0, 5)),
      [],
      `${width}px catalog must not overflow horizontally inside the page`,
    );
    // No filter rail at any width, and none behind a disclosure either.
    assert.equal(
      await responsive.getByRole("complementary", { name: "Bộ lọc sản phẩm" }).count(),
      0,
      `${width}px must not render a filter sidebar`,
    );
  }

  // With no drawer to hide behind, every filter has to be directly reachable at the
  // narrowest width — that is the whole reason the rail could be dropped.
  await responsive.setViewportSize({ width: 390, height: 844 });
  assert.equal(await responsive.getByRole("dialog", { name: "Bộ lọc sản phẩm" }).count(), 0, "390px must not gate filters behind a drawer");
  assert.equal(await responsive.getByRole("button", { name: "Bộ lọc" }).count(), 0, "390px must not need a filter drawer trigger");
  await catalogSearch(responsive).waitFor({ state: "visible" });
  await responsive.getByLabel("Sắp xếp").waitFor({ state: "visible" });
  assert.equal(
    await responsive.getByRole("button", { name: "Dinh dưỡng" }).isVisible(),
    true,
    "390px must keep the category chips visible inline",
  );
  await responsive.close();

  assert.equal(await page.getByRole("button", { name: "Lọc sản phẩm" }).count(), 0, "Catalog filters must not require a separate submit action");
  const combinedFilterStart = seenCatalogRequests.length;
  await catalogSearch(page).fill("ngũ cốc");
  await page.getByRole("button", { name: "Dinh dưỡng" }).click();
  await page.waitForURL((url) => url.searchParams.get("q") === "ngũ cốc" && url.searchParams.get("category") === "dinh-duong");
  await page.getByText("Hiển thị 1–1 trong 1 sản phẩm", { exact: true }).waitFor();
  assert.ok(
    seenCatalogRequests.slice(combinedFilterStart).some((item) => {
      const parameters = new URLSearchParams(item.query);
      return parameters.get("q") === "ngũ cốc" && parameters.get("category") === "dinh-duong";
    }),
    "Category selection must submit the current search draft to the upstream API",
  );
  await page.goBack();
  await page.getByText("Hiển thị 1–3 trong 3 sản phẩm", { exact: true }).waitFor();
  assert.equal(await catalogSearch(page).inputValue(), "", "Back must restore the previous search input");
  assert.equal(await page.getByRole("button", { name: "Tất cả" }).getAttribute("aria-pressed"), "true", "Back must restore the previous category chip");
  await page.goForward();
  await page.getByText("Hiển thị 1–1 trong 1 sản phẩm", { exact: true }).waitFor();
  assert.equal(await catalogSearch(page).inputValue(), "ngũ cốc", "Forward must restore the submitted search draft");
  assert.equal(await page.getByRole("button", { name: "Dinh dưỡng" }).getAttribute("aria-pressed"), "true", "Forward must restore the selected category chip");
  await page.goBack();
  await page.getByText("Hiển thị 1–3 trong 3 sản phẩm", { exact: true }).waitFor();
  await catalogSearch(page).fill("ngũ cốc");
  await catalogSearch(page).press("Enter");
  await page.waitForURL((url) => url.searchParams.get("q") === "ngũ cốc" && !url.searchParams.has("category"));
  await page.getByText("Hiển thị 1–1 trong 1 sản phẩm", { exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("q"), "ngũ cốc", "Enter search must update the catalog URL");
  assert.ok(seenQueries.includes("ngũ cốc"), "Client search must request the server-filtered catalog result");
  await page.getByRole("button", { name: "Dinh dưỡng" }).click();
  await page.waitForURL((url) => url.searchParams.get("q") === "ngũ cốc" && url.searchParams.get("category") === "dinh-duong");
  await catalogSearch(page).fill("bột");
  await page.goBack();
  await page.waitForURL((url) => url.searchParams.get("q") === "ngũ cốc" && !url.searchParams.has("category"));
  assert.equal(await catalogSearch(page).inputValue(), "ngũ cốc", "Back between committed filters with the same query must discard the unsubmitted draft");
  await page.goForward();
  await page.waitForURL((url) => url.searchParams.get("q") === "ngũ cốc" && url.searchParams.get("category") === "dinh-duong");
  assert.equal(await catalogSearch(page).inputValue(), "ngũ cốc", "Forward must restore the committed query when category changes but query does not");
  await page.goBack();
  await page.waitForURL((url) => url.searchParams.get("q") === "ngũ cốc" && !url.searchParams.has("category"));
  await catalogSearch(page).fill("");
  await catalogSearch(page).press("Enter");
  await page.getByText("Hiển thị 1–3 trong 3 sản phẩm", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Dinh dưỡng" }).click();
  await page.getByText("Hiển thị 1–3 trong 3 sản phẩm", { exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("category"), "dinh-duong", "Category chip must update the catalog URL");
  await page.goBack();
  await page.getByText("Hiển thị 1–3 trong 3 sản phẩm", { exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.has("category"), false, "Back navigation must restore the prior category URL");
  assert.equal(await page.getByRole("button", { name: "Tất cả" }).getAttribute("aria-pressed"), "true", "Back navigation must restore the active category chip");
  await page.goForward();
  await page.waitForURL((url) => url.searchParams.get("category") === "dinh-duong");
  assert.equal(await page.getByRole("button", { name: "Dinh dưỡng" }).getAttribute("aria-pressed"), "true", "Forward navigation must restore the selected category chip");
  await page.goBack();
  await page.getByText("Hiển thị 1–3 trong 3 sản phẩm", { exact: true }).waitFor();
  await catalogSearch(page).fill("pending-probe");
  await catalogSearch(page).press("Enter");
  await page.getByText("Đang cập nhật danh mục...", { exact: true }).waitFor();
  await page.getByText("Hiển thị 1–3 trong 3 sản phẩm", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Dinh dưỡng" }).click();
  await page.getByText("Đang cập nhật danh mục...", { exact: true }).waitFor();
  const pendingSearchInput = catalogSearch(page);
  assert.equal(await pendingSearchInput.isEditable(), false, "Search input must not accept edits while a committed filter transition is pending");
  await pendingSearchInput.focus();
  await page.keyboard.insertText("bột");
  assert.equal(await pendingSearchInput.inputValue(), "pending-probe", "Keyboard input during a pending transition must not create a stale draft");
  await page.waitForURL((url) => url.searchParams.get("q") === "pending-probe" && url.searchParams.get("category") === "dinh-duong");
  await page.getByText("Hiển thị 1–3 trong 3 sản phẩm", { exact: true }).waitFor();
  assert.equal(await catalogSearch(page).inputValue(), "pending-probe", "Completed category navigation must keep the committed search query");
  await page.goBack();
  await page.waitForURL((url) => url.searchParams.get("q") === "pending-probe" && !url.searchParams.has("category"));
  assert.equal(await catalogSearch(page).inputValue(), "pending-probe", "Back after a pending transition must restore the committed search query");
  await catalogSearch(page).fill("");
  await catalogSearch(page).press("Enter");
  await page.getByText("Hiển thị 1–3 trong 3 sản phẩm", { exact: true }).waitFor();
  await catalogSearch(page).fill("không tồn tại");
  await catalogSearch(page).press("Enter");
  await page.getByText("Chưa tìm thấy sản phẩm phù hợp.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Xem toàn bộ sản phẩm" }).click();
  await page.getByText("Hiển thị 1–3 trong 3 sản phẩm", { exact: true }).waitFor();
  // The card still publishes its variant count, but `catalog-listing.ts` words it as
  // `quy cách` — the unit the rest of the catalog uses — rather than `phiên bản`.
  assert.equal(
    await page.getByText(/\d+ quy cách/).count() >= 3,
    true,
    "Parent cards must expose variant count",
  );
  // The card links to detail from the image, the name and `Xem chi tiết` — three
  // affordances, one destination, which is what the card specification asks for. So
  // the contract is that a card offers exactly one detail target, not one link.
  const detailTargetsPerCard = await page.locator("[data-catalog-card]").evaluateAll((cards) => cards.map((card) => [
    ...new Set([...card.querySelectorAll("a[href*='/san-pham/']")].map((link) => new URL(link.href).pathname)),
  ].length));
  assert.deepEqual(detailTargetsPerCard, [1, 1, 1], "Each parent card needs exactly one detail destination");
  await page.screenshot({ path: join(screenshots, "catalog-1440.png"), fullPage: true });
  await page.locator("[data-catalog-card]").getByText(/Từ 720\.000/).first().waitFor();
  assert.equal(
    await page.locator("[data-catalog-card]").getByText(/Mua từ|Liên hệ từ/).count(),
    0,
    "Parent cards must not invent parent MOQ or contact rules",
  );
  await page.goto(`${origin}/san-pham/?q=empty`);
  await page.getByText("Chưa tìm thấy sản phẩm phù hợp.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Xem toàn bộ sản phẩm" }).click();
  await page.getByText("Hiển thị 1–3 trong 3 sản phẩm", { exact: true }).waitFor();
  assert.equal(new URL(page.url()).search, "", "Clearing a server-rendered empty result must restore the full catalog URL");
  // `/san-pham/[slug]` is served by `ProductPurchasePanel`, not by the `CatalogDetail`
  // this block used to describe — nothing imports that component any more. Two of its
  // expectations inverted with the replacement: the panel deliberately falls back to a
  // usable variant (`product-detail.test.mts` locks that as `defaultVariantSku`, and
  // the panel's own warning says so), and its CTAs commit to the request cart instead
  // of linking with `?intent=order` / `?intent=quote`. The behavioural contract for
  // this surface now lives in `scripts/product-detail.test.mts`, inside `npm run
  // check`; what stays here is what only a browser can show.
  await page.goto(`${detailUrl}?variant=KHONG-TON-TAI`);
  await page.getByText(/Lựa chọn trong liên kết không còn khả dụng/).waitFor();
  assert.equal(
    await page.getByRole("radio", { checked: true }).count(),
    1,
    "An unusable variant query must fall back to one usable selection, as the warning states",
  );
  await page.goto(`${detailUrl}?variant=B2B-DEMO-BOT-VANI`);
  assert.equal(await page.getByLabel(/Chọn số lượng/).getAttribute("min"), "10", "Valid variant query must preselect and expose MOQ");
  await page.goto(detailUrl);
  assert.equal(await page.getByRole("radio", { name: "Ít ngọt" }).isDisabled(), true, "Unavailable variant must remain visible and disabled");
  assert.equal(await page.getByText("Tạm hết hàng").count(), 1, "Unavailable variant needs a reason");
  assert.equal(
    await page.getByRole("link", { name: /Gửi yêu cầu đặt|Liên hệ nhận giá/ }).count(),
    0,
    "The replaced intent-link CTAs must not reappear",
  );
  await page.getByRole("radio", { name: "Vani" }).check();
  const quantity = page.getByLabel(/Chọn số lượng/);
  assert.equal(await quantity.inputValue(), "10", "Selecting a variant resets quantity to its MOQ");
  await quantity.fill("95");
  assert.equal(await page.getByText(/Số lượng từ 100 thùng được báo giá riêng/).count(), 0, "Below the threshold the panel must price the order");
  await quantity.fill("100");
  await page.getByText(/Số lượng từ 100 thùng được báo giá riêng/).waitFor();

  await page.goto(`${origin}/san-pham/b2b-demo-ngu-coc-dinh-duong/`);
  await page.getByRole("radio", { name: "Hạt" }).check();
  await page.getByLabel(/Chọn số lượng/).fill("95");
  await page.getByRole("radio", { name: "Yến mạch" }).check();
  const switchedQuantity = page.getByLabel(/Chọn số lượng/);
  assert.equal(await switchedQuantity.inputValue(), "12", "Variant switch must reset quantity to the new MOQ");
  assert.equal(await switchedQuantity.getAttribute("step"), "6");
  assert.match(await page.locator("main").innerText(), /420\.000[\s\S]*?120 thùng/i, "Variant switch must update price and contact threshold atomically");
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  mobile.on("console", (message) => { if (message.type() === "error") browserIssues.push(message.text()); });
  mobile.on("pageerror", (error) => browserIssues.push(error.message));
  await mobile.goto(`${origin}/san-pham/`);
  await mobile.getByText("Hiển thị 1–3 trong 3 sản phẩm", { exact: true }).waitFor();
  // The compact mobile layout keeps one readable card per row.
  assert.equal(await mobile.locator("[data-catalog-grid]").evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length), 1, "390px catalog must render one card column");
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, "390px catalog must not overflow horizontally");
  await mobile.screenshot({ path: join(screenshots, "catalog-390.png"), fullPage: true });

  await mobile.close();
  assert.deepEqual(browserIssues, [], "Catalog browser console must be clean");
  assert.ok(median(warmTimings) <= 800, `Warm catalog p50 must remain under 800ms (received ${median(warmTimings).toFixed(1)}ms)`);
  console.log(JSON.stringify({ coldCatalogP50Ms: median(coldTimings), initialMetrics, screenshots, warmCatalogP50Ms: median(warmTimings) }));
} finally {
  await browser?.close();
  await stopChild(app, appPort, logs);
  fakeSockets.forEach((socket) => socket.destroy());
  await new Promise((resolve, reject) => fake.close((error) => error ? reject(error) : resolve()));
  await waitForPortToClose(fakePort);
}
