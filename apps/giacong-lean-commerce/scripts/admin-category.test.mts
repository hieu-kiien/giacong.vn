import test from "node:test";
import assert from "node:assert/strict";

import {
  decodeAdminVersion,
  normalizeCategoryInput,
  encodeAdminVersion,
} from "../src/lib/admin-category";

test("category input trims text and preserves canonical boolean/integer fields", () => {
  const result = normalizeCategoryInput({
    description: "  Mô tả  ",
    imageUrl: "  /media/products/a.jpg  ",
    isActive: true,
    name: "  Thực phẩm  ",
    slug: "  Thuc-Pham  ",
    sortOrder: 12,
  });

  assert.deepEqual(result, {
    description: "Mô tả",
    imageUrl: "/media/products/a.jpg",
    isActive: true,
    name: "Thực phẩm",
    slug: "thuc-pham",
    sortOrder: 12,
  });
});

test("category input rejects unreachable or malformed values", () => {
  assert.throws(
    () => normalizeCategoryInput({
      description: "",
      imageUrl: null,
      isActive: true,
      name: "",
      slug: "x",
      sortOrder: 0,
    }),
    /name/i,
  );

  assert.throws(
    () => normalizeCategoryInput({
      description: "",
      imageUrl: null,
      isActive: true,
      name: "Category",
      slug: "../bad",
      sortOrder: 0,
    }),
    /slug/i,
  );

  assert.throws(
    () => normalizeCategoryInput({
      description: "",
      imageUrl: null,
      isActive: true,
      name: "Category",
      slug: "category",
      sortOrder: 1.5,
    }),
    /sortOrder/i,
  );
});

test("admin version is opaque and round-trips the durable revision", () => {
  const version = encodeAdminVersion(42);
  assert.notEqual(version, "42");
  assert.equal(decodeAdminVersion(version), 42);
  assert.throws(() => decodeAdminVersion("42"), /version/i);
});
