import { getCloudflareContext } from "@opennextjs/cloudflare";

import { handleCartRevalidation } from "@/lib/request-cart";
import { resolveRequestCartFromCatalog } from "@/lib/request-cart-resolver";

// Stateless: this route re-reads canonical Cloudflare D1 catalog data and never stores a cart.
export const dynamic = "force-dynamic";

interface RevalidateRateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** Absent outside the Workers runtime (next dev, unit tests): the handler then runs unthrottled. */
function getRevalidateRateLimiter(): RevalidateRateLimitBinding | undefined {
  try {
    const env = getCloudflareContext().env as { GIACONG_VN_REVALIDATE_LIMIT?: RevalidateRateLimitBinding };
    return env.GIACONG_VN_REVALIDATE_LIMIT;
  } catch {
    return undefined;
  }
}

function rateLimitedResponse(): Response {
  return Response.json(
    { message: "Bạn đang thao tác quá nhanh. Vui lòng thử lại sau ít phút.", ok: false },
    { headers: { "Cache-Control": "no-store", "Retry-After": "60" }, status: 429 },
  );
}

export async function POST(request: Request) {
  const limiter = getRevalidateRateLimiter();
  if (limiter) {
    const key = request.headers.get("cf-connecting-ip")?.trim() || "unknown";
    try {
      const { success } = await limiter.limit({ key });
      if (!success) return rateLimitedResponse();
    } catch (error) {
      console.error("[cart] rate limiter unavailable; failing open", error);
    }
  }

  return handleCartRevalidation(request, { cartBatchResolver: resolveRequestCartFromCatalog });
}
