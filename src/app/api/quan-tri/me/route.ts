import { callAdminApi } from "@/lib/admin-bff";
import { parseAdminIdentity } from "@/lib/admin-contract";
import { adminFailure, adminJson, upstreamFailure } from "@/lib/admin-route";
export async function GET(request: Request) { try { const result = await callAdminApi(request, "me"); return result.status === 200 ? adminJson({ data: parseAdminIdentity(result.payload) }, result) : adminFailure(upstreamFailure(result), result); } catch (error) { return adminFailure(error); } }
