import assert from "node:assert/strict";
import test from "node:test";

import { findDemoCatalogProduct } from "../src/data/demo-catalog.ts";
import {
  buildProductMetadata,
  buildProductStructuredData,
  serializeJsonLd,
} from "../src/lib/product-seo.ts";

function product() {
  const result = findDemoCatalogProduct("bot-gao-lut-xay-min");
  assert.ok(result);
  return result;
}

test("product metadata publishes social text without inventing an origin for relative media", () => {
  const item = product();
  const metadata = buildProductMetadata({
    gallery: [{ alt: item.name, url: "/media/products/1/photo.webp" }],
    product: item,
  });

  assert.equal(metadata.title, `${item.name} | Giacong.vn`);
  assert.equal(metadata.description, item.shortDescription);
  assert.equal(metadata.openGraph?.title, `${item.name} | Giacong.vn`);
  assert.deepEqual(metadata.openGraph?.images, undefined);
  assert.equal(metadata.twitter?.card, "summary");
});

test("product metadata uses a real absolute HTTPS image when the catalog owns one", () => {
  const item = { ...product(), imageUrl: "https://cdn.example.test/products/bot-gao-lut.webp" };
  const metadata = buildProductMetadata({ product: item });

  const images = metadata.openGraph?.images;
  assert.ok(Array.isArray(images));
  assert.equal(images[0]?.url.toString(), item.imageUrl);
  assert.equal(metadata.twitter?.card, "summary_large_image");
});

test("Product JSON-LD contains only canonical product facts", () => {
  const item = product();
  const schema = buildProductStructuredData({ product: item });

  assert.equal(schema["@context"], "https://schema.org");
  assert.equal(schema["@type"], "Product");
  assert.equal(schema.name, item.name);
  assert.equal(schema.sku, item.sku);
  assert.equal(schema.category, item.category?.name);
  assert.equal("offers" in schema, false);
  assert.equal("aggregateRating" in schema, false);
});

test("JSON-LD serialization cannot close its script element", () => {
  const serialized = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
  assert.equal(serialized.includes("</script>"), false);
  assert.match(serialized, /\\u003c\/script>/);
});
