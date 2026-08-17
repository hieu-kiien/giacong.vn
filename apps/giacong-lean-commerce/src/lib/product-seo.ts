import type { Metadata } from "next";

import type { ProductGalleryImage } from "@/lib/product-gallery";
import type { CatalogProductDetail } from "@/types/catalog";

interface ProductSeoInput {
  gallery?: readonly ProductGalleryImage[];
  product: CatalogProductDetail;
}

/**
 * Product metadata that is safe before the final production origin is locked.
 * Relative R2 URLs are intentionally excluded from social metadata until the app
 * has a canonical `metadataBase`; publishing a localhost/temporary origin would be
 * worse than omitting the image.
 */
export function buildProductMetadata({ gallery = [], product }: ProductSeoInput): Metadata {
  const title = `${product.name} | Giacong.vn`;
  const description = product.shortDescription.trim() || product.name;
  const image = firstAbsoluteHttpsImage(gallery, product.imageUrl);

  return {
    title,
    description,
    openGraph: {
      type: "website",
      title,
      description,
      ...(image ? { images: [{ url: image, alt: product.name }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

/**
 * Conservative Product schema: only facts the canonical catalog owns. Lean V1
 * does not publish ratings, reviews, shipping promises, or a single checkout offer,
 * so none are fabricated for rich-result eligibility.
 */
export function buildProductStructuredData({ gallery = [], product }: ProductSeoInput) {
  const images = uniqueAbsoluteHttpsImages(gallery, product.imageUrl);
  const description = product.description.trim() || product.shortDescription.trim() || product.name;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description,
    sku: product.sku,
    ...(product.category?.name ? { category: product.category.name } : {}),
    ...(images.length ? { image: images } : {}),
  } as const;
}

/** Prevent a product/content string from closing the JSON-LD script element. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function firstAbsoluteHttpsImage(
  gallery: readonly ProductGalleryImage[],
  productImageUrl: string | null,
): string | null {
  return uniqueAbsoluteHttpsImages(gallery, productImageUrl)[0] ?? null;
}

function uniqueAbsoluteHttpsImages(
  gallery: readonly ProductGalleryImage[],
  productImageUrl: string | null,
): string[] {
  const candidates = [
    ...gallery.map((image) => image.url),
    ...(productImageUrl ? [productImageUrl] : []),
  ];
  const unique = new Set<string>();
  for (const candidate of candidates) {
    const normalized = absoluteHttpsUrl(candidate);
    if (normalized) unique.add(normalized);
  }
  return [...unique];
}

function absoluteHttpsUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
