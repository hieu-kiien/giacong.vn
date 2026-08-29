import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import {
  AdminAuditValidationError,
  listAdminAudit,
  parseAdminAuditQuery,
} from "@/lib/admin-audit.ts";
import { requireAdmin } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (guard.member.role !== "owner") {
    return adminFailure(requestId, 403, "FORBIDDEN", "Chỉ chủ sở hữu được xem lịch sử thay đổi.");
  }

  const query = parseAdminAuditQuery(new URL(request.url).searchParams);
  if (!query) return adminFailure(requestId, 400, "INVALID_REQUEST", "Bộ lọc lịch sử thay đổi không hợp lệ.");

  try {
    return adminSuccess(requestId, await listAdminAudit(guard.database, query));
  } catch (error) {
    if (error instanceof AdminAuditValidationError) {
      return adminFailure(requestId, 400, "INVALID_REQUEST", error.message);
    }
    return adminErrorFrom(requestId, error, "Không thể tải lịch sử thay đổi.");
  }
}
