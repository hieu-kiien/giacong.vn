import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildCatalogCard, demoCatalogList } from "../src/components/catalog/catalog-listing.ts";
import { findDemoCatalogProduct } from "../src/data/demo-catalog.ts";

test("listing view model keeps detail routing and server-owned purchase rules", () => {
  const product = findDemoCatalogProduct("bot-gao-lut-xay-min");
  assert.ok(product);
  const card = buildCatalogCard(product);
  assert.equal(card.detailHref, "/san-pham/bot-gao-lut-xay-min/");
  assert.equal(card.action.kind, "select-variant");
  assert.equal(card.purchase, null);
  assert.ok(card.tierPrices.length > 0);
});

test("demo listing applies the same category and pagination contract", () => {
  const result = demoCatalogList({
    category: "bot-nguyen-lieu-kho",
    direction: "asc",
    page: 1,
    pageSize: 12,
    query: "",
    sort: "name",
  });
  assert.ok(result.products.length > 0);
  assert.equal(result.pagination.currentPage, 1);
  assert.equal(result.products.every((product) => product.category?.slug === "bot-nguyen-lieu-kho"), true);
});

test("detail and batch catalog reads include the product-level MOQ field", async () => {
  const source = await readFile(new URL("../src/lib/cloudflare-catalog.ts", import.meta.url), "utf8");
  const columns = source.match(/const PARENT_PRODUCT_COLUMNS = `([\s\S]*?)`;/)?.[1];
  const minimumQuantityAggregates = source.match(/MIN\(CASE WHEN v\.is_available = 1 THEN v\.moq ELSE NULL END\) AS minimum_order_quantity/g) ?? [];

  assert.ok(columns, "the shared parent-product column contract must exist");
  assert.match(columns, /vs\.minimum_order_quantity/, "detail and batch reads must hydrate the parent MOQ");
  assert.equal(minimumQuantityAggregates.length, 3, "listing, detail, and batch queries must all compute the parent MOQ");
});
