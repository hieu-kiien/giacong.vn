import assert from "node:assert/strict";
import test from "node:test";
import { parseAdminServicePayload } from "../src/lib/admin-service-input.ts";

function basePayload() {
  return {
    name: "QA-STAGING dịch vụ",
    slug: "qa-staging-dich-vu",
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
