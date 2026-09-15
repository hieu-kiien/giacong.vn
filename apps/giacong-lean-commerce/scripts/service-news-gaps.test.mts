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

test("service write accepts a valid new group slug for the dynamic family route", () => {
  const parsed = parseAdminServicePayload(basePayload("qa-dich-vu-moi"));
  assert.ok(parsed.input);
  assert.equal(parsed.fieldErrors.slug, undefined);
});

test("service write still rejects malformed group slugs", () => {
  const parsed = parseAdminServicePayload(basePayload("Dịch vụ không hợp lệ"));
  assert.equal(parsed.input, null);
  assert.match(parsed.fieldErrors.slug ?? "", /chữ thường/);
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

test("service family presentation stays admin-editable instead of static-only", async () => {
  const [detail, directory, input, migration, redirectMigration, redirectReader, detailRoute, writer, createAction] = await Promise.all([
    readFile(new URL("../src/components/services/ServiceFamilyDetail.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/services/ServiceDirectory.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/admin-service-input.ts", import.meta.url), "utf8"),
    readFile(new URL("../migrations/0025_managed_service_presentation.sql", import.meta.url), "utf8"),
    readFile(new URL("../migrations/0026_service_slug_redirects.sql", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/cloudflare-services.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(storefront)/thue-gia-cong/[family]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/admin-service-write.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/admin/AdminServiceCreateContextualAction.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(detail, /ctaLabel/);
  assert.match(detail, /ctaHref/);
  assert.match(directory, /sortOrder/);
  assert.match(input, /offerings/);
  assert.match(input, /ctaHref/);
  assert.match(migration, /offerings_json/);
  assert.match(migration, /sort_order/);
  assert.match(redirectMigration, /service_slug_redirects/);
  assert.match(redirectReader, /getManagedServiceRedirect/);
  assert.match(redirectReader, /services\.is_active = 1/);
  assert.match(detailRoute, /getManagedServiceRedirect/);
  assert.match(detailRoute, /redirect\(/);
  assert.match(writer, /buildServiceSlugRedirect/);
  assert.match(createAction, /Shortcut này chỉ tạo bản nháp/);
  assert.doesNotMatch(createAction, /option value="published"/);
});

test("managed service context is resolved again at the contact boundary", async () => {
  const [route, client, server, api] = await Promise.all([
    readFile(new URL("../src/app/(storefront)/[...slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/contact-form.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/contact-webhook.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/contact/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(route, /getManagedServiceFamily/);
  assert.match(route, /serviceContextUrl/);
  assert.match(client, /input\[name="service_url"\]/);
  assert.match(server, /serviceResolver/);
  assert.match(server, /service_url: serviceUrl \|\| submission\.source/);
  assert.match(api, /getManagedServiceFamily/);
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

test("service directory reads active D1 groups and keeps the static fallback", async () => {
  const source = await readFile(
    new URL("../src/lib/cloudflare-services.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /getManagedServiceFamilies/);
  assert.match(source, /WHERE is_active = 1/);
  assert.match(source, /serviceFamilyFromRow/);
  assert.match(source, /return base/);
});

test("managed service pages are dynamic so published D1 copy is not frozen at build time", async () => {
  const [hub, detail] = await Promise.all([
    readFile(new URL("../src/app/(storefront)/thue-gia-cong/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(storefront)/thue-gia-cong/[family]/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(hub, /export const dynamic = ["']force-dynamic["']/);
  assert.match(detail, /export const dynamic = ["']force-dynamic["']/);
});
