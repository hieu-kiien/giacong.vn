import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readD1FirstRow, runStagingCatalogQa } from "./qa-staging-catalog.mjs";

test("deep staging QA waits for semantic render readiness", async () => {
  const source = await readFile(new URL("./qa-deep-staging.mjs", import.meta.url), "utf8");

  assert.match(source, /async function waitForPageSettled\(page/);
  assert.match(source, /waitForRenderedSelector\(page, selector/);
  assert.match(source, /document\.fonts\?\.ready/);
  assert.match(source, /await waitForPageSettled\(page\)/);
  assert.doesNotMatch(source, /await page\.waitForTimeout\(500\)/);
});

test("deep staging QA supports the configured Cloudflare Access service token without printing it", async () => {
  const workflow = await readFile(new URL("../../../.github/workflows/cloudflare-staging-deep-qa.yml", import.meta.url), "utf8");

  assert.match(workflow, /CLOUDFLARE_ACCESS_CLIENT_ID:\s*\$\{\{\s*secrets\.CLOUDFLARE_ACCESS_CLIENT_ID\s*\}\}/);
  assert.match(workflow, /CLOUDFLARE_ACCESS_CLIENT_SECRET:\s*\$\{\{\s*secrets\.CLOUDFLARE_ACCESS_CLIENT_SECRET\s*\}\}/);
  assert.match(workflow, /staging_curl\(\)/);
  assert.match(workflow, /CF-Access-Client-Id:/);
  assert.match(workflow, /CF-Access-Client-Secret:/);
  assert.match(workflow, /--user-agent\s+['"]Giacong-Staging-Deep-QA\/1\.0['"]/);
  assert.match(workflow, /context\.route\(/);
  assert.doesNotMatch(workflow, /extraHTTPHeaders:\s*accessHeaders/);
  assert.doesNotMatch(workflow, /echo\s+.*CLOUDFLARE_ACCESS_CLIENT_SECRET/);
});

test("deep staging QA can target an isolated uploaded preview without changing traffic", async () => {
  const workflow = await readFile(new URL("../../../.github/workflows/cloudflare-staging-deep-qa.yml", import.meta.url), "utf8");

  assert.match(workflow, /preview_version_id:/);
  assert.match(workflow, /PREVIEW_VERSION_ID:\s*\$\{\{\s*inputs\.preview_version_id\s*\}\}/);
  assert.match(workflow, /wrangler versions view "\$selected_version_id"/);
  assert.match(workflow, /preview_origin="https:\/\/\$\{preview_prefix\}-\$\{STAGING_WORKER_NAME\}/);
  assert.match(workflow, /echo "STAGING_ORIGIN=\$preview_origin"/);
  assert.doesNotMatch(workflow, /wrangler versions deploy/);
});

test("deep staging QA derives catalog scenarios from read-only staging data", async () => {
  const workflow = await readFile(new URL("../../../.github/workflows/cloudflare-staging-deep-qa.yml", import.meta.url), "utf8");
  const qaScript = await readFile(new URL("./qa-staging-catalog.mjs", import.meta.url), "utf8");
  const preparation = workflow.match(/- name: Prepare read-only catalog QA state([\s\S]*?)(?=\n      - name:)/)?.[1];

  assert.ok(preparation, "workflow must discover catalog state before catalog-dependent QA");
  assert.match(preparation, /SELECT[\s\S]*?is_active\s*=\s*1/i);
  assert.match(preparation, /STAGING_ACTIVE_PRODUCT_COUNT/);
  assert.doesNotMatch(preparation, /\b(?:INSERT|UPDATE|DELETE|REPLACE)\b/i);
  assert.match(qaScript, /Hiện chưa có sản phẩm được công bố/);
  assert.match(workflow, /STAGING_ACTIVE_PRODUCT_SLUG/);
  assert.match(workflow, /scripts\/qa-staging-catalog\.mjs/);
  assert.doesNotMatch(workflow, /B2B-DEMO-|bot-gao-lut-xay-min/);
});

test("deep staging QA covers common 16:9 desktop viewports", async () => {
  const workflow = await readFile(new URL("../../../.github/workflows/cloudflare-staging-deep-qa.yml", import.meta.url), "utf8");
  const viewportBlock = workflow.match(/const viewports = \[([\s\S]*?)\];/)?.[1];

  assert.ok(viewportBlock, "workflow must declare responsive browser viewports");
  assert.match(viewportBlock, /name: ['"]laptop-16x9['"], width: 1366, height: 768/);
  assert.match(viewportBlock, /name: ['"]full-hd-16x9['"], width: 1920, height: 1080/);
  const desktopSizes = [...viewportBlock.matchAll(/width: (\d+), height: (\d+)/g)]
    .map(([, width, height]) => [Number(width), Number(height)]);
  assert.ok(desktopSizes.some(([width, height]) => width / height === 16 / 9));
});

function mockResponse(status, body, json = false) {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => body,
    json: async () => json ? body : JSON.parse(body),
  };
}

test("staging catalog QA unwraps Cloudflare D1 JSON rows", () => {
  assert.deepEqual(readD1FirstRow('[{"results":[{"slug":"real-product","name":"Real product"}]}]'), {
    slug: "real-product",
    name: "Real product",
  });
  assert.equal(readD1FirstRow('[{"results":[]}]'), null);
});

test("staging catalog QA validates the real empty state without exposing inactive products", async () => {
  const calls = [];
  const fakeFetch = async (url, init = {}) => {
    const path = `${url.pathname}${url.search}`;
    calls.push({ path, init });
    if (url.pathname === "/san-pham") {
      return mockResponse(200, '<section role="status"><p>Hiển thị 0–0 trong 0 sản phẩm</p><h2>Chưa tìm thấy sản phẩm phù hợp.</h2><p>Thử một từ khóa khác hoặc xem lại toàn bộ danh mục.</p></section>');
    }
    if (url.pathname === "/api/catalog/products/retired-product" || url.pathname === "/api/catalog/products/khong-ton-tai") {
      return mockResponse(404, { error: "product_not_found" }, true);
    }
    if (url.pathname === "/api/gui-yeu-cau/xac-thuc") {
      const payload = JSON.parse(init.body);
      assert.equal(payload.lines[0].parentSlug, "khong-ton-tai");
      assert.equal(payload.lines[0].variantSku, "MISSING");
      return mockResponse(200, { ok: true, cart: { lines: [{ adjustments: [{ code: "PRODUCT_NOT_FOUND" }] }] } }, true);
    }
    if (url.pathname === "/api/contact") return mockResponse(400, { error: "invalid_json" }, true);
    throw new Error(`Unexpected request: ${path}`);
  };

  await runStagingCatalogQa({
    origin: "https://staging.example",
    activeProduct: null,
    inactiveProduct: { slug: "retired-product", name: "Retired product" },
    fetchImpl: fakeFetch,
  });

  assert.ok(calls.some(({ path }) => path === "/api/catalog/products/retired-product"));
  assert.ok(calls.some(({ path }) => path === "/api/contact"));
  assert.equal(calls[0].init.headers["User-Agent"], "Giacong-Staging-Deep-QA/1.0");
  assert.ok(calls[0].init.signal instanceof AbortSignal, "live QA requests need a finite timeout");
});

test("staging catalog QA uses active product and variant data for search and cart guards", async () => {
  const calls = [];
  const product = {
    slug: "live-food-product",
    variants: [{ isAvailable: true, minimumOrderQuantity: 3, sku: "REAL-SKU-3", tierPrices: [{ minQuantity: 3 }] }],
  };
  const fakeFetch = async (url, init = {}) => {
    const path = `${url.pathname}${url.search}`;
    calls.push({ path, init });
    if (url.pathname === "/san-pham") return mockResponse(200, "Live food product");
    if (url.pathname === "/api/catalog/products/live-food-product") return mockResponse(200, { product }, true);
    if (url.pathname === "/api/catalog/products/khong-ton-tai") return mockResponse(404, {}, true);
    if (url.pathname === "/api/gui-yeu-cau/xac-thuc") {
      const payload = JSON.parse(init.body);
      const adjustment = payload.lines[0].parentSlug === "khong-ton-tai" ? "PRODUCT_NOT_FOUND" : undefined;
      return mockResponse(200, {
        ok: true,
        cart: {
          isSubmittable: true,
          lines: adjustment ? [{ adjustments: [{ code: adjustment }] }] : [],
        },
      }, true);
    }
    if (url.pathname === "/api/contact" && init.body === "{bad json") return mockResponse(400, {}, true);
    if (url.pathname === "/api/contact") return mockResponse(409, { code: "CART_DRIFTED" }, true);
    throw new Error(`Unexpected request: ${path}`);
  };

  await runStagingCatalogQa({
    origin: "https://staging.example",
    activeProduct: { slug: "live-food-product", name: "Live food product", category_slug: "food" },
    inactiveProduct: null,
    fetchImpl: fakeFetch,
  });

  assert.ok(calls.some(({ path }) => path.startsWith("/san-pham?q=Live+food+product")));
  assert.ok(calls.some(({ path }) => path === "/san-pham?category=food"));
  assert.ok(calls.some(({ path }) => path === "/san-pham?sort=starting_price&direction=desc&per_page=48"));
  assert.ok(calls.some(({ init }) => init.method === "POST" && String(init.body).includes("REAL-SKU-3")));
});
