import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const EMPTY_CATALOG_COPY = "Hiện chưa có sản phẩm được công bố.";

function visibleText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function assertStatus(response, expected, label) {
  assert.equal(response.status, expected, `${label}: expected HTTP ${expected}, got ${response.status}`);
}

export async function runStagingCatalogQa({ origin, activeProduct, inactiveProduct, fetchImpl = fetch, headers = {} }) {
  const request = (path, init = {}) => {
    const { signal, ...requestInit } = init;
    return fetchImpl(new URL(path, origin), {
      ...requestInit,
      signal: signal ?? AbortSignal.timeout(25_000),
      headers: { "User-Agent": "Giacong-Staging-Deep-QA/1.0", ...headers, ...init.headers },
    });
  };

  const catalogResponse = await request("/san-pham");
  assertStatus(catalogResponse, 200, "catalog listing");
  const catalogHtml = await catalogResponse.text();
  const catalogText = visibleText(catalogHtml);
  let productDetails = null;

  if (!activeProduct) {
    const hasEmptyHeading = catalogText.includes("Danh mục sản phẩm đang được cập nhật")
      || catalogText.includes("Chưa tìm thấy sản phẩm phù hợp.");
    assert.ok(hasEmptyHeading, "empty catalog heading is missing");
    assert.ok(
      catalogText.includes("0–0 trong 0 sản phẩm") || catalogText.includes(EMPTY_CATALOG_COPY),
      "empty catalog state is missing its zero-result explanation",
    );
    assert.doesNotMatch(catalogHtml, /data-catalog-grid/, "empty catalog must not render product cards or skeletons");

    if (inactiveProduct?.slug) {
      assert.ok(!catalogText.includes(inactiveProduct.name), "inactive product leaked into the public catalog");
      const inactiveApi = await request(`/api/catalog/products/${encodeURIComponent(inactiveProduct.slug)}`);
      assertStatus(inactiveApi, 404, "inactive product API");
    }
    console.log("Staging catalog is empty: public empty state is rendered and inactive products stay hidden.");
  } else {
    assert.ok(activeProduct.slug && activeProduct.name, "active product fixture needs slug and name from staging D1");
    assert.ok(catalogText.includes(activeProduct.name), "active product is missing from the public catalog");

    const searchUrl = new URL("/san-pham", origin);
    searchUrl.searchParams.set("q", activeProduct.name);
    const searchResponse = await request(`${searchUrl.pathname}${searchUrl.search}`);
    assertStatus(searchResponse, 200, "catalog search");
    assert.ok(visibleText(await searchResponse.text()).includes(activeProduct.name), "search did not return the active product");

    if (activeProduct.category_slug) {
      const categoryUrl = new URL("/san-pham", origin);
      categoryUrl.searchParams.set("category", activeProduct.category_slug);
      const categoryResponse = await request(`${categoryUrl.pathname}${categoryUrl.search}`);
      assertStatus(categoryResponse, 200, "category filter");
      assert.ok(visibleText(await categoryResponse.text()).includes(activeProduct.name), "category filter did not return its active product");
    }

    const sortUrl = new URL("/san-pham", origin);
    sortUrl.searchParams.set("sort", "starting_price");
    sortUrl.searchParams.set("direction", "desc");
    sortUrl.searchParams.set("per_page", "48");
    assertStatus(await request(`${sortUrl.pathname}${sortUrl.search}`), 200, "catalog price sort");

    const productResponse = await request(`/api/catalog/products/${encodeURIComponent(activeProduct.slug)}`);
    assertStatus(productResponse, 200, "active product API");
    const productPayload = await productResponse.json();
    assert.equal(productPayload.product?.slug, activeProduct.slug, "active product API returned the wrong record");
    assert.ok(Array.isArray(productPayload.product?.variants), "product API must return a variants array");
    productDetails = productPayload.product;

    if (inactiveProduct?.slug) {
      assert.ok(!catalogText.includes(inactiveProduct.name), "inactive product leaked into the public catalog");
      assertStatus(await request(`/api/catalog/products/${encodeURIComponent(inactiveProduct.slug)}`), 404, "inactive product API");
    }
    console.log(`Staging catalog active-product checks passed for ${activeProduct.slug}.`);
  }

  if (!inactiveProduct?.slug) {
    const missingProduct = await request("/api/catalog/products/khong-ton-tai");
    assertStatus(missingProduct, 404, "unknown product API");
  }

  const cartLines = [{ parentSlug: "khong-ton-tai", variantSku: "MISSING", quantity: 1 }];
  const cartResponse = await request("/api/gui-yeu-cau/xac-thuc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lines: cartLines }),
  });
  assertStatus(cartResponse, 200, "unknown product cart validation");
  const cartPayload = await cartResponse.json();
  assert.equal(cartPayload.ok, true);
  assert.equal(cartPayload.cart?.lines?.[0]?.adjustments?.[0]?.code, "PRODUCT_NOT_FOUND");

  const malformedContactResponse = await request("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{bad json",
  });
  assertStatus(malformedContactResponse, 400, "malformed contact JSON");
  console.log("Unknown-product cart validation and malformed contact rejection passed.");

  if (activeProduct) {
    const availableVariant = productDetails?.variants.find((variant) => variant.isAvailable && variant.tierPrices?.length > 0);
    if (availableVariant) {
      const cartResponse = await request("/api/gui-yeu-cau/xac-thuc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: [{ parentSlug: activeProduct.slug, variantSku: availableVariant.sku, quantity: availableVariant.minimumOrderQuantity }],
        }),
      });
      assertStatus(cartResponse, 200, "active MOQ cart validation");
      const cartPayload = await cartResponse.json();
      assert.equal(cartPayload.ok, true);
      assert.equal(cartPayload.cart?.isSubmittable, true, "MOQ quantity must be submit-ready");

      const driftResponse = await request("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: "",
          companyName: "",
          deliveryLocation: "Hà Nội",
          email: "qa@example.com",
          lines: [{ parentSlug: activeProduct.slug, variantSku: availableVariant.sku, quantity: availableVariant.minimumOrderQuantity }],
          message: "staging QA only",
          name: "Staging QA",
          neededBy: "",
          phone: "0868408115",
          requestId: randomUUID(),
          snapshotToken: "0".repeat(64),
          source: "/gui-yeu-cau/",
          vatInvoice: "",
        }),
      });
      assertStatus(driftResponse, 409, "stale contact cart snapshot");
      const driftPayload = await driftResponse.json();
      assert.equal(driftPayload.code, "CART_DRIFTED", "stale snapshot must be rejected before request submission");
      console.log("Staging cart MOQ and stale-snapshot guards passed with the active product.");
    } else {
      console.log("Skipped positive MOQ and stale-snapshot checks: no available priced variant is published.");
    }
  }
}

