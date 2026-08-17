import { adminFailure, adminSuccess } from "@/lib/admin-api.ts";
import { type LeadStatus } from "@/lib/admin-data";
import { requireAdmin } from "@/lib/admin-guard";
import {
  AdminLeadStaleWriteError,
  updateAdminLeadStatusAtomically,
} from "@/lib/admin-lead-write";

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

  const payload = await readJson(request);
  const status = readLeadStatus(payload, "status");
  const expectedStatus = readLeadStatus(payload, "expectedStatus");
  if (!status || !expectedStatus) {
    return adminFailure(
      crypto.randomUUID(),
      422,
      "VALIDATION_ERROR",
      "Trạng thái lead hoặc trạng thái hiện tại không hợp lệ.",
      {
        expectedStatus: "Gửi trạng thái lead mà giao diện đã đọc trước khi cập nhật.",
        status: "Chọn một trạng thái trong pipeline.",
      },
    );
  }

  try {
    const lead = await updateAdminLeadStatusAtomically(
      guard.database,
      id,
      expectedStatus,
      status,
      guard.actorSubject,
    );
    return lead
      ? adminSuccess(crypto.randomUUID(), { lead })
      : adminFailure(crypto.randomUUID(), 404, "NOT_FOUND", "Không tìm thấy lead.");
  } catch (error) {
    const stale = error instanceof AdminLeadStaleWriteError;
    return adminFailure(
      crypto.randomUUID(),
      stale ? 409 : 503,
      stale ? "STALE_WRITE" : "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Không thể cập nhật trạng thái lead.",
    );
  }
}

function canManageLeads(role: string): boolean {
  return role === "owner" || role === "sales_manager";
}

function isLeadId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function readLeadStatus(value: unknown, key: string): LeadStatus | null {
  if (!isRecord(value)) return null;
  const candidate = value[key];
  return typeof candidate === "string" && leadStatuses.has(candidate as LeadStatus)
    ? candidate as LeadStatus
    : null;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
