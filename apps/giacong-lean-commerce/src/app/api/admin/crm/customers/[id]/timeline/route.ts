import { adminFailure, adminSuccess } from "@/lib/admin-api";
import { adminErrorFrom } from "@/lib/admin-error-mapping";
import { requireAdmin } from "@/lib/admin-guard";
import { canManage, canManageCrm } from "@/lib/admin-permissions";
import { readBoundedAdminJson } from "@/lib/admin-request";
import { insertCrmTimelineEventSchema } from "@/lib/admin-crm-types";

export const dynamic = "force-dynamic";

export async function GET(request: Request, props: { params: Promise<{ id: string }> }): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManage(guard.member.role, "crm.read")) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được xem sự kiện timeline.");
  }

  const { id } = await props.params;

  try {
    const events = await guard.database.prepare(
      `SELECT * FROM crm_timeline_events WHERE customer_id = ? ORDER BY created_at DESC`
    ).bind(id).all();

    return adminSuccess(crypto.randomUUID(), { events: events.results });
  } catch (error) {
    return adminErrorFrom(crypto.randomUUID(), error, "Lỗi khi tải dòng thời gian.");
  }
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }): Promise<Response> {
  const guard = await requireAdmin(request);
  if (guard instanceof Response) return guard;
  if (!canManageCrm(guard.member.role)) {
    return adminFailure(crypto.randomUUID(), 403, "FORBIDDEN", "Vai trò hiện tại không được thêm sự kiện timeline.");
  }

  const { id } = await props.params;
  const parsedRequest = await readBoundedAdminJson(request);
  if (!parsedRequest.ok) return adminFailure(parsedRequest.requestId, parsedRequest.status, parsedRequest.code, parsedRequest.message);

  const validation = insertCrmTimelineEventSchema.safeParse(parsedRequest.body);
  if (!validation.success) {
    const errors: Record<string, string> = {};
    for (const err of validation.error.errors) {
      if (err.path.length) errors[err.path.join(".")] = err.message;
    }
    return adminFailure(parsedRequest.requestId, 422, "VALIDATION_ERROR", "Dữ liệu sự kiện chưa hợp lệ.", errors);
  }

  const data = validation.data;
  const eventId = crypto.randomUUID();

  try {
    await guard.database.prepare(
      `INSERT INTO crm_timeline_events (
        id, customer_id, lead_id, quote_id, author_id, author_name, event_type,
        title, content, metadata_json, is_pinned, requires_followup, followup_due_at, followup_completed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      eventId,
      id,
      data.lead_id || null,
      data.quote_id || null,
      guard.member.id,
      guard.member.displayName || "Admin",
      data.event_type || "note_internal",
      data.title || data.summary || "Ghi chú tương tác",
      data.content || data.details || "",
      data.metadata_json || "{}",
      data.is_pinned || 0,
      data.requires_followup || 0,
      data.followup_due_at || null,
      0
    ).run();

    return adminSuccess(parsedRequest.requestId, { id: eventId }, 201);
  } catch (error) {
    return adminErrorFrom(parsedRequest.requestId, error, "Không thể thêm sự kiện vào timeline.");
  }
}
