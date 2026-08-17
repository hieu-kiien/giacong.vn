import "server-only";

import { cache } from "react";

import {
  DEMO_CATALOG_PRODUCTS,
  demoCatalogProductsByCategory,
  findDemoCatalogProduct,
} from "@/data/demo-catalog";
import { getCatalogProduct, getCatalogProducts } from "@/lib/cloudflare-catalog";
import { getCatalogProductGallery } from "@/lib/catalog-product-media";
import { demoCatalogFallbackAllowed, demoCatalogForced, waitForDemoCatalogFallback } from "@/lib/demo-catalog-policy";
import { buildLiveProductGallery, type ProductGalleryImage } from "@/lib/product-gallery";
import type { CatalogProductDetail, CatalogProductParent } from "@/types/catalog";

/** How many related products the detail rail asks for. */
const RELATED_LIMIT = 4;

export interface CatalogDetailSourceResult {
  /** true only when a non-production demo fixture is used. */
  isDemo: boolean;
  /** Live product media. Undefined only for the isolated demo fixture. */
  gallery?: readonly ProductGalleryImage[];
  product: CatalogProductDetail;
  related: readonly CatalogProductParent[];
}

/**
 * Reads one product from Cloudflare D1. A non-production environment may use the
 * isolated fixture when explicitly allowed; production keeps D1 failures visible.
 */
export const loadCatalogProductDetail = cache(async (slug: string): Promise<CatalogDetailSourceResult | null> => {
  const demoAllowed = demoCatalogFallbackAllowed(process.env);
  if (demoCatalogForced(process.env)) return readDemoProduct(slug);

  try {
    const product = await waitForDemoCatalogFallback(getCatalogProduct(slug), process.env);
    if (product) {
      const [related, gallery] = await Promise.all([
        readLiveRelated(product),
        readLiveGallery(product),
      ]);
      return { gallery, isDemo: false, product, related };
    }
  } catch (error) {
    if (!demoAllowed) throw error;
  }

  if (!demoAllowed) return null;
  return readDemoProduct(slug);
});

function readDemoProduct(slug: string): CatalogDetailSourceResult | null {
  const demoProduct = findDemoCatalogProduct(slug);
  if (!demoProduct) return null;
  return { isDemo: true, product: demoProduct, related: readDemoRelated(demoProduct) };
}

async function readLiveGallery(product: CatalogProductDetail): Promise<readonly ProductGalleryImage[]> {
  try {
    return await getCatalogProductGallery(product);
  } catch {
    // Media metadata must not take an otherwise valid product page down. Preserve
    // the canonical product image if present and render the normal empty state if not.
    return buildLiveProductGallery({
      assets: [],
      productImageUrl: product.imageUrl,
      productName: product.name,
    });
  }
}

async function readLiveRelated(product: CatalogProductDetail): Promise<readonly CatalogProductParent[]> {
  if (!product.category) return [];
  try {
    const result = await getCatalogProducts({
      category: product.category.slug,
      direction: "asc",
      page: 1,
      pageSize: 12,
      query: "",
      sort: "name",
    });
    return result.products.filter((item) => item.slug !== product.slug).slice(0, RELATED_LIMIT);
  } catch {
    return [];
  }
}

function readDemoRelated(product: CatalogProductDetail): readonly CatalogProductParent[] {
  const sameCategory = product.category
    ? demoCatalogProductsByCategory(product.category.slug)
    : [];
  const pool = sameCategory.length > 1 ? sameCategory : DEMO_CATALOG_PRODUCTS;
  return pool.filter((item) => item.slug !== product.slug).slice(0, RELATED_LIMIT);
}
