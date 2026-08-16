import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("catalog purchase surfaces are request-only and expose MOQ/tier context", async () => {
  const [panel, configurator, tierTable, cartButton] = await Promise.all([
    readFile(new URL("src/components/catalog/ProductPurchasePanel.tsx", root), "utf8"),
    readFile(new URL("src/components/catalog/ProductConfigurator.tsx", root), "utf8"),
    readFile(new URL("src/components/catalog/TierPriceTable.tsx", root), "utf8"),
    readFile(new URL("src/components/request-cart/CapturedRequestCartButton.tsx", root), "utf8"),
  ]);
  assert.match(panel, /minimumOrderQuantity|MOQ/);
  assert.match(panel, /upsertRequestCartLine/);
  assert.match(configurator, /quantityStep/);
  assert.match(tierTable, /minQuantity/);
  assert.match(cartButton, /REQUEST_CART/);
  assert.doesNotMatch(panel, /\bcheckout\b|\bpayment\b/i);
});