import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canPublishNavigation } from "@/lib/admin-permissions.ts";
import { publishAllAdminSiteNavigation } from "@/lib/site-navigation.ts";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canPublishNavigation(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được phát hành điều hướng.");
  }
  try {
    const { published, skipped } = await publishAllAdminSiteNavigation(guard.database, {
      actorSubject: guard.actorSubject,
    });
    return adminSuccess(crypto.randomUUID(), { count: published.length, published, skipped });
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Không thể phát hành điều hướng.");
  }
}
