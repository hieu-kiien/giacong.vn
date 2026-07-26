import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = path.join(import.meta.dirname, "..");

test("the product-detail purchase action writes a minimal request-cart line before continuing", async () => {
  const source = await readFile(
    path.join(repoRoot, "src", "components", "catalog", "PurchaseQuantity.tsx"),
    "utf8",
  );

  assert.match(source, /upsertRequestCartLine/, "the detail action must use the locked cart storage mutation");
  assert.match(source, /writeRequestCart/, "the detail action must persist the cart after a successful mutation");
  assert.match(source, /parentSlug,[\s\S]*quantity,[\s\S]*variantSku/, "the stored line must contain only the three permitted keys");
  assert.match(source, /router\.push\("\/gui-yeu-cau\/"\)/, "the primary action must continue to the only cart route");
  assert.doesNotMatch(source, /intent=|variant_sku=|quantity=/, "the action must not send ignored contact query parameters");
});

test("a catalog card adds its sole available variant without trusting price data", async () => {
  const source = await readFile(
    path.join(repoRoot, "src", "components", "catalog", "CatalogCardPurchase.tsx"),
    "utf8",
  );

  assert.match(source, /upsertRequestCartLine/, "the card must use the locked cart mutation");
  assert.match(source, /writeRequestCart/, "the card must persist only a successful mutation");
  assert.match(source, /availableVariants\.length !== 1/, "cards with multiple choices must not invent a variant");
  assert.match(source, /router\.push\(`\/san-pham\/\$\{encodeURIComponent\(slug\)\}\/`\)/, "cards with multiple choices must open detail");
  assert.doesNotMatch(source, /unitPrice|lineTotal|pricedSubtotal/, "cards must never put money into browser storage");
});
