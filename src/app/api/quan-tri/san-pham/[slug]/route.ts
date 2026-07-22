import { callAdminApi } from "@/lib/admin-bff";
import { parseProductDetail } from "@/lib/admin-contract";
import { adminFailure, adminJson, upstreamFailure } from "@/lib/admin-route";
export async function GET(request: Request, context: RouteContext<"/api/quan-tri/san-pham/[slug]">) { try { const { slug } = await context.params; const result = await callAdminApi(request, "product", { slug }); return result.status === 200 ? adminJson({ data: parseProductDetail(result.payload) }, result) : adminFailure(upstreamFailure(result), result); } catch (error) { return adminFailure(error); } }
