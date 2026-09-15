import assert from "node:assert/strict";
import test from "node:test";
import { parseAdminServicePayload } from "../src/lib/admin-service-input.ts";

function basePayload() {
  return {
    name: "QA-STAGING dịch vụ",
    slug: "gia-cong-sua",
    summary: "Tóm tắt QA",
    description: "Mô tả QA",
    status: "draft",
    isActive: false,
  };
}

test("service input accepts a media-path main image", () => {
  const parsed = parseAdminServicePayload({ ...basePayload(), imageUrl: "/media/services/qa-staging.jpg" });
  assert.equal(parsed.input?.imageUrl, "/media/services/qa-staging.jpg");
});

test("service input accepts an absolute http(s) image URL", () => {
  const parsed = parseAdminServicePayload({ ...basePayload(), imageUrl: "https://kienhieu.id.vn/media/services/a.png" });
  assert.equal(parsed.input?.imageUrl, "https://kienhieu.id.vn/media/services/a.png");
});

test("service input rejects a non-URL image value", () => {
  const parsed = parseAdminServicePayload({ ...basePayload(), imageUrl: "not a url" });
  assert.equal(parsed.input, null);
  assert.match(parsed.fieldErrors.imageUrl ?? "", /URL/);
});

test("service input keeps the main image nullable", () => {
  const withoutImage = parseAdminServicePayload(basePayload());
  assert.equal(withoutImage.input?.imageUrl, null);
  const cleared = parseAdminServicePayload({ ...basePayload(), imageUrl: null });
  assert.equal(cleared.input?.imageUrl, null);
});

test("service input accepts an editable ordered offering list and CTA", () => {
  const parsed = parseAdminServicePayload({
    ...basePayload(),
    ctaHref: "/lien-he/?service=gia-cong-sua",
    ctaLabel: "Nhận tư vấn cho nhóm này",
    offerings: [
      { href: "/gia-cong-sua-hat/", label: "Gia công sữa hạt" },
      { href: "/gia-cong-sua-bot/", label: "Gia công sữa bột" },
    ],
    sortOrder: 4,
  });

  assert.ok(parsed.input);
  assert.deepEqual(parsed.input?.offerings, [
    { href: "/gia-cong-sua-hat/", label: "Gia công sữa hạt" },
    { href: "/gia-cong-sua-bot/", label: "Gia công sữa bột" },
  ]);
  assert.equal(parsed.input?.ctaLabel, "Nhận tư vấn cho nhóm này");
  assert.equal(parsed.input?.ctaHref, "/lien-he/?service=gia-cong-sua");
  assert.equal(parsed.input?.sortOrder, 4);
});

test("service input rejects unsafe or ambiguous presentation links", () => {
  const externalCta = parseAdminServicePayload({
    ...basePayload(),
    ctaHref: "https://example.com/",
  });
  assert.equal(externalCta.input, null);
  assert.match(externalCta.fieldErrors.ctaHref ?? "", /đường dẫn nội bộ/);

  const duplicateOfferings = parseAdminServicePayload({
    ...basePayload(),
    offerings: [
      { href: "/gia-cong-sua-hat/", label: "Sữa hạt" },
      { href: "/gia-cong-sua-hat/", label: "Sữa hạt khác" },
    ],
  });
  assert.equal(duplicateOfferings.input, null);
  assert.match(duplicateOfferings.fieldErrors.offerings ?? "", /trùng/);
});
