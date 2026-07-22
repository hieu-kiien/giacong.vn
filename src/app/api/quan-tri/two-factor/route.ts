import { callAdminApi, parseExactJson, requireSameOrigin, safeText } from "@/lib/admin-bff";
import { adminFailure, adminJson, upstreamFailure } from "@/lib/admin-route";

export async function POST(request: Request) { try { requireSameOrigin(request); const input = await parseExactJson(request, ["code"]); const code = safeText(input.code, 6); if (!/^\d{6}$/.test(code)) return adminFailure(new Error()); const result = await callAdminApi(request, "two-factor", { body: { code } }); if (result.status !== 200) return adminFailure(upstreamFailure(result), result); return adminJson({ data: { two_factor_verified: true } }, result); } catch (error) { return adminFailure(error); } }
