import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("public SEO contract declares canonical metadata and a generated sitemap", async () => {
  const [seo, sitemap, robots, rootLayout, notFound, capturedRoute] = await Promise.all([
    read("src/lib/seo.ts"),
    read("src/app/sitemap.ts"),
    read("src/app/robots.txt/route.ts"),
    read("src/app/layout.tsx"),
    read("src/app/not-found.tsx"),
    read("src/app/(storefront)/[...slug]/page.tsx"),
  ]);
  assert.match(seo, /PUBLIC_SITE_ORIGIN = "https:\/\/kienhieu\.id\.vn"/);
  assert.match(seo, /alternates: \{ canonical:/);
  assert.match(sitemap, /getPublishedNews/);
  assert.match(sitemap, /getCatalogProducts/);
  assert.match(sitemap, /getManagedServiceFamilies/);
  assert.match(sitemap, /getServiceContentIndex/);
  assert.match(robots, /Disallow: \/\\n/);
  assert.match(robots, /Sitemap: \$\{PUBLIC_SITE_ORIGIN\}\/sitemap\.xml/);
  assert.match(rootLayout, /title: settings\.site_title \|\| defaultMetadata\.title/);
  assert.match(rootLayout, /description: settings\.site_description \|\| defaultMetadata\.description/);
  assert.doesNotMatch(rootLayout, /canonicalMetadata\("\/"\)/);
  assert.match(notFound, /generateMetadata/);
  assert.match(notFound, /title: `Không tìm thấy trang \| \$\{settings\.brand_name\}`/);
  assert.match(notFound, /<p[^>]*>\{settings\.brand_name\}<\/p>/);
  assert.match(notFound, /noIndexMetadata/);
  assert.match(notFound, /Xem sản phẩm/);
  assert.match(capturedRoute, /Không tìm thấy trang \| \$\{settings\.brand_name\}/);
  assert.match(capturedRoute, /noIndexMetadata/);
  assert.match(capturedRoute, /replaceLegacyBrandInText/);
});

test("non-public hosts are marked noindex at the Worker boundary", async () => {
  const [worker, adminLayout, cartPage] = await Promise.all([
    read("custom-worker.ts"),
    read("src/app/admin/layout.tsx"),
    read("src/app/(storefront)/gui-yeu-cau/page.tsx"),
  ]);
  assert.match(worker, /admin-staging\.kienhieu\.id\.vn/);
  assert.match(worker, /X-Robots-Tag/);
  assert.match(adminLayout, /index: false/);
  assert.match(cartPage, /noIndexMetadata/);
});

test("policy URLs resolve through an explicit owner-confirmation page and stay out of sitemap while draft", async () => {
  const policyRoutes = [
    "chinh-sach-bao-mat",
    "dieu-khoan-su-dung",
    "chinh-sach-thanh-toan",
    "chinh-sach-van-chuyen",
    "chinh-sach-doi-tra",
    "quy-trinh-mua-hang",
  ];
  const [shared, sitemap, ...routes] = await Promise.all([
    read("src/components/site/PolicyPage.tsx"),
    read("src/app/sitemap.ts"),
    ...policyRoutes.map((route) => read(`src/app/(storefront)/${route}/page.tsx`)),
  ]);
  assert.match(shared, /noIndexMetadata/);
  assert.match(shared, /chưa được chủ website duyệt/);
  for (const route of policyRoutes) assert.match(routes[policyRoutes.indexOf(route)], /PolicyPage/);
  for (const route of policyRoutes) assert.match(sitemap, new RegExp(`/${route}/`));
});
