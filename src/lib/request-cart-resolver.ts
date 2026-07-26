import "server-only";

import { getCatalogProduct } from "@/lib/bagisto-catalog";
import {
  demoCartFallbackAllowed,
  resolveDemoCartProduct,
  toRequestCartProductResolution,
} from "@/lib/request-cart-demo";
import type { RequestCartProductResolution } from "@/types/request-cart";

/**
 * Single Bagisto projection shared by the revalidate endpoint and the cart submit.
 * `getCatalogProduct` is request-deduplicated, so one slug costs one upstream read per request.
 * A non-production demo may fall back to the isolated fixture; production always
 * rethrows an upstream failure and never validates a cart against demo prices.
 */
export async function resolveCartProduct(slug: string): Promise<RequestCartProductResolution | null> {
  const demoAllowed = demoCartFallbackAllowed(process.env.NODE_ENV);

  try {
    const product = await getCatalogProduct(slug);
    if (product) return toRequestCartProductResolution(product);
  } catch (error) {
    if (!demoAllowed) throw error;
  }

  return demoAllowed ? resolveDemoCartProduct(slug) : null;
}
