import { callAdminApi } from "@/lib/admin-bff";
import { parseDashboard } from "@/lib/admin-contract";
import { adminFailure, adminJson, upstreamFailure } from "@/lib/admin-route";
export async function GET(request: Request) { try { const result = await callAdminApi(request, "dashboard"); return result.status === 200 ? adminJson({ data: parseDashboard(result.payload) }, result) : adminFailure(upstreamFailure(result), result); } catch (error) { return adminFailure(error); } }
