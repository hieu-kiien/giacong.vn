import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { resolveRequestCart } from "../src/lib/request-cart.ts";
import { toRequestCartProductResolution } from "../src/lib/request-cart-demo.ts";
import { parseProductImportCsv } from "../src/lib/admin-product-import-csv.ts";

function lineFixture(variantImage: unknown, productImage: string | null) {
  return {
    imageUrl: productImage,
    name: "Bột demo",
    slug: "bot-demo",
    variants: [{
      contactFromQuantity: 100,
      imageUrl: variantImage,
      isAvailable: true,
      label: "Vị vani",
      minimumOrderQuantity: 10,
      quantityStep: 5,
      sku: "SKU-DEMO",
      tierPrices: [{ minQuantity: 10, price: 84000 }],
      unit: "gói",
    }],
  };
}

test("F1: cart line prefers the variant image over the product image", async () => {
  const cart = await resolveRequestCart(
    [{ parentSlug: "bot-demo", quantity: 10, variantSku: "SKU-DEMO" }],
    // @ts-expect-error fixture intentionally mirrors the resolver shape at runtime
    async () => lineFixture("https://cdn.example/variant-vani.webp", "https://cdn.example/product.webp"),
  );

  assert.equal(cart.lines[0]?.imageUrl, "https://cdn.example/variant-vani.webp");
});

test("F1: cart line falls back to the product image when the variant has none", async () => {
  for (const variantImage of [null, undefined, ""]) {
    const cart = await resolveRequestCart(
      [{ parentSlug: "bot-demo", quantity: 10, variantSku: "SKU-DEMO" }],
      // @ts-expect-error fixture intentionally mirrors the resolver shape at runtime
      async () => lineFixture(variantImage, "https://cdn.example/product.webp"),
    );

    assert.equal(cart.lines[0]?.imageUrl, "https://cdn.example/product.webp");
    // Server-side pricing must be untouched by the image fallback.
    assert.equal(cart.lines[0]?.unitPrice, 84000);
    assert.equal(cart.lines[0]?.lineTotal, 840000);
  }
});

test("F1: catalog projection carries the variant imageUrl through", () => {
  const detail = {
    availableVariantCount: 1,
    category: null,
    description: "",
    id: 1,
    imageUrl: "https://cdn.example/product.webp",
    minimumOrderQuantity: 10,
    name: "Bột demo",
    optionGroups: [],
    shortDescription: "",
    sku: "BOT-001",
    slug: "bot-demo",
    startingPrice: null,
    type: "configurable",
    variantCount: 1,
    variantIndex: {},
    variants: [{
      contactFromQuantity: 100,
      id: 11,
      imageUrl: "https://cdn.example/variant-vani.webp",
      isAvailable: true,
      minimumOrderQuantity: 10,
      name: "Vị vani",
      optionValues: [],
      quantityStep: 5,
      sku: "SKU-DEMO",
      tierPrices: [{ minQuantity: 10, price: 84000 }],
      unit: "gói",
    }],
  };

  // @ts-expect-error fixture intentionally mirrors the catalog detail shape at runtime
  const resolution = toRequestCartProductResolution(detail);
  assert.equal(resolution.variants[0]?.imageUrl, "https://cdn.example/variant-vani.webp");
});

test("F2: AdminCategoryPanel has no unreachable media-picker state", async () => {
  const panel = await readFile(
    path.join(import.meta.dirname, "../src/components/admin/AdminCategoryPanel.tsx"),
    "utf8",
  );

  // The shared modal must survive: other panels (san-pham, tin-tuc, visual editor) own it.
  const modal = await readFile(
    path.join(import.meta.dirname, "../src/components/admin/AdminMediaPickerModal.tsx"),
    "utf8",
  );
  assert.match(modal, /export function AdminMediaPickerModal/);

  // Dead-code contract: no picker state unless the panel can actually open it.
  const opensPicker = /setPickerOpen\(\s*true\s*\)/.test(panel);
  const referencesPicker = /pickerOpen|setPickerOpen|AdminMediaPickerModal/.test(panel);
  assert.equal(referencesPicker && !opensPicker, false, "unreachable picker code is still present");
  assert.equal(referencesPicker, false);
});

test("F3: product-only CSV import rejects variant_* columns with a clear message", () => {
  const result = parseProductImportCsv("name,slug,sku,variant_sku\nA,a,A-1,V-1");

  assert.equal(result.rows.length, 0);
  assert.ok(result.errors.length > 0);
  const joined = result.errors.join("\n");
  assert.match(joined, /variant_sku/);
  // Contract message must say the import is product-only, not just "unsupported".
  assert.match(joined, /chỉ nhận sản phẩm/i);
});
