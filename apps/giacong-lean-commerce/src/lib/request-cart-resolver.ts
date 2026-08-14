import "server-only";

import { getCatalogProduct } from "@/lib/cloudflare-catalog";
import {
  resolveDemoCartProduct,
  toRequestCartProductResolution,
} from "@/lib/request-cart-demo";
import { demoCatalogFallbackAllowed } from "@/lib/demo-catalog-policy";
import { resolveRequestCart } from "@/lib/request-cart";
import type {
  RequestCartLineKey,
  RequestCartProductResolution,
  ResolvedRequestCart,
} from "@/types/request-cart";

/**
 * Canonical server-side catalog projection shared by cart revalidation and submit.
 * Production reads Cloudflare D1 directly; browser prices are never trusted.
 */
export async function resolveCartProduct(slug: string): Promise<RequestCartProductResolution | null> {
  if (demoCatalogFallbackAllowed(process.env)) return resolveDemoCartProduct(slug);

  const product = await getCatalogProduct(slug);
  return product ? toRequestCartProductResolution(product) : null;
}

/**
 * Re-resolves every requested line from the canonical D1 catalog and applies the
 * existing MOQ, quantity-step, availability, tier-price and contact-threshold
 * rules in the server-side cart engine. No Bagisto HTTP hop is involved.
 */
export async function resolveRequestCartFromCatalog(lines: RequestCartLineKey[]): Promise<ResolvedRequestCart> {
  return resolveRequestCart(lines, resolveCartProduct);
}
