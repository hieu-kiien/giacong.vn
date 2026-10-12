import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { isStagingPreviewHost } from "../src/lib/storefront-preview.ts";

test("staging preview hostname matching is exact and ignores ports and case", () => {
  assert.equal(isStagingPreviewHost("staging.kienhieu.id.vn"), true);
  assert.equal(isStagingPreviewHost("STAGING.KIENHIEU.ID.VN:443"), true);
  assert.equal(isStagingPreviewHost("staging.kienhieu.id.vn.attacker.test"), false);
  assert.equal(isStagingPreviewHost("admin-staging.kienhieu.id.vn"), false);
  assert.equal(isStagingPreviewHost("kienhieu.id.vn"), false);
  assert.equal(isStagingPreviewHost(null), false);
});

test("product listing and detail visibly disclose staging demo content", async () => {
  const [listing, detail, listingRoute, detailRoute, notice] = await Promise.all([
    readFile(new URL("../src/components/catalog/CatalogList.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/catalog/ProductDetailPage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(storefront)/san-pham/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(storefront)/san-pham/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/catalog/StagingPreviewNotice.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(listing, /isStagingPreview/);
  assert.match(detail, /isStagingPreview/);
  assert.match(listingRoute, /isStagingPreview=\{isStagingPreview\}/);
  assert.match(detailRoute, /isStagingPreview=\{isStagingPreviewHost\(requestHeaders\.get\("host"\)\)\}/);
  assert.match(notice, /data-staging-preview-notice/);
  assert.match(notice, /số lượng tối thiểu, thời gian và thông số trên staging là dữ liệu demo/);
  assert.match(detailRoute, /isStagingPreviewHost\(/);
});

test("service index and detail visibly disclose demo operating conditions on staging", async () => {
  const [indexRoute, detailRoute, index, detail] = await Promise.all([
    readFile(new URL("../src/app/(storefront)/thue-gia-cong/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/(storefront)/thue-gia-cong/[family]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/services/ServiceLanding.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/services/ServiceFamilyDetail.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(indexRoute, /isStagingPreviewHost/);
  assert.match(detailRoute, /isStagingPreviewHost/);
  assert.match(index, /isStagingPreview/);
  assert.match(detail, /isStagingPreview/);
});
