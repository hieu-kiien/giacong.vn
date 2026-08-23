import assert from "node:assert/strict";
import test from "node:test";

import { isUniqueConstraintError, mapAdminWriteError } from "../src/lib/admin-error-mapping.ts";

test("classifies D1 constraint violations from the message shapes D1 actually emits", () => {
  for (const message of [
    "UNIQUE constraint failed: products.slug",
    "D1_ERROR: UNIQUE constraint failed: product_variants.sku: SQLITE_CONSTRAINT",
    "PRIMARY KEY constraint failed: categories.id",
  ]) {
    assert.equal(isUniqueConstraintError(new Error(message)), true, message);
  }

  assert.equal(isUniqueConstraintError(new Error("no such table: site_settings")), false);
  assert.equal(isUniqueConstraintError("not an error instance"), false);
});

test("maps a unique violation to a conflict envelope without leaking the raw message", () => {
  const mapped = mapAdminWriteError(new Error('UNIQUE constraint failed: products.slug: value "x"'), "Không thể tạo sản phẩm.", {
    fieldErrors: { slug: "Slug hoặc SKU đã tồn tại." },
    message: "Slug hoặc SKU đã tồn tại.",
  });

  assert.deepEqual(
    { code: mapped.code, status: mapped.status },
    { code: "UNIQUE_CONFLICT", status: 409 },
  );
  assert.equal(mapped.message, "Slug hoặc SKU đã tồn tại.");
  assert.deepEqual(mapped.fieldErrors, { slug: "Slug hoặc SKU đã tồn tại." });
});

test("maps every other failure to the safe fallback without surfacing internals", () => {
  const internal = new Error("no such table: lead_rows in database f6aabba5");

  const mapped = mapAdminWriteError(internal, "Không thể tải danh sách sản phẩm.");
  assert.equal(mapped.code, "INTERNAL_ERROR");
  assert.equal(mapped.status, 503);
  assert.equal(mapped.message, "Không thể tải danh sách sản phẩm.");
  assert.equal(mapped.fieldErrors, undefined);
  assert.doesNotMatch(JSON.stringify(mapped), /lead_rows|f6aabba5/, "internal detail must never reach the client body");
});
