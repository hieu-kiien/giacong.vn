import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("managed service read carries an optional main image without inventing one", async () => {
  const [families, managed] = await Promise.all([
    readFile(new URL("../src/data/service-families.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/cloudflare-services.ts", import.meta.url), "utf8"),
  ]);
  assert.match(families, /imageUrl\??:/, "ServiceFamily must declare an optional imageUrl");
  assert.match(managed, /image_url/, "the D1 read must select services.image_url");
  assert.match(managed, /imageUrl:/, "the managed family must map image_url onto imageUrl");
});