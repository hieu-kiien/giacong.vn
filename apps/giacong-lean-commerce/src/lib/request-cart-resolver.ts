import "server-only";

import { getCatalogProductsBySlugs } from "@/lib/cloudflare-catalog";
import {
  resolveDemoCartProduct,
  toRequestCartProductResolution,
} from "@/lib/request-cart-demo";
import { demoCatalogFallbackAllowed } from "@/lib/demo-catalog-policy";
import { resolveRequestCart, resolveRequestCartBatch } from "@/lib/request-cart";
import type {
  RequestCartLineKey,
  RequestCartProductResolution,
  ResolvedRequestCart,
} from "@/types/request-cart";

/**
 * Canonical server-side catalog projection shared by cart revalidation and submit.
 * Production reads Cloudflare D1 directly; browser prices are never trusted.
 */

/**
 * Re-resolves every requested line from the canonical D1 catalog with one batched
 * read for all unique parent slugs, then applies the existing MOQ, quantity-step,
 * availability, tier-price and contact-threshold rules in the server-side cart engine.
 */
export async function resolveRequestCartFromCatalog(lines: RequestCartLineKey[]): Promise<ResolvedRequestCart> {
  if (demoCatalogFallbackAllowed(process.env)) {
    return resolveRequestCart(lines, async (slug) => resolveDemoCartProduct(slug));
  }

  return resolveRequestCartBatch(lines, async (slugs) => {
    const details = await getCatalogProductsBySlugs(slugs);
    const resolutions = new Map<string, RequestCartProductResolution | null>();
    for (const slug of slugs) {
      const detail = details.get(slug);
      resolutions.set(slug, detail ? toRequestCartProductResolution(detail) : null);
    }
    return resolutions;
  });
}
