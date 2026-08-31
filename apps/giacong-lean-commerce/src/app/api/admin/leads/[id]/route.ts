import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { readAdminLead } from "@/lib/admin-data";
import { adminErrorFrom } from "@/lib/admin-error-mapping.ts";
import { requireAdmin } from "@/lib/admin-guard";
import {
  AdminLeadWriteConflictError,
  AdminLeadWriteIdempotencyConflictError,
  AdminLeadWriteValidationError,
  updateAdminLeadStatusAtomically,
} from "@/lib/admin-lead-write.ts";
import { parseAdminLeadStatusCommand } from "@/lib/admin-lead-command.ts";
import { canManageLeads } from "@/lib/admin-permissions.ts";
import { readBoundedAdminJson } from "@/lib/admin-request";

export const dynamic = "force-dynamic";

interface LeadRouteContext {
  params: Promise<{ id: string }>;
}

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
  const parsed = parseAdminLeadStatusCommand(parsedRequest.body);
  if (!parsed.command) {
    return adminFailure(parsedRequest.requestId, 422, "VALIDATION_ERROR", "Dữ liệu trạng thái lead chưa hợp lệ.", parsed.fieldErrors);
  }

  try {
    const updatedLeadId = await updateAdminLeadStatusAtomically(
      guard.database,
      id,
      parsed.command.status,
      parsed.command.revision,
      guard.actorSubject,
      parsed.command.requestId,
    );
    const lead = updatedLeadId ? await readAdminLead(guard.database, updatedLeadId) : null;
    return lead
      ? adminSuccess(parsedRequest.requestId, { lead })
      : adminFailure(parsedRequest.requestId, 404, "NOT_FOUND", "Không tìm thấy lead.");
  } catch (error) {
    if (error instanceof AdminLeadWriteConflictError) return adminFailure(parsedRequest.requestId, 409, "STALE_WRITE", error.message);
    if (error instanceof AdminLeadWriteIdempotencyConflictError) return adminFailure(parsedRequest.requestId, 409, "IDEMPOTENCY_CONFLICT", error.message);
    if (error instanceof AdminLeadWriteValidationError) return adminFailure(parsedRequest.requestId, 422, "VALIDATION_ERROR", error.message);
    return adminErrorFrom(parsedRequest.requestId, error, "Không thể cập nhật trạng thái lead.");
  }
}

function isLeadId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
