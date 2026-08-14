import "server-only";

import { DEMO_CATALOG_CATEGORIES, DEMO_CATALOG_LIST } from "@/data/demo-catalog";
import { demoProductImage } from "@/data/demo-product-images";
import { getCatalogCategories, getCatalogProducts } from "@/lib/cloudflare-catalog";
import { DEFAULT_CATALOG_PAGE_SIZE, DEFAULT_CATALOG_SORT, DEFAULT_CATALOG_SORT_DIRECTION } from "@/lib/catalog-query";
import { demoCatalogFallbackAllowed } from "@/lib/demo-catalog-policy";
import type { CatalogCategory, CatalogProductParent } from "@/types/catalog";

/** Navigation is supporting content, so a missing D1 binding can degrade safely. */
export async function getCommerceNavCategories(): Promise<CatalogCategory[]> {
  try {
    return await getCatalogCategories();
  } catch {
    return demoCatalogFallbackAllowed(process.env) ? [...DEMO_CATALOG_CATEGORIES] : [];
  }
}

/** Uses the same canonical D1 catalog projection as `/san-pham`. */
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
