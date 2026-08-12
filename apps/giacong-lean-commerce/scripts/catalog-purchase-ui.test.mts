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

test("catalog cards route every product through detail instead of embedding purchase controls", async () => {
  const source = await readFile(
    path.join(repoRoot, "src", "components", "catalog", "CatalogProductCard.tsx"),
    "utf8",
  );

  assert.match(source, /Xem chi tiết/, "the card exposes the one approved action");
  assert.match(source, /detailHref/, "the action routes to product detail");
  assert.doesNotMatch(source, /CatalogCardPurchase|upsertRequestCartLine|writeRequestCart/, "the listing never mutates the request cart");
  assert.doesNotMatch(source, /Mua ngay|Chọn quy cách/, "all product cards keep the same action label");
});
