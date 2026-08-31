import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("category admin surface enforces read capability and deactivation-only removal", async () => {
  const [listRoute, detailRoute, panel] = await Promise.all([
    readFile(new URL("../src/app/api/admin/categories/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/categories/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/admin/AdminCategoryPanel.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(listRoute, /canManage\(guard\.member\.role,\s*"catalog\.read"\)/);
  assert.match(listRoute, /readBoundedAdminJson/);
  assert.doesNotMatch(listRoute, /request\.json\(\)/);
  assert.match(detailRoute, /export async function GET/);
  assert.match(detailRoute, /canManage\(guard\.member\.role,\s*"catalog\.read"\)/);
  assert.match(detailRoute, /readBoundedAdminJson/);
  assert.doesNotMatch(detailRoute, /request\.json\(\)/);
  assert.doesNotMatch(detailRoute, /deleteAdminCategory|export async function DELETE/);
  assert.match(panel, /method: "PATCH"/);
  assert.doesNotMatch(panel, /method: "DELETE"/);
  assert.match(panel, /Ẩn danh mục/);
  assert.match(panel, /revision:\s*category\.revision/);
  assert.doesNotMatch(panel, /Xóa vĩnh viễn|pendingDelete|deleteAdminCategory/);
});
