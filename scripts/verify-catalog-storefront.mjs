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
    const response = await fetchWithTimeout(`${origin}/api/catalog/products/${slug}`, {}, `safe quick preview ${slug}`);
    assert.equal(response.status, status, `Quick preview must map ${slug} to a safe status`);
    assert.equal(response.headers.get("cache-control"), "no-store", "Quick preview responses must be no-store");
    assert.deepEqual(await response.json(), { error }, "Quick preview must not expose upstream errors or payloads");
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
  const listRequestsSince = (start, predicate) => seenCatalogRequests
    .slice(start)
    .filter((item) => item.pathname === "/api/b2b/catalog/products")
    .filter((item) => predicate(new URLSearchParams(item.query)));

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
    "A different direction must miss the cache instead of reusing the descending entry",
  );
  const repeatSortStart = seenCatalogRequests.length;
  await fetchWithTimeout(`${origin}/san-pham/?sort=starting_price&direction=desc`, {}, "repeat sorted catalog");
  assert.equal(
    listRequestsSince(repeatSortStart, () => true).length,
    0,
    "An identical sorted request must reuse the validated cache entry",
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
    0,
    "Unsupported parameters must collapse onto the canonical cache entry instead of adding cache keys",
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
  const initialMetrics = await page.evaluate(() => {
    const scripts = performance.getEntriesByType("resource")
      .filter((entry) => entry instanceof PerformanceResourceTiming && entry.initiatorType === "script");
    const dialogs = [...document.querySelectorAll("[data-catalog-card] dialog")];
    const quickPreviewDomNodes = dialogs
      .reduce((total, dialog) => total + dialog.querySelectorAll("*").length + 1, dialogs.length);
    return {
      domNodes: document.querySelectorAll("*").length,
      quickPreviewDomNodes,
      scriptEncodedBodyBytes: scripts.reduce((total, entry) => total + entry.encodedBodySize, 0),
      scriptRequests: scripts.length,
      scriptTransferBytes: scripts.reduce((total, entry) => total + entry.transferSize, 0),
    };
  });
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
  await page.waitForURL((url) => url.searchParams.get("q") === "ngũ cốc" && !url.searchParams.has("category"));
  await page.getByText("1 dòng sản phẩm", { exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("q"), "ngũ cốc", "Enter search must update the catalog URL");
  assert.ok(seenQueries.includes("ngũ cốc"), "Client search must request the server-filtered catalog result");
  await page.getByRole("button", { name: "Dinh dưỡng" }).click();
  await page.waitForURL((url) => url.searchParams.get("q") === "ngũ cốc" && url.searchParams.get("category") === "dinh-duong");
  await page.getByLabel("Tìm sản phẩm").fill("bột");
  await page.goBack();
  await page.waitForURL((url) => url.searchParams.get("q") === "ngũ cốc" && !url.searchParams.has("category"));
  assert.equal(await page.getByLabel("Tìm sản phẩm").inputValue(), "ngũ cốc", "Back between committed filters with the same query must discard the unsubmitted draft");
  await page.goForward();
  await page.waitForURL((url) => url.searchParams.get("q") === "ngũ cốc" && url.searchParams.get("category") === "dinh-duong");
  assert.equal(await page.getByLabel("Tìm sản phẩm").inputValue(), "ngũ cốc", "Forward must restore the committed query when category changes but query does not");
  await page.goBack();
  await page.waitForURL((url) => url.searchParams.get("q") === "ngũ cốc" && !url.searchParams.has("category"));
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
  await page.getByRole("button", { name: "Dinh dưỡng" }).click();
  await page.getByText("Đang cập nhật danh mục...", { exact: true }).waitFor();
  const pendingSearchInput = page.getByLabel("Tìm sản phẩm");
  assert.equal(await pendingSearchInput.isEditable(), false, "Search input must not accept edits while a committed filter transition is pending");
  await pendingSearchInput.focus();
  await page.keyboard.insertText("bột");
  assert.equal(await pendingSearchInput.inputValue(), "pending-probe", "Keyboard input during a pending transition must not create a stale draft");
  await page.waitForURL((url) => url.searchParams.get("q") === "pending-probe" && url.searchParams.get("category") === "dinh-duong");
  await page.getByText("3 dòng sản phẩm", { exact: true }).waitFor();
  assert.equal(await page.getByLabel("Tìm sản phẩm").inputValue(), "pending-probe", "Completed category navigation must keep the committed search query");
  await page.goBack();
  await page.waitForURL((url) => url.searchParams.get("q") === "pending-probe" && !url.searchParams.has("category"));
  assert.equal(await page.getByLabel("Tìm sản phẩm").inputValue(), "pending-probe", "Back after a pending transition must restore the committed search query");
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
  assert.equal(await page.getByRole("button", { name: "Xem nhanh" }).count(), 3, "Each parent card needs an explicit 44px quick-preview action");
  const previewIds = await page.locator("dialog[id], dialog [id]").evaluateAll((elements) => elements.map((element) => element.id));
  assert.equal(new Set(previewIds).size, previewIds.length, "Quick-preview dialog IDs must remain unique across all product cards");
  const retryBrowserIssueStart = browserIssues.length;
  let retryRequestCount = 0;
  await page.route("**/api/catalog/products/b2b-demo-bot-dinh-duong", async (route) => {
    retryRequestCount += 1;
    if (retryRequestCount === 1) {
      await route.fulfill({
        body: JSON.stringify({ error: "catalog_unavailable" }),
        contentType: "application/json",
        headers: { "Cache-Control": "no-store" },
        status: 502,
      });
      return;
    }
    await route.fulfill({ response: await route.fetch() });
  });
  await page.getByRole("button", { name: "Xem nhanh" }).first().click();
  const retryDialog = page.getByRole("dialog");
  await retryDialog.getByRole("alert").getByText("Không thể tải thông tin sản phẩm lúc này.").waitFor();
  await retryDialog.getByRole("button", { name: "Thử lại" }).click();
  await retryDialog.getByRole("radio", { name: "Vani" }).waitFor();
  assert.equal(retryRequestCount, 2, "Quick-preview retry must issue exactly one fresh same-origin request");
  assert.deepEqual(
    browserIssues.splice(retryBrowserIssueStart),
    ["Failed to load resource: the server responded with a status of 502 (Bad Gateway)"],
    "The intentional safe 502 must be the only browser issue during error and retry",
  );
  await retryDialog.getByRole("button", { name: "Đóng xem nhanh" }).focus();
  await page.keyboard.press("Shift+Tab");
  assert.equal(await retryDialog.getByRole("radio", { name: "Vani" }).evaluate((element) => element === document.activeElement), true, "Retry success must preserve backward focus wrapping");
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("button", { name: "Xem nhanh" }).first().evaluate((element) => element === document.activeElement), true, "Closing a retried preview must restore trigger focus");
  await page.unroute("**/api/catalog/products/b2b-demo-bot-dinh-duong");
  const quickStart = seenCatalogRequests.length;
  await page.getByRole("button", { name: "Xem nhanh" }).first().click();
  const quickDialog = page.getByRole("dialog");
  await quickDialog.getByRole("heading", { level: 2, name: "Bột dinh dưỡng" }).waitFor();
  await quickDialog.getByRole("radio", { name: "Vani" }).waitFor();
  assert.equal(
    seenCatalogRequests.slice(quickStart).filter((item) => item.pathname === "/api/b2b/catalog/products/b2b-demo-bot-dinh-duong").length,
    1,
    "A quick-preview click must make exactly one same-origin BFF-backed detail request",
  );
  assert.equal(await quickDialog.getByText(/SKU:|Số lượng đặt tối thiểu|Giá theo số lượng|Gửi yêu cầu đặt|Liên hệ nhận giá/).count(), 0, "Quick preview must hide commerce before an explicit selection");
  assert.equal(await quickDialog.getByRole("radio", { name: "Ít ngọt" }).isDisabled(), true, "Quick preview must expose unavailable options with a disabled control");
  await page.screenshot({ path: join(screenshots, "quick-preview-1440.png"), fullPage: true });
  await quickDialog.getByRole("radio", { name: "Vani" }).check();
  assert.equal(await quickDialog.getByLabel("Số lượng (thùng)").inputValue(), "10", "Quick preview selection must reset quantity to MOQ");
  assert.equal(await quickDialog.getByLabel("Số lượng (thùng)").getAttribute("step"), "5", "Quick preview must preserve the selected variant quantity step");
  assert.match(await quickDialog.innerText(), /25 thùng[\s\S]*690\.000/, "Quick preview must preserve the selected variant tier prices");
  await quickDialog.getByLabel("Số lượng (thùng)").fill("95");
  const quickOrderHref = await quickDialog.getByRole("link", { name: /Gửi yêu cầu đặt 95/ }).getAttribute("href");
  assert.equal(new URL(quickOrderHref, origin).searchParams.get("intent"), "order", "Quick preview must keep the order path below the inclusive contact threshold");
  await quickDialog.getByLabel("Số lượng (thùng)").fill("100");
  const quickContact = quickDialog.getByRole("link", { name: /Liên hệ nhận giá/ });
  assert.equal(new URL(await quickContact.getAttribute("href"), origin).searchParams.get("intent"), "quote", "Quick preview must switch to contact at the inclusive threshold");
  assert.equal(new URL(await quickContact.getAttribute("href"), origin).searchParams.get("variant_sku"), "B2B-DEMO-BOT-VANI", "Quick preview CTA must retain exact variant SKU");
  await quickContact.focus();
  await page.keyboard.press("Tab");
  assert.equal(await quickDialog.getByRole("button", { name: "Đóng xem nhanh" }).evaluate((element) => element === document.activeElement), true, "Dialog Tab from the last control must wrap to the first control");
  await page.keyboard.press("Shift+Tab");
  assert.equal(await quickContact.evaluate((element) => element === document.activeElement), true, "Dialog Shift+Tab from the first control must wrap to the last control");
  await page.keyboard.press("Escape");
  assert.equal(await quickDialog.count(), 0, "Escape must close the quick-preview dialog");
  assert.equal(await page.getByRole("button", { name: "Xem nhanh" }).first().evaluate((element) => element === document.activeElement), true, "Closing quick preview must restore trigger focus");
  let raceRequestCount = 0;
  await page.route("**/api/catalog/products/b2b-demo-bot-dinh-duong", async (route) => {
    raceRequestCount += 1;
    const response = await route.fetch();
    if (raceRequestCount === 1) await delay(150);
    await route.fulfill({ response });
  });
  const abortedPreviewRequest = page.waitForRequest((request) => request.url().endsWith("/api/catalog/products/b2b-demo-bot-dinh-duong"));
  await page.getByRole("button", { name: "Xem nhanh" }).first().click();
  await abortedPreviewRequest;
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0, "Closing a loading preview must synchronously hide it");
  await page.getByRole("button", { name: "Xem nhanh" }).first().click();
  await page.getByRole("dialog").getByRole("radio", { name: "Vani" }).waitFor();
  await delay(200);
  assert.equal(raceRequestCount, 2, "Closing and reopening must abort the stale client flow and issue one fresh request");
  assert.equal(await page.getByRole("dialog").getByRole("radio", { name: "Vani" }).count(), 1, "A delayed stale response must not replace the reopened preview");
  await page.keyboard.press("Escape");
  await page.unroute("**/api/catalog/products/b2b-demo-bot-dinh-duong");
  for (const [cardIndex, labels] of [[1, ["Lúa mạch", "Sữa hạt"]], [2, ["Hạt", "Yến mạch"]]]) {
    await page.getByRole("button", { name: "Xem nhanh" }).nth(cardIndex).click();
    await page.getByRole("dialog").getByRole("radio", { name: labels[0] }).waitFor();
    for (const label of labels) assert.equal(await page.getByRole("dialog").getByRole("radio", { name: label }).count(), 1, `Quick preview must preserve exact option label ${label}`);
    await page.getByRole("dialog").getByRole("button", { name: "Đóng xem nhanh" }).focus();
    await page.keyboard.press("Shift+Tab");
    assert.equal(await page.getByRole("dialog").getByRole("radio", { name: labels[0] }).evaluate((element) => element === document.activeElement), true, "Dialog Shift+Tab from the first control must wrap to the last initial-state control");
    await page.keyboard.press("Tab");
    assert.equal(await page.getByRole("dialog").getByRole("button", { name: "Đóng xem nhanh" }).evaluate((element) => element === document.activeElement), true, "Dialog Tab from the last initial-state control must wrap to the first control");
    for (let index = 0; index < 8; index += 1) await page.keyboard.press("Tab");
    assert.equal(await page.getByRole("dialog").evaluate((dialog) => dialog.contains(document.activeElement)), true, "Dialog focus must remain contained while tabbing");
    if (cardIndex === 1) {
      await page.getByRole("dialog").getByRole("radio", { name: labels[0] }).check();
      await page.getByRole("dialog").getByLabel("Số lượng (thùng)").fill("18");
      await page.getByRole("dialog").getByRole("radio", { name: labels[1] }).check();
      assert.equal(await page.getByRole("dialog").getByLabel("Số lượng (thùng)").inputValue(), "12", "Switching preview variants must reset quantity to the new MOQ");
    }
    await page.keyboard.press("Escape");
  }
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
  await mobile.getByRole("button", { name: "Xem nhanh" }).first().click();
  await mobile.getByRole("dialog").getByRole("heading", { level: 2, name: "Bột dinh dưỡng" }).waitFor();
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true, "390px quick preview must not overflow horizontally");
  await mobile.screenshot({ path: join(screenshots, "quick-preview-390.png"), fullPage: true });
  await mobile.keyboard.press("Escape");
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
