import { handleContactSubmission } from "@/lib/contact-webhook";
import { createContactRateLimiter } from "@/lib/contact-rate-limit";
import { getCatalogProduct } from "@/lib/bagisto-catalog";
import { resolveRequestCartFromCatalog } from "@/lib/request-cart-resolver";

const rateLimiter = createContactRateLimiter({
  limit: 5,
  windowMs: 10 * 60 * 1_000,
});

export async function POST(request: Request) {
  return handleContactSubmission(request, {
    cartBatchResolver: resolveRequestCartFromCatalog,
    environment: process.env,
    rateLimiter: process.env.NODE_ENV === "production" ? rateLimiter : undefined,
    productResolver: async (slug) => {
      const product = await getCatalogProduct(slug);
      if (!product) return null;
      return {
        name: product.name,
        variants: product.variants.map((variant) => ({
          contactFromQuantity: variant.contactFromQuantity,
          isAvailable: variant.isAvailable,
          label: variant.name,
          minimumOrderQuantity: variant.minimumOrderQuantity,
          quantityStep: variant.quantityStep,
          sku: variant.sku,
        })),
      };
    },
  });
}
