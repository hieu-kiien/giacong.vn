import { handleCartRevalidation } from "@/lib/request-cart";
import { resolveRequestCartFromCatalog } from "@/lib/request-cart-resolver";

// Stateless: this route reads Bagisto and returns canonical prices. It never stores a cart.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleCartRevalidation(request, { cartBatchResolver: resolveRequestCartFromCatalog });
}
