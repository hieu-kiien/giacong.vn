import { CatalogDataError, getCatalogProduct } from "@/lib/cloudflare-catalog";

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
    if (error instanceof CatalogDataError) {
      return Response.json({ error: "catalog_unavailable" }, { headers, status: 503 });
    }
    return Response.json({ error: "catalog_unavailable" }, { headers, status: 503 });
  }
}
