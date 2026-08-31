import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  adminMediaMaxBytes,
  adminMediaMaxRequestBytes,
  readBoundedAdminMultipart,
  validateAdminImageBytes,
} from "../src/lib/media-input.ts";

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
  assert.match(route, /readBoundedAdminMultipart/);
  assert.match(route, /validateAdminImageBytes/);
  assert.match(route, /8 MiB/);
  assert.match(route, /rawAltText\.trim\(\)\.length > 300/);
  assert.doesNotMatch(route, /slice\(0, 300\)/);
  assert.doesNotMatch(route, /image\/avif/);
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
  assert.match(siteMediaRoute, /readBoundedAdminMultipart/);
  assert.match(siteMediaRoute, /validateAdminImageBytes/);
  assert.match(siteMediaRoute, /8 MiB/);
  assert.doesNotMatch(siteMediaRoute, /image\/avif/);
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

test("media reference guard includes active variant main-image references", async () => {
  const data = await readFile(new URL("../src/lib/media-data.ts", import.meta.url), "utf8");
  assert.match(
    data,
    /SELECT 'variant' AS kind, id, name FROM product_variants WHERE image_url = \?/,
    "deleteMediaAsset must resolve live product_variants image references before deleting",
  );
});

test("media upload validates declared type, size, and magic bytes", () => {
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]).buffer;
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer;
  const webp = Uint8Array.from([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]).buffer;
  const fakeJpeg = Uint8Array.from([0x7b, 0x22, 0x6e, 0x6f, 0x74, 0x22, 0x3a, 0x22, 0x6a, 0x70, 0x67, 0x22, 0x7d]).buffer;

  assert.equal(validateAdminImageBytes("image/jpeg", jpeg), null);
  assert.equal(validateAdminImageBytes("image/png", png), null);
  assert.equal(validateAdminImageBytes("image/webp", webp), null);
  assert.match(validateAdminImageBytes("image/jpeg", fakeJpeg) ?? "", /khớp|định dạng/i);
  assert.match(validateAdminImageBytes("image/avif", jpeg) ?? "", /JPEG|PNG|WebP/i);
  assert.match(validateAdminImageBytes("image/jpeg", new ArrayBuffer(adminMediaMaxBytes + 1)) ?? "", /8 MiB/i);
  assert.equal(adminMediaMaxRequestBytes, adminMediaMaxBytes + 64 * 1024);
});

test("multipart parsing is bounded before FormData work", async () => {
  const formData = new FormData();
  formData.set("file", new File([Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])], "cover.jpg", { type: "image/jpeg" }));
  const request = new Request("https://admin-staging.kienhieu.id.vn/api/admin/media", { method: "POST", body: formData });
  const parsed = await readBoundedAdminMultipart(request);
  if (!parsed.ok) throw new Error(`valid multipart rejected: ${parsed.reason}`);
  assert.equal(parsed.form.get("file") instanceof File, true);

  const oversized = new Request("https://admin-staging.kienhieu.id.vn/api/admin/media", {
    body: new Uint8Array(adminMediaMaxRequestBytes + 1),
    method: "POST",
  });
  const rejected = await readBoundedAdminMultipart(oversized);
  assert.deepEqual(rejected, { ok: false, reason: "too_large" });
});
