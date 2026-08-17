import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { canPublishSiteContent } from "@/lib/admin-permissions";
import { requireAdmin } from "@/lib/admin-guard";
import { publishAllAdminSiteSettingsAtomic } from "@/lib/site-settings-write";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canPublishSiteContent(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được phát hành nội dung.");
  }
  try {
    const { published, skipped } = await publishAllAdminSiteSettingsAtomic(guard.database, {
      actorSubject: guard.actorSubject,
    });
    return adminSuccess(crypto.randomUUID(), { published, skipped, count: published.length });
  } catch (error) {
    return adminFailure(
      crypto.randomUUID(),
      503,
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Không thể phát hành tất cả cài đặt website.",
    );
  }
}
