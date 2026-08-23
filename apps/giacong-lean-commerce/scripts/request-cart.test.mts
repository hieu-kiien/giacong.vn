import assert from "node:assert/strict";
import test from "node:test";
import {
  parseRequestCartLines,
  resolveRequestCart,
  resolveRequestCartBatch,
  resolveTierPrice,
} from "../src/lib/request-cart.ts";

const product = {
  imageUrl: null,
  name: "Bột demo",
  slug: "bot-demo",
  variants: [{
    contactFromQuantity: 100,
    isAvailable: true,
    label: "Vị vani",
    minimumOrderQuantity: 10,
    quantityStep: 5,
    sku: "SKU-DEMO",
    tierPrices: [{ minQuantity: 10, price: 84000 }, { minQuantity: 50, price: 79000 }],
    unit: "gói",
  }],
};

test("parses exact cart keys and rejects duplicate variants", () => {
  const line = { parentSlug: "bot-demo", quantity: 25, variantSku: "SKU-DEMO" };
  assert.equal(parseRequestCartLines([line]).ok, true);
  assert.equal(parseRequestCartLines([line, line]).ok, false);
});

test("resolves highest matching tier and recomputes subtotal server-side", async () => {
  assert.equal(resolveTierPrice(55, product.variants[0].tierPrices), 79000);
  const cart = await resolveRequestCart(
    [{ parentSlug: "bot-demo", quantity: 25, variantSku: "SKU-DEMO" }],
    async () => product,
  );
  assert.equal(cart.lines[0].unitPrice, 84000);
  assert.equal(cart.lines[0].lineTotal, 2_100_000);
  assert.equal(cart.pricedSubtotal, 2_100_000);
  assert.equal(cart.isSubmittable, true);
});

test("resolves the whole cart through one deduplicated batch lookup", async () => {
  const otherProduct = {
    ...product,
    name: "Sản phẩm khác",
    slug: "san-pham-khac",
    variants: [{ ...product.variants[0], sku: "SKU-KHAC", tierPrices: [{ minQuantity: 10, price: 10_000 }] }],
  };
  const calls: string[][] = [];
  const cart = await resolveRequestCartBatch(
    [
      { parentSlug: "bot-demo", quantity: 25, variantSku: "SKU-DEMO" },
      { parentSlug: "san-pham-khac", quantity: 10, variantSku: "SKU-KHAC" },
      { parentSlug: "bot-demo", quantity: 55, variantSku: "SKU-DEMO" },
    ],
    async (slugs) => {
      calls.push([...slugs]);
      return new Map([
        ["bot-demo", product],
        ["san-pham-khac", otherProduct],
      ]);
    },
  );

  assert.deepEqual(calls, [["bot-demo", "san-pham-khac"]], "one call, unique slugs, original order");
  assert.equal(cart.lineCount, 3);
  assert.equal(cart.lines[0].unitPrice, 84000);
  assert.equal(cart.lines[2].unitPrice, 79000);
  assert.equal(cart.lines[1].lineTotal, 100_000);
  assert.equal(cart.pricedSubtotal, 2_100_000 + 100_000 + 79_000 * 55);
});

test("a slug missing from the batch result resolves as an unknown product line", async () => {
  const cart = await resolveRequestCartBatch(
    [{ parentSlug: "da-mat", quantity: 10, variantSku: "SKU-DEMO" }],
    async () => new Map(),
  );

  assert.equal(cart.lines[0].isSubmittable, false);
  assert.equal(cart.lines[0].adjustments[0]?.code, "PRODUCT_NOT_FOUND");
  assert.equal(cart.isSubmittable, false);
});