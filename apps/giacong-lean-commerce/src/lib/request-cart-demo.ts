import { DEMO_CATALOG_LIST, findDemoCatalogProduct } from "../data/demo-catalog.ts";
import { demoProductImage } from "../data/demo-product-images.ts";
import type { CatalogProductDetail } from "../types/catalog.ts";
import type { RequestCartProductResolution } from "../types/request-cart.ts";

export function toRequestCartProductResolution(
  product: CatalogProductDetail,
  fallbackImageUrl: string | null = null,
): RequestCartProductResolution {
  return {
    imageUrl: product.imageUrl ?? fallbackImageUrl,
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
  const index = DEMO_CATALOG_LIST.findIndex((item) => item.slug === slug);
  return product ? toRequestCartProductResolution(product, demoProductImage(index)) : null;
}
