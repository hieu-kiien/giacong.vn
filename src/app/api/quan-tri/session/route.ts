import { callAdminApi, parseExactJson, requireSameOrigin, safePassword, safeText } from "@/lib/admin-bff";
import { parseLogin } from "@/lib/admin-contract";
import { adminFailure, adminJson, adminNoContent, upstreamFailure } from "@/lib/admin-route";

export async function POST(request: Request) {
  try { requireSameOrigin(request); const input = await parseExactJson(request, ["email", "password"]); const result = await callAdminApi(request, "session", { body: { email: safeText(input.email), password: safePassword(input.password), }, bootstrap: true }); if (result.status !== 200 && result.status !== 202) return adminFailure(upstreamFailure(result), result); return adminJson({ data: parseLogin(result.payload, result.status) }, result); }
  catch (error) { return adminFailure(error); }
}
export async function DELETE(request: Request) { try { requireSameOrigin(request); const result = await callAdminApi(request, "logout"); return result.status === 204 ? adminNoContent(result) : adminFailure(upstreamFailure(result), result); } catch (error) { return adminFailure(error); } }
