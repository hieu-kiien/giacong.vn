import "server-only";

import { cache } from "react";

import {
  DEMO_CATALOG_PRODUCTS,
  demoCatalogProductsByCategory,
  findDemoCatalogProduct,
} from "@/data/demo-catalog";
import { getCatalogProduct, getCatalogProducts } from "@/lib/bagisto-catalog";
import { demoCatalogFallbackAllowed, demoCatalogForced, waitForDemoCatalogFallback } from "@/lib/demo-catalog-policy";
import type { CatalogProductDetail, CatalogProductParent } from "@/types/catalog";

/** How many related products the detail rail asks for. */
const RELATED_LIMIT = 4;

export interface CatalogDetailSourceResult {
  /**
   * `true` when the page is rendered from the demo fixture rather than from
   * Bagisto. The UI surfaces this, so demo content is never read as production
   * content.
   */
  isDemo: boolean;
  product: CatalogProductDetail;
  related: readonly CatalogProductParent[];
}

/**
 * Reads one product for the detail page.
 *
 * Bagisto first, always. When it is unreachable or has no such product, a
 * non-production environment falls back to the demo fixture so the commerce UI can
 * be built and reviewed before the real feed is approved; production does not, so
 * an upstream failure stays a failure and an unknown slug stays a 404.
 *
 * Returns `null` for "no such product", which the route turns into `notFound()`.
 */
export const loadCatalogProductDetail = cache(async (slug: string): Promise<CatalogDetailSourceResult | null> => {
  const demoAllowed = demoCatalogFallbackAllowed(process.env);
  if (demoCatalogForced(process.env)) return readDemoProduct(slug);

  try {
    const product = await waitForDemoCatalogFallback(getCatalogProduct(slug), process.env);
    if (product) {
      return { isDemo: false, product, related: await readLiveRelated(product) };
    }
  } catch (error) {
    // Outside production a missing Bagisto must not block UI work; in production
    // the error belongs to the route's error boundary, not to a silent 404.
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

/**
 * Related products from the same category. A failure here is not worth failing the
 * page for: the rail is supporting content, so it degrades to empty.
 */
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