export function readD1FirstRow(json) {
  const value = JSON.parse(json);
  const row = value?.[0]?.results?.[0];
  return row && typeof row === "object" ? row : null;
}

async function readRecord(path, slug) {
  if (!slug) return null;
  try {
    return readD1FirstRow(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const activeProduct = await readRecord("/tmp/staging-active-product.json", process.env.STAGING_ACTIVE_PRODUCT_SLUG);
  const inactiveProduct = await readRecord("/tmp/staging-inactive-product.json", process.env.STAGING_INACTIVE_PRODUCT_SLUG);
  const activeCount = Number(process.env.STAGING_ACTIVE_PRODUCT_COUNT);
  assert.ok(Number.isInteger(activeCount) && activeCount >= 0, "active product count was not discovered from staging D1");
  assert.equal(activeCount > 0, Boolean(activeProduct), "staging D1 active count and selected product do not match");
  const headers = process.env.STAGING_ACCESS_REQUIRED === "true"
    && process.env.CLOUDFLARE_ACCESS_CLIENT_ID
    && process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET
    ? {
        "CF-Access-Client-Id": process.env.CLOUDFLARE_ACCESS_CLIENT_ID,
        "CF-Access-Client-Secret": process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET,
      }
    : {};

  await runStagingCatalogQa({ origin: process.env.STAGING_ORIGIN, activeProduct, inactiveProduct, headers });
}
