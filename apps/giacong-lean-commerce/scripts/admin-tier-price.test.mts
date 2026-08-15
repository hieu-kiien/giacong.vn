import test from "node:test";
import assert from "node:assert/strict";

import { normalizeTierPrices } from "../src/lib/admin-variant.ts";

test("tier replacement requires an MOQ tier and canonical quantity alignment", () => {
  const tiers = normalizeTierPrices(
    [
      { minQuantity: 100, price: 9000 },
      { minQuantity: 200, price: 8500 },
    ],
    { moq: 100, quantityStep: 100, contactFromQuantity: 500 },
  );

  assert.deepEqual(tiers, [
    { minQuantity: 100, price: 9000 },
    { minQuantity: 200, price: 8500 },
  ]);
});

test("tier replacement rejects unreachable and duplicate boundaries", () => {
  assert.throws(
    () => normalizeTierPrices(
      [{ minQuantity: 150, price: 9000 }],
      { moq: 100, quantityStep: 100, contactFromQuantity: 500 },
    ),
    /MOQ/i,
  );

  assert.throws(
    () => normalizeTierPrices(
      [
        { minQuantity: 100, price: 9000 },
        { minQuantity: 300, price: 8500 },
      ],
      { moq: 100, quantityStep: 100, contactFromQuantity: 300 },
    ),
    /contactFromQuantity/i,
  );
});

test("tier replacement rejects non-positive VND prices", () => {
  assert.throws(
    () => normalizeTierPrices(
      [{ minQuantity: 100, price: 0 }],
      { moq: 100, quantityStep: 100, contactFromQuantity: 500 },
    ),
    /price/i,
  );
});
