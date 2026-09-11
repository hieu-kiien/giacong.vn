import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseAdminServicePayload } from "../src/lib/admin-service-input.ts";
import { serviceFamilies } from "../src/data/service-families.ts";

function basePayload(slug: string) {
  return {
    name: "Dịch vụ kiểm tra gaps",
    slug,
    summary: "Tóm tắt kiểm tra",
    description: "Mô tả kiểm tra",
    status: "draft",
    isActive: false,
  };
}

test("service write rejects an orphan slug the static [family] gate would ignore", () => {
  const parsed = parseAdminServicePayload(basePayload("dich-vu-ma-khong-ton-tai"));
  assert.equal(parsed.input, null);
  assert.match(parsed.fieldErrors.slug ?? "", /13 nhóm/);
});

test("all 13 static family slugs pass service input validation", () => {
  assert.equal(serviceFamilies.length, 13);
  for (const family of serviceFamilies) {
    const parsed = parseAdminServicePayload(basePayload(family.slug));
    assert.equal(parsed.fieldErrors.slug, undefined, `slug ${family.slug} must stay writable`);
    assert.ok(parsed.input);
    assert.equal(parsed.input?.slug, family.slug);
  }
});

test("service family detail renders MOQ and lead time when managed data carries them", async () => {
  const source = await readFile(
    new URL("../src/components/services/ServiceFamilyDetail.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /moqSummary/);
  assert.match(source, /leadTimeDays/);
  assert.match(source, /Số lượng tối thiểu/);
  assert.match(source, /Thời gian làm hàng/);
  assert.match(source, /data-testid="service-managed-facts"/);
});

test("news keeps the live storefront hand-off and no simulated preview", async () => {
  const [action, detail, adminNews] = await Promise.all([
    readFile(new URL("../src/components/admin/AdminNewsContextualAction.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(storefront)/tin-tuc/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/tin-tuc/page.tsx", import.meta.url), "utf8"),
  ]);
  // Hand-off that exists today: real published page renders the contextual edit action.
  assert.match(detail, /AdminNewsContextualAction/);
  assert.match(detail, /newsId=\{post\.id\}/);
  assert.match(detail, /getPublishedNewsPost/);
  // The action is an edit hand-off back to admin, owner-gated — not a mock preview.
  assert.match(action, /\/admin\/tin-tuc\?edit=/);
  assert.match(action, /owner/);
  assert.match(action, /useAdminVisualContext/);
  assert.doesNotMatch(action, /MockPreview|FakePreview|Live draft preview|admin-preview-page/);
  // The news editor has no simulated preview panel; the draft/publish hint is the contract.
  assert.doesNotMatch(adminNews, /MockPreview|FakePreview|Live draft preview|admin-content-preview/);
  assert.match(adminNews, /news-draft-hint/);
});

test("managed service family carries MOQ facts without risking the managed copy", async () => {
  const source = await readFile(
    new URL("../src/lib/cloudflare-services.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /ManagedServiceFacts/);
  assert.match(source, /FROM service_admin_meta/);
  assert.match(source, /service_id = \(SELECT id FROM services/);
  // Meta stays a separate fail-soft read: a missing table drops the facts only.
  assert.match(source, /\.\.\.absent/);
});
