import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = path.join(import.meta.dirname, "..");

test("the product-detail purchase actions add a minimal cart line and offer immediate continuation", async () => {
  const source = await readFile(
    path.join(repoRoot, "src", "components", "catalog", "PurchaseQuantity.tsx"),
    "utf8",
  );

  assert.match(source, /upsertRequestCartLine/, "the detail action must use the locked cart storage mutation");
  assert.match(source, /writeRequestCart/, "the detail action must persist the cart after a successful mutation");
  assert.match(source, /parentSlug,[\s\S]*quantity,[\s\S]*variantSku/, "the stored line must contain only the three permitted keys");
  assert.match(source, /router\.push\("\/gui-yeu-cau\/"\)/, "the primary action must continue to the only cart route");
  assert.match(source, /Thêm vào giỏ yêu cầu/, "customers must be able to add a line without leaving product detail");
  assert.match(source, /Gửi yêu cầu ngay/, "customers must be able to continue directly to the request form");
  assert.doesNotMatch(source, /intent=|variant_sku=|quantity=/, "the action must not send ignored contact query parameters");
});

test("a catalog card adds its sole available variant without trusting price data", async () => {
  const source = await readFile(
    path.join(repoRoot, "src", "components", "catalog", "CatalogCardPurchase.tsx"),
    "utf8",
  );

  assert.match(source, /upsertRequestCartLine/, "the card must use the locked cart mutation");
  assert.match(source, /writeRequestCart/, "the card must persist only a successful mutation");
  assert.match(source, /parentSlug,[\s\S]*quantity,[\s\S]*variantSku/, "the stored line must contain only the three permitted keys");
  assert.doesNotMatch(source, /unitPrice|lineTotal|pricedSubtotal/, "cards must never put money into browser storage");
});

// The single-variant guard moved out of this component. `buildCatalogCards` sets
// `purchase` to null unless exactly one variant is usable, and the card renders the
// stepper only when it is non-null, so a fabricated SKU cannot reach storage. The
// behaviour is covered by catalog-listing.test.mts; these two assert the wiring that
// keeps the guard load-bearing.
test("the stepper is rendered only behind a proven purchase rule", async () => {
  const [card, listing] = await Promise.all([
    readFile(path.join(repoRoot, "src", "components", "catalog", "CatalogProductCard.tsx"), "utf8"),
    readFile(path.join(repoRoot, "src", "components", "catalog", "catalog-listing.ts"), "utf8"),
  ]);

  assert.match(card, /\{purchase \?/, "the card must gate the stepper on a non-null purchase rule");
  assert.match(listing, /purchase: CatalogCardPurchaseRule \| null/, "the rule must stay nullable");
  assert.match(listing, /function purchaseRule\(/, "the listing must own the single-variant decision");
});
