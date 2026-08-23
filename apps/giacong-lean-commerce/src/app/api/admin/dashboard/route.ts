import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { getAdminOverview } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;

  try {
    const data = await getAdminOverview(guard.database);
    return adminSuccess(crypto.randomUUID(), {
      ...data,
      member: guard.member,
    });
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể tải tổng quan admin.");
  }
}