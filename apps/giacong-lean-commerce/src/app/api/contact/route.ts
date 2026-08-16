import { handleContactSubmission } from "@/lib/contact-webhook";
import { getAdminDatabase } from "@/lib/admin-data";
import { createLeadPersistence } from "@/lib/lead-data";
import { getCatalogProduct } from "@/lib/bagisto-catalog";
import { getLeadQueue } from "@/lib/lead-queue";
import { resolveRequestCartFromCatalog } from "@/lib/request-cart-resolver";

export async function POST(request: Request) {
  let leadPersistence;
  try {
    leadPersistence = createLeadPersistence(getAdminDatabase());
  } catch {
    return Response.json(
      { message: "Dịch vụ tiếp nhận yêu cầu chưa sẵn sàng.", ok: false },
      { headers: { "Cache-Control": "no-store" }, status: 503 },
    );
  }

  return handleContactSubmission(request, {
    cartBatchResolver: resolveRequestCartFromCatalog,
    environment: process.env,
    leadQueue: getLeadQueue(),
    leadPersistence,
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
