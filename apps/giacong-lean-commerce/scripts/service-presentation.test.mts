import assert from "node:assert/strict";
import test from "node:test";

import { serviceFamilies } from "../src/data/service-families.ts";
import {
  defaultServicePresentation,
  resolveServicePresentation,
} from "../src/lib/service-presentation.ts";

test("service presentation falls back to captured offerings and contextual CTA", () => {
  const family = serviceFamilies[4];
  const presentation = defaultServicePresentation(family.slug, family);

  assert.deepEqual(presentation.offerings, family.offerings);
  assert.equal(presentation.ctaLabel, "Liên hệ tư vấn");
  assert.equal(presentation.ctaHref, "/lien-he/?service=gia-cong-thuc-pham");
  assert.equal(presentation.sortOrder, 4);
});

test("service presentation accepts stored JSON while rejecting malformed rows", () => {
  const family = serviceFamilies[0];
  const resolved = resolveServicePresentation(family.slug, family, {
    cta_href: "/lien-he/?service=gia-cong-sot-cham",
    cta_label: "Trao đổi công thức",
    offerings_json: JSON.stringify([{ href: "/qa-offering/", label: "Mục QA" }]),
    sort_order: 11,
  });
  assert.deepEqual(resolved.offerings, [{ href: "/qa-offering/", label: "Mục QA" }]);
  assert.equal(resolved.ctaLabel, "Trao đổi công thức");
  assert.equal(resolved.ctaHref, "/lien-he/?service=gia-cong-sot-cham");
  assert.equal(resolved.sortOrder, 11);

  const malformed = resolveServicePresentation(family.slug, family, {
    cta_href: "javascript:alert(1)",
    cta_label: "",
    offerings_json: "not-json",
    sort_order: -1,
  });
  assert.deepEqual(malformed.offerings, family.offerings);
  assert.equal(malformed.ctaLabel, "Liên hệ tư vấn");
  assert.equal(malformed.ctaHref, "/lien-he/?service=gia-cong-sot-cham");
  assert.equal(malformed.sortOrder, 0);
});
