import { handleContactSubmission } from "@/lib/contact-webhook";
import { getCatalogProduct } from "@/lib/bagisto-catalog";
import { resolveRequestCartFromCatalog } from "@/lib/request-cart-resolver";

export async function POST(request: Request) {
  return handleContactSubmission(request, {
    cartBatchResolver: resolveRequestCartFromCatalog,
    environment: process.env,
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
