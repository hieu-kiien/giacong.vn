import assert from "node:assert/strict";
import test from "node:test";

import { buildLiveProductGallery, publicMediaUrl } from "../src/lib/product-gallery.ts";

test("live gallery keeps the canonical product image first and adds R2 media", () => {
  const gallery = buildLiveProductGallery({
    assets: [
      { altText: "Mặt trước bao bì", storageKey: "products/42/front.webp" },
      { altText: null, storageKey: "products/42/back.webp" },
    ],
    productImageUrl: "/media/products/42/hero.webp",
    productName: "Bột gạo lứt",
  });

  assert.deepEqual(gallery, [
    { alt: "Bột gạo lứt", url: "/media/products/42/hero.webp" },
    { alt: "Mặt trước bao bì", url: "/media/products/42/front.webp" },
    { alt: "Bột gạo lứt", url: "/media/products/42/back.webp" },
  ]);
});

test("live gallery never invents demo imagery and safely handles an empty product", () => {
  assert.deepEqual(buildLiveProductGallery({
    assets: [],
    productImageUrl: null,
    productName: "Sản phẩm chưa có ảnh",
  }), []);
});

test("live gallery de-duplicates the same public URL", () => {
  const gallery = buildLiveProductGallery({
    assets: [{ altText: "Ảnh lặp", storageKey: "products/42/hero.webp" }],
    productImageUrl: "/media/products/42/hero.webp",
    productName: "Bột gạo lứt",
  });

  assert.equal(gallery.length, 1);
  assert.equal(gallery[0]?.alt, "Bột gạo lứt");
});

test("media URLs encode individual path segments and reject traversal", () => {
  assert.equal(publicMediaUrl("products/42/ảnh chính.webp"), "/media/products/42/%E1%BA%A3nh%20ch%C3%ADnh.webp");
  assert.equal(publicMediaUrl("products/../secret.webp"), null);
  assert.equal(publicMediaUrl(""), null);
});
