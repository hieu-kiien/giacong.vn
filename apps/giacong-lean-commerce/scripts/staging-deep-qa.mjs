import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const origin = requiredEnv("STAGING_ORIGIN").replace(/\/$/, "");
const database = process.env.STAGING_DATABASE?.trim() || "giacong-vn-catalog-staging";
const accessClientId = requiredEnv("CLOUDFLARE_ACCESS_CLIENT_ID");
const accessClientSecret = requiredEnv("CLOUDFLARE_ACCESS_CLIENT_SECRET");
const accessHeaders = {
  "CF-Access-Client-Id": accessClientId,
  "CF-Access-Client-Secret": accessClientSecret,
};

console.log(`Deep QA target: ${origin}`);
verifyActiveDeployment();
await verifyCatalog();
await verifyProductApi();
await verifyCartMatrix();
await verifyContactDriftGuard();
await verifyMedia();
await verifyResponsiveBrowser();
console.log("Cloudflare staging deep QA passed.");

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for staging deep QA.`);
  return value;
}

function verifyActiveDeployment() {
  const output = execFileSync(
    "npx",
    ["--yes", "wrangler@4.115.0", "deployments", "status", "--env=staging", "--json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  const deployment = JSON.parse(output);
  assert.equal(deployment.versions?.length, 1, "staging must have one active version");
  assert.equal(deployment.versions[0]?.percentage, 100, "staging active version must receive 100% traffic");
  assert.ok(deployment.versions[0]?.version_id, "staging active version must expose a version id");
  console.log(`Active staging version: ${deployment.versions[0].version_id}`);
}

async function verifyCatalog() {
  const search = await fetchText("/san-pham", { query: { q: "gạo lứt" } });
  assert.match(search, /Bột gạo lứt xay mịn/);
  assert.doesNotMatch(search, /Hoa cúc sấy nguyên bông/, "search returned unrelated product");

  const categoryOutput = execFileSync(
    "npx",
    [
      "--yes",
      "wrangler@4.115.0",
      "d1",
      "execute",
      database,
      "--remote",
      "--json",
      "--command=SELECT c.slug FROM categories c INNER JOIN products p ON p.category_id = c.id WHERE p.slug = 'bot-gao-lut-xay-min' LIMIT 1;",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
  const categoryPayload = JSON.parse(categoryOutput);
  const categorySlug = categoryPayload?.[0]?.results?.[0]?.slug;
  assert.ok(categorySlug, "staging category slug must resolve from D1");

  const category = await fetchText("/san-pham", { query: { category: categorySlug } });
  assert.match(category, /Bột gạo lứt xay mịn/);
  assert.doesNotMatch(category, /Hoa cúc sấy nguyên bông/, "category filter leaked another category");

  const sorted = await fetchText("/san-pham", {
    query: { sort: "starting_price", direction: "desc", per_page: "48" },
  });
  const names = [
    "Túi zipper tráng nhôm",
    "Lá tía tô sấy lạnh",
    "Hoa cúc sấy nguyên bông",
    "Bột gạo lứt xay mịn",
    "test 1",
  ];
  const positions = names.map((name) => sorted.indexOf(name));
  assert.ok(positions.every((position) => position >= 0), `sorted catalog missing product: ${JSON.stringify(Object.fromEntries(names.map((name, index) => [name, positions[index]])))}`);
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b), "unexpected descending starting-price order");
  console.log(`Catalog checks passed for category ${categorySlug}.`);
}

async function verifyProductApi() {
  const fish = await fetchJson("/api/catalog/products/nuoc-mam-cot-pha-loang");
  assert.equal(fish.product?.slug, "nuoc-mam-cot-pha-loang");
  assert.equal(fish.product?.variantCount, 2);
  assert.equal(fish.product?.availableVariantCount, 1);
  assert.ok(fish.product?.variants?.some((variant) => variant.sku === "B2B-DEMO-NMC-10" && variant.contactFromQuantity === 141));
  assert.ok(fish.product?.variants?.some((variant) => variant.sku === "B2B-DEMO-NMC-30" && variant.isAvailable === false));

  const tamarind = await fetchJson("/api/catalog/products/sot-me-chua-ngot");
  assert.equal(tamarind.product?.slug, "sot-me-chua-ngot");
  assert.ok(tamarind.product?.variants?.some((variant) => variant.sku === "B2B-DEMO-SME-02" && variant.contactFromQuantity === 264));

  const missing = await fetchResponse("/api/catalog/products/khong-ton-tai");
  assert.equal(missing.status, 404);
  console.log("Product API checks passed.");
}

async function verifyCartMatrix() {
  const cases = [
    {
      name: "valid tier",
      payload: { lines: [{ parentSlug: "bot-gao-lut-xay-min", variantSku: "B2B-DEMO-BGL-05", quantity: 100 }] },
      verify: (body) => body.ok === true && body.cart?.isSubmittable === true && body.cart?.lines?.[0]?.unitPrice === 74500 && body.cart?.lines?.[0]?.lineTotal === 7450000,
    },
    {
      name: "below MOQ",
      payload: { lines: [{ parentSlug: "bot-gao-lut-xay-min", variantSku: "B2B-DEMO-BGL-05", quantity: 24 }] },
      verify: (body) => body.cart?.isSubmittable === false && body.cart?.lines?.[0]?.adjustments?.[0]?.code === "QUANTITY_BELOW_MOQ" && body.cart?.lines?.[0]?.adjustments?.[0]?.suggestedQuantity === 25,
    },
    {
      name: "off step",
      payload: { lines: [{ parentSlug: "bot-gao-lut-xay-min", variantSku: "B2B-DEMO-BGL-05", quantity: 26 }] },
      verify: (body) => body.cart?.isSubmittable === false && body.cart?.lines?.[0]?.adjustments?.[0]?.code === "QUANTITY_OFF_STEP" && body.cart?.lines?.[0]?.adjustments?.[0]?.suggestedQuantity === 30,
    },
    {
      name: "unavailable variant",
      payload: { lines: [{ parentSlug: "nuoc-mam-cot-pha-loang", variantSku: "B2B-DEMO-NMC-30", quantity: 2 }] },
      verify: (body) => body.cart?.isSubmittable === false && body.cart?.lines?.[0]?.adjustments?.[0]?.code === "VARIANT_UNAVAILABLE",
    },
    {
      name: "missing product",
      payload: { lines: [{ parentSlug: "khong-ton-tai", variantSku: "MISSING", quantity: 1 }] },
      verify: (body) => body.cart?.isSubmittable === false && body.cart?.lines?.[0]?.adjustments?.[0]?.code === "PRODUCT_NOT_FOUND",
    },
    {
      name: "missing variant",
      payload: { lines: [{ parentSlug: "bot-gao-lut-xay-min", variantSku: "MISSING", quantity: 25 }] },
      verify: (body) => body.cart?.isSubmittable === false && body.cart?.lines?.[0]?.adjustments?.[0]?.code === "VARIANT_NOT_FOUND",
    },
    {
      name: "price on request",
      payload: { lines: [{ parentSlug: "bot-gao-lut-xay-min", variantSku: "B2B-DEMO-BGL-05", quantity: 500 }] },
      verify: (body) => body.cart?.isSubmittable === true
        && body.cart?.hasPriceOnRequest === true
        && body.cart?.requestType === "Tư vấn số lượng lớn"
        && body.cart?.pricedSubtotal === 0
        && body.cart?.lines?.[0]?.priceOnRequest === true
        && body.cart?.lines?.[0]?.unitPrice === null
        && body.cart?.lines?.[0]?.adjustments?.[0]?.code === "PRICE_ON_REQUEST",
    },
  ];

  for (const item of cases) {
    const body = await fetchJson("/api/gui-yeu-cau/xac-thuc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item.payload),
    });
    assert.ok(item.verify(body), `cart matrix failed: ${item.name}`);
  }
  console.log("Canonical cart matrix passed.");
}

async function verifyContactDriftGuard() {
  const drift = await fetchResponse("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "qa@example.com",
      lines: [{ parentSlug: "bot-gao-lut-xay-min", variantSku: "B2B-DEMO-BGL-05", quantity: 25 }],
      message: "staging QA only",
      name: "Staging QA",
      phone: "0868408115",
      requestId: "00000000-0000-4000-8000-000000000001",
      snapshotToken: "0".repeat(64),
      source: "staging-deep-qa",
    }),
  });
  assert.equal(drift.status, 409);
  const driftBody = await drift.json();
  assert.equal(driftBody.ok, false);
  assert.equal(driftBody.code, "CART_DRIFTED");
  assert.equal(driftBody.cart?.isSubmittable, true);
  assert.equal(driftBody.cart?.lines?.[0]?.unitPrice, 78000);

  const malformed = await fetchResponse("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{bad json",
  });
  assert.equal(malformed.status, 400);
  console.log("Contact drift guard passed without submitting a lead.");
}

async function verifyMedia() {
  const response = await fetchResponse("/media/products/c5be4fe1-3daa-40ad-b9df-54717ec5c863.jpg");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^image\/(jpeg|jpg)/i);
  const bytes = await response.arrayBuffer();
  assert.ok(bytes.byteLength > 100000, `staging media unexpectedly small: ${bytes.byteLength}`);
  console.log(`R2 media check passed (${bytes.byteLength} bytes).`);
}

async function verifyResponsiveBrowser() {
  const routes = [
    "/",
    "/san-pham",
    "/san-pham/bot-gao-lut-xay-min",
    "/gui-yeu-cau",
    "/thue-gia-cong/say-thuc-pham-say",
  ];
  const viewports = [
    { name: "mobile", width: 390, height: 844 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1440, height: 900 },
  ];

  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({
        extraHTTPHeaders: accessHeaders,
        viewport,
      });
      try {
        for (const route of routes) {
          const page = await context.newPage();
          const errors = [];
          page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
          page.on("console", (message) => {
            if (message.type() === "error") errors.push(`console: ${message.text()}`);
          });
          const response = await page.goto(`${origin}${route}`, { waitUntil: "networkidle", timeout: 30000 });
          assert.ok(response && response.status() < 400, `${viewport.name} ${route}: HTTP ${response?.status() ?? "no response"}`);
          const dimensions = await page.evaluate(() => ({
            clientWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
          }));
          assert.ok(dimensions.scrollWidth <= dimensions.clientWidth + 1, `${viewport.name} ${route}: horizontal overflow ${dimensions.scrollWidth} > ${dimensions.clientWidth}`);
          assert.deepEqual(errors, [], `${viewport.name} ${route}: browser errors`);
          console.log(`${viewport.name} ${route}: HTTP ${response.status()}, width ${dimensions.clientWidth}/${dimensions.scrollWidth}`);
          await page.close();
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}

async function fetchText(pathname, options = {}) {
  const response = await fetchResponse(pathname, options);
  assert.ok(response.ok, `${pathname}: HTTP ${response.status}`);
  return response.text();
}

async function fetchJson(pathname, options = {}) {
  const response = await fetchResponse(pathname, options);
  assert.ok(response.ok, `${pathname}: HTTP ${response.status}`);
  return response.json();
}

async function fetchResponse(pathname, options = {}) {
  const url = new URL(pathname, `${origin}/`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    url.searchParams.set(key, value);
  }
  const headers = new Headers(options.headers ?? {});
  for (const [key, value] of Object.entries(accessHeaders)) headers.set(key, value);
  return fetch(url, {
    ...options,
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(25000),
  });
}
