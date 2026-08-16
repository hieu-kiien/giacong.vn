import assert from "node:assert/strict";
import test from "node:test";
import { getServiceFamily, serviceFamilies } from "../src/data/service-families.ts";

test("service taxonomy keeps stable slugs and complete fallback copy", () => {
  assert.ok(serviceFamilies.length > 0);
  for (const family of serviceFamilies) {
    assert.match(family.slug, /^[a-z0-9-]+$/);
    assert.ok(family.name.trim());
    assert.ok(family.summary.trim());
    assert.ok(family.description.trim());
    assert.equal(getServiceFamily(family.slug)?.slug, family.slug);
  }
});