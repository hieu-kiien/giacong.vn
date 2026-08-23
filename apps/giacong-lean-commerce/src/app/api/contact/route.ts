import { getCloudflareContext } from "@opennextjs/cloudflare";

import { handleContactSubmission } from "@/lib/contact-webhook";
import { getAdminDatabase } from "@/lib/admin-data";
import { createLeadPersistence } from "@/lib/lead-data";
import { getCatalogProduct } from "@/lib/cloudflare-catalog";
import { getLeadQueue } from "@/lib/lead-queue";
import { resolveRequestCartFromCatalog } from "@/lib/request-cart-resolver";

interface ContactRateLimitBinding {
  limit(key: string): Promise<{ success: boolean }>;
}

/** Absent outside the Workers runtime (next dev, unit tests): the handler then runs unthrottled. */
function getContactRateLimiter(): ContactRateLimitBinding | undefined {
  try {
    const env = getCloudflareContext().env as { GIACONG_VN_CONTACT_LIMIT?: ContactRateLimitBinding };
    return env.GIACONG_VN_CONTACT_LIMIT;
  } catch {
    return undefined;
  }
}

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
    contactRateLimiter: getContactRateLimiter(),
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
