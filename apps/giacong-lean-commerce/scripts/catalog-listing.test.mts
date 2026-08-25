import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildCatalogCard, demoCatalogList } from "../src/components/catalog/catalog-listing.ts";
import { findDemoCatalogProduct } from "../src/data/demo-catalog.ts";
import type { CatalogProductParent } from "../src/types/catalog.ts";

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

test("listing cards surface the MOQ from the demo catalog and the public feed", () => {
  const demoProduct = findDemoCatalogProduct("bot-gao-lut-xay-min");
  assert.ok(demoProduct);
  const pricedVariant = demoProduct.variants
    .filter((variant) => variant.isAvailable && variant.tierPrices.length > 0)
    .reduce((cheapest, variant) => (
      variant.tierPrices[0].price < cheapest.tierPrices[0].price ? variant : cheapest
    ));
  const demoCard = buildCatalogCard(demoProduct);
  assert.equal(
    demoCard.minimumOrderQuantity,
    pricedVariant.minimumOrderQuantity,
    "a demo detail row must publish the priced variant's MOQ on the card",
  );

  const feedParent: CatalogProductParent = {
    availableVariantCount: 2,
    category: null,
    description: "",
    id: 999,
    imageUrl: null,
    minimumOrderQuantity: 25,
    name: "QA-STAGING feed product",
    shortDescription: "Regression fixture",
    sku: "QA-STAGING-FEED-MOQ",
    slug: "qa-staging-feed-moq",
    startingPrice: null,
    type: "configurable",
    variantCount: 2,
  };
  const feedCard = buildCatalogCard(feedParent);
  assert.equal(feedCard.minimumOrderQuantity, 25, "a public-feed parent row must carry its aggregated MOQ onto the card");
});
