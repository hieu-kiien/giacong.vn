import { revalidateTag } from "next/cache";
import { AdminBffError, callAdminApi, MAX_COMMERCIAL_RULES_BYTES, parseExactJson, requireSameOrigin } from "@/lib/admin-bff";
import { AdminContractError, parseCommercialRulesSnapshot, parseProductDetail } from "@/lib/admin-contract";
import { adminFailure, adminJson, adminMutationFailure, upstreamFailure } from "@/lib/admin-route";
import { CATALOG_PRODUCTS_CACHE_TAG } from "@/lib/bagisto-catalog";

export async function GET(request: Request, context: RouteContext<"/api/quan-tri/san-pham/[slug]">) {
  try {
    const { slug } = await context.params;
    const result = await callAdminApi(request, "product", { slug });
    if (result.status !== 200) return adminFailure(upstreamFailure(result), result);
    if (!result.etag) return adminFailure(new Error("Missing product ETag."), result);
    return adminJson({ data: parseProductDetail(result.payload, result.etag) }, result);
  } catch (error) {
    return adminFailure(error);
  }
}

export async function PUT(request: Request, context: RouteContext<"/api/quan-tri/san-pham/[slug]">) {
  try {
    requireSameOrigin(request);
    let input;
    try {
      input = parseCommercialRulesSnapshot(await parseExactJson(
        request,
        ["version", "published", "variants"],
        MAX_COMMERCIAL_RULES_BYTES,
      ));
    } catch (error) {
      if (error instanceof AdminContractError) throw new AdminBffError(422, "validation_failed");
      throw error;
    }
    const { slug } = await context.params;
    const result = await callAdminApi(request, "commercial-rules", {
      slug,
      ifMatch: input.version,
      body: { published: input.published, variants: input.variants },
    });
    if (result.status !== 200) return adminMutationFailure(result);
    if (!result.etag) return adminFailure(new Error("Missing product ETag."), result);
    const product = parseProductDetail(result.payload, result.etag);
    revalidateTag(CATALOG_PRODUCTS_CACHE_TAG, { expire: 0 });
    return adminJson({ data: product }, result);
  } catch (error) {
    return adminFailure(error);
  }
}
