import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTierPrices, normalizeVariantInput } from "../src/lib/admin-variant.ts";

test("variant normalization preserves canonical fields and validates quantity invariants", () => {
  const result = normalizeVariantInput({
    name: "  500g  ", sku: " SKU-500 ", optionLabel: "  500 g  ", unit: " kg ",
    moq: 100, quantityStep: 50, contactFromQuantity: 1000, isAvailable: true, sortOrder: 1,
    attributeId: 1, attributeCode: "size", attributeLabel: "Kích thước", optionId: 2, imageUrl: " /media/products/a.webp ",
  });
  assert.equal(result.name, "500g");
  assert.equal(result.sku, "SKU-500");
  assert.equal(result.quantityStep, 50);
  assert.equal(result.imageUrl, "/media/products/a.webp");
});

test("variant rejects unreachable contact threshold", () => {
  assert.throws(() => normalizeVariantInput({
    name: "V", sku: "S", optionLabel: "O", unit: "kg", moq: 100, quantityStep: 50, contactFromQuantity: 925,
    isAvailable: true, sortOrder: 0, attributeId: 1, attributeCode: "size", attributeLabel: "Size", optionId: 1, imageUrl: null,
  }), /contactFromQuantity/i);
});

test("tier replacement requires MOQ tier and step-aligned boundaries", () => {
  const variant = { moq: 100, quantityStep: 50, contactFromQuantity: 1000 };
  assert.deepEqual(normalizeTierPrices([{ minQuantity: 300, price: 10000 }, { minQuantity: 100, price: 12000 }], variant), [
    { minQuantity: 100, price: 12000 }, { minQuantity: 300, price: 10000 },
  ]);
  assert.throws(() => normalizeTierPrices([{ minQuantity: 150, price: 10000 }], variant), /MOQ/i);
  assert.throws(() => normalizeTierPrices([{ minQuantity: 100, price: 10000 }, { minQuantity: 125, price: 9000 }], variant), /aligned/i);
  assert.throws(() => normalizeTierPrices([{ minQuantity: 100, price: 10000 }, { minQuantity: 100, price: 9000 }], variant), /Duplicate/i);
});
