import { findDemoCatalogProduct } from "../data/demo-catalog.ts";
import type { CatalogProductDetail } from "../types/catalog.ts";
import type { RequestCartProductResolution } from "../types/request-cart.ts";

export function toRequestCartProductResolution(
  product: CatalogProductDetail,
): RequestCartProductResolution {
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
      tierPrices: variant.tierPrices.map((tier) => ({
        minQuantity: tier.minQuantity,
        price: tier.price,
      })),
      unit: variant.unit,
    })),
  };
}

export function resolveDemoCartProduct(slug: string): RequestCartProductResolution | null {
  const product = findDemoCatalogProduct(slug);
  return product ? toRequestCartProductResolution(product) : null;
}
