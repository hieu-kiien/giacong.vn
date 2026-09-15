import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("public SEO contract declares canonical metadata and a generated sitemap", async () => {
  const [seo, sitemap, robots, rootLayout, notFound] = await Promise.all([
    read("src/lib/seo.ts"),
    read("src/app/sitemap.ts"),
    read("src/app/robots.txt/route.ts"),
    read("src/app/layout.tsx"),
    read("src/app/not-found.tsx"),
  ]);
  assert.match(seo, /PUBLIC_SITE_ORIGIN = "https:\/\/kienhieu\.id\.vn"/);
  assert.match(seo, /alternates: \{ canonical:/);
  assert.match(sitemap, /getPublishedNews/);
  assert.match(sitemap, /getCatalogProducts/);
  assert.match(sitemap, /getManagedServiceFamilies/);
  assert.match(sitemap, /getServiceContentIndex/);
  assert.match(robots, /Disallow: \/\\n/);
  assert.match(robots, /Sitemap: \$\{PUBLIC_SITE_ORIGIN\}\/sitemap\.xml/);
  assert.match(rootLayout, /canonicalMetadata\("\/"\)/);
  assert.match(notFound, /Xem sản phẩm/);
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
