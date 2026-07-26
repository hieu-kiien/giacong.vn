import "server-only";

import { getCatalogProduct } from "@/lib/bagisto-catalog";
import type { RequestCartProductResolution } from "@/types/request-cart";

/**
 * Single Bagisto projection shared by the revalidate endpoint and the cart submit.
 * `getCatalogProduct` is request-deduplicated, so one slug costs one upstream read per request.
 */
export async function resolveCartProduct(slug: string): Promise<RequestCartProductResolution | null> {
  const product = await getCatalogProduct(slug);
  if (!product) return null;
  return {
    name: product.name,
    slug: product.slug,
    variants: product.variants.map((variant) => ({
      contactFromQuantity: variant.contactFromQuantity,
      isAvailable: variant.isAvailable,
      label: variant.name,
      minimumOrderQuantity: variant.minimumOrderQuantity,
      quantityStep: variant.quantityStep,
      sku: variant.sku,
      tierPrices: variant.tierPrices.map((tier) => ({ minQuantity: tier.minQuantity, price: tier.price })),
      unit: variant.unit,
    })),
  };
}
