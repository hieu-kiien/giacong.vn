import assert from "node:assert/strict";
import test from "node:test";
import {
  parseRequestCartLines,
  resolveRequestCart,
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