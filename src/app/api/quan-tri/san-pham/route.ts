import { AdminBffError, callAdminApi } from "@/lib/admin-bff";
import { parseProductList } from "@/lib/admin-contract";
import { adminFailure, adminJson, upstreamFailure } from "@/lib/admin-route";

const allowed = new Set(["q", "page", "per_page", "sort", "direction"]);
const sorts = new Set(["name", "id", "starting_price", "variant_count", "available_variant_count"]);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url); if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) return adminFailure(new AdminBffError(422, "validation_failed"));
    const query = new URLSearchParams(); const q = url.searchParams.get("q"); const page = url.searchParams.get("page"); const perPage = url.searchParams.get("per_page"); const sort = url.searchParams.get("sort"); const direction = url.searchParams.get("direction");
    if (q) { if (q.length > 100) return adminFailure(new AdminBffError(422, "validation_failed")); query.set("q", q.trim()); }
    if (page) { if (!/^[1-9]\d*$/.test(page)) return adminFailure(new AdminBffError(422, "validation_failed")); query.set("page", page); }
    if (perPage) { const value = Number(perPage); if (!Number.isInteger(value) || value < 1 || value > 48) return adminFailure(new AdminBffError(422, "validation_failed")); query.set("per_page", perPage); }
    if (sort) { if (!sorts.has(sort)) return adminFailure(new AdminBffError(422, "validation_failed")); query.set("sort", sort); }
    if (direction) { if (direction !== "asc" && direction !== "desc") return adminFailure(new AdminBffError(422, "validation_failed")); query.set("direction", direction); }
    const result = await callAdminApi(request, "products", { query }); return result.status === 200 ? adminJson({ data: parseProductList(result.payload) }, result) : adminFailure(upstreamFailure(result), result);
  } catch (error) { return adminFailure(error); }
}
