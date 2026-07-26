import "server-only";

import { getCatalogCategories } from "@/lib/bagisto-catalog";
import type { CatalogCategory } from "@/types/catalog";

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
    return [];
  }
}
