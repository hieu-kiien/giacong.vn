import { CatalogApiError, getCatalogProduct } from "@/lib/bagisto-catalog";
import { BagistoApiTimeoutError } from "@/lib/bagisto-api";

export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8" };

export async function GET(_request: Request, context: RouteContext<"/api/catalog/products/[slug]">) {
  const { slug } = await context.params;
  if (!slug || slug.length > 160) return Response.json({ error: "invalid_product" }, { headers, status: 422 });

  try {
    const product = await getCatalogProduct(slug);
    if (!product) return Response.json({ error: "product_not_found" }, { headers, status: 404 });
    return Response.json({ product }, { headers });
  } catch (error) {
    if (error instanceof BagistoApiTimeoutError) {
      return Response.json({ error: "catalog_unavailable" }, { headers, status: 504 });
    }
    if (error instanceof CatalogApiError) {
      const status = error.status === 404 ? 404 : error.status && error.status >= 400 && error.status < 500 ? 422 : 502;
      return Response.json(
        { error: error.status === 404 ? "product_not_found" : "catalog_unavailable" },
        { headers, status },
      );
    }
    return Response.json({ error: "catalog_unavailable" }, { headers, status: 502 });
  }
}
