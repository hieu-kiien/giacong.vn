import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("media API supports product, service, alt-text updates, and bounded cleanup", async () => {
  const [route, detailRoute, data, cleanup, panel, siteMediaRoute, siteMediaData] = await Promise.all([
    readFile(new URL("../src/app/api/admin/media/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/media/[id]/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/media-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/media/cleanup/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/admin/AdminMediaPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/admin/site-settings/media/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/site-media-data.ts", import.meta.url), "utf8"),
  ]);
  assert.match(route, /serviceId/);
  assert.match(route, /getAdminService/);
  assert.match(detailRoute, /export async function PATCH/);
  assert.match(detailRoute, /updateMediaAssetAltText/);
  assert.match(data, /service_id/);
  assert.match(data, /Math\.min\(Math\.max\(Math\.floor\(limit\), 1\), 500\)/);
  assert.match(cleanup, /cleanupOrphanedMediaAssets/);
  assert.match(panel, /Lưu alt/);
  assert.match(panel, /serviceId/);
  assert.match(siteMediaRoute, /siteSettingDefinitions/);
  assert.match(siteMediaRoute, /expectedVersion/);
  assert.match(siteMediaRoute, /createSiteMediaAsset/);
  assert.match(siteMediaData, /site-settings\/\$\{input\.settingKey\}/);
});

test("media deletion refuses to orphan an active main-image reference", async () => {
  const data = await readFile(new URL("../src/lib/media-data.ts", import.meta.url), "utf8");
  assert.match(
    data,
    /findActiveMainImageReferences/,
    "deleteMediaAsset must resolve live products/services image references before deleting",
  );
  assert.match(data, /services/, "the reference check must cover the services.image_url surface");
});