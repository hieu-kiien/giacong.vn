import assert from "node:assert/strict";
import test from "node:test";
import { buildCatalogCard, buildCatalogCards, demoCatalogList } from "../src/components/catalog/catalog-listing.ts";
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

test("live catalog cards never invent a demo product image", () => {
  const product = findDemoCatalogProduct("bot-gao-lut-xay-min");
  assert.ok(product);

  const [liveCard] = buildCatalogCards([{ ...product, imageUrl: null }]);
  assert.equal(liveCard.imageUrl, null);
  assert.equal(liveCard.fallbackImageUrl, undefined);

  const [demoCard] = buildCatalogCards([product], { demoImageFallback: true });
  assert.match(demoCard.fallbackImageUrl ?? "", /^\/images\/products\//);
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
