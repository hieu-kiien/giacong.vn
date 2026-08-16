import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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

test("tier replacement guards parent revision before replacing rows and auditing", async () => {
  const source = await readFile(new URL("../src/lib/admin-variant-repository.ts", import.meta.url), "utf8");
  const update = source.indexOf("UPDATE product_variants SET revision=revision+1");
  const deleteRows = source.indexOf("DELETE FROM variant_tier_prices");
  const insertRows = source.indexOf("INSERT INTO variant_tier_prices");
  const audit = source.indexOf("'update','tier_prices'");

  assert.ok(update >= 0, "parent revision guard must exist");
  assert.ok(deleteRows > update, "tier DELETE must follow the revision guard");
  assert.ok(insertRows > deleteRows, "tier INSERT must follow the guarded DELETE");
  assert.ok(audit > insertRows, "audit insert must be last in the atomic replacement");
  assert.match(source, /const nextVersion=version\+1/);
  assert.match(source, /results\[0\]\?\.meta\?\.changes\?\?0\)\!==1/);
});

// Day 2 runtime probe trigger marker.
