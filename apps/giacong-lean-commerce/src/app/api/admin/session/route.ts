import { handleAdminSession } from "@/lib/admin-session";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  return handleAdminSession(guard, crypto.randomUUID());
}
