import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { updateAdminLeadStatus, type LeadStatus } from "@/lib/admin-data";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import { canManageLeads } from "@/lib/admin-permissions.ts";
import { readBoundedAdminJson } from "@/lib/admin-request";

export const dynamic = "force-dynamic";

interface LeadRouteContext {
  params: Promise<{ id: string }>;
}

const leadStatuses = new Set<LeadStatus>([
  "new",
  "qualified",
  "contacted",
  "quotation_sent",
  "sampling",
  "negotiation",
  "won",
  "lost",
  "spam",
]);

export async function PATCH(request: Request, context: LeadRouteContext): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageLeads(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được cập nhật lead.");
  }

  const { id } = await context.params;
  if (!isLeadId(id)) return adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy lead.");

  const parsedRequest = await readBoundedAdminJson(request);
  if (!parsedRequest.ok) return adminFailure(parsedRequest.requestId, parsedRequest.status, parsedRequest.code, parsedRequest.message);
  const payload = parsedRequest.body;
  const status = isRecord(payload) && typeof payload.status === "string"
    ? payload.status as LeadStatus
    : null;
  if (!status || !leadStatuses.has(status)) {
    return adminFailure(
      parsedRequest.requestId,
      422,
      "VALIDATION_ERROR",
      "Trạng thái lead không hợp lệ.",
      { status: "Chọn một trạng thái trong pipeline." },
    );
  }

  try {
    const lead = await updateAdminLeadStatus(guard.database, id, status, guard.actorSubject);
    return lead
      ? adminSuccess(parsedRequest.requestId, { lead })
      : adminFailure(parsedRequest.requestId, 404, "NOT_FOUND", "Không tìm thấy lead.");
  } catch (error) {
    return adminErrorFrom(parsedRequest.requestId, error, "Không thể cập nhật trạng thái lead.");
  }
}

function isLeadId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
