import "server-only";

import { DEMO_CATALOG_CATEGORIES, DEMO_CATALOG_LIST } from "@/data/demo-catalog";
import { demoProductImage } from "@/data/demo-product-images";
import { getCatalogCategories, getCatalogProducts } from "@/lib/bagisto-catalog";
import { DEFAULT_CATALOG_PAGE_SIZE, DEFAULT_CATALOG_SORT, DEFAULT_CATALOG_SORT_DIRECTION } from "@/lib/catalog-query";
import { demoCatalogFallbackAllowed } from "@/lib/demo-catalog-policy";
import type { CatalogCategory, CatalogProductParent } from "@/types/catalog";

/**
 * Categories for header and menu navigation only.
 *
 * Navigation is not the content of any route, so an unavailable or malformed
 * category feed degrades the menu to its "đang được cập nhật" state instead of
 * failing the page around it. That also keeps statically prerendered routes
 * buildable without a live upstream. `/san-pham` still calls
 * `getCatalogCategories` directly and stays strict about its own content.
 *
 * Lives apart from the cloned-chrome module so a clean commerce layout can read
 * navigation without importing anything that touches the cloned cascade.
 */
export async function getCommerceNavCategories(): Promise<CatalogCategory[]> {
  try {
    return await getCatalogCategories();
  } catch {
    return demoCatalogFallbackAllowed(process.env) ? [...DEMO_CATALOG_CATEGORIES] : [];
  }
}

/**
 * Products for the mega-menu's item and featured columns.
 *
 * Uses the catalog's own default filters, so this is the same upstream read
 * `/san-pham` already performs on its first page and shares its cache entry rather
 * than adding a second one. It degrades the same way its sibling does: an
 * unavailable feed leaves the menu's product columns empty instead of failing the
 * route around it.
 */
export async function getCommerceNavProducts(): Promise<CatalogProductParent[]> {
  try {
    const { products } = await getCatalogProducts({
      category: "",
      direction: DEFAULT_CATALOG_SORT_DIRECTION,
      page: 1,
      pageSize: DEFAULT_CATALOG_PAGE_SIZE,
      query: "",
      sort: DEFAULT_CATALOG_SORT,
    });
    return products;
  } catch {
    return demoCatalogFallbackAllowed(process.env)
      ? DEMO_CATALOG_LIST.map((product, index) => ({
          ...product,
          imageUrl: demoProductImage(index),
        }))
      : [];
  }
}
