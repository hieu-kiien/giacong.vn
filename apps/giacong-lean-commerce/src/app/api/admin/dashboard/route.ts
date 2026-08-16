import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
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
    return adminFailure(
      crypto.randomUUID(),
      503,
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Không thể tải tổng quan admin.",
    );
  }
}