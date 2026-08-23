import assert from "node:assert/strict";
import test from "node:test";

import { parseAdminCategoryPayload } from "../src/lib/admin-category-input.ts";

const valid = {
  description: "Bột ngũ cốc nguyên hạt",
  imageUrl: "https://media.example.test/categories/bot.png",
  isActive: true,
  name: "Bột dinh dưỡng",
  slug: "bot-dinh-duong",
  sortOrder: "3",
};

test("parses a valid category payload with normalized fields", () => {
  const parsed = parseAdminCategoryPayload(valid);

  assert.equal(parsed.fieldErrors && Object.keys(parsed.fieldErrors).length, 0);
  assert.deepEqual(parsed.input, {
    description: "Bột ngũ cốc nguyên hạt",
    imageUrl: "https://media.example.test/categories/bot.png",
    isActive: true,
    name: "Bột dinh dưỡng",
    slug: "bot-dinh-duong",
    sortOrder: 3,
  });
});

test("rejects malformed slugs, empty names and bad image URLs per field", () => {
  const parsed = parseAdminCategoryPayload({
    ...valid,
    imageUrl: "javascript:alert(1)",
    name: "   ",
    slug: "Việt Nam!",
  });

  assert.equal(parsed.input, null);
  assert.match(parsed.fieldErrors?.name ?? "", /Tên danh mục/);
  assert.match(parsed.fieldErrors?.slug ?? "", /Slug/);
  assert.match(parsed.fieldErrors?.imageUrl ?? "", /Ảnh/);
});

test("rejects unknown payloads and negative sort orders", () => {
  assert.equal(parseAdminCategoryPayload(null).input, null);
  assert.equal(parseAdminCategoryPayload({}).input, null);

  const negative = parseAdminCategoryPayload({ ...valid, sortOrder: "-2" });
  assert.equal(negative.input, null);
  assert.ok(negative.fieldErrors?.sortOrder);
});
