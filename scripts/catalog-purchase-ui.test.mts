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
