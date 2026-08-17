import type {
  AdminLead,
  D1DatabaseLike,
  D1PreparedStatementLike,
  LeadStatus,
} from "./admin-data.ts";

interface D1BatchResultLike {
  results?: unknown[];
}

interface D1BatchDatabaseLike extends D1DatabaseLike {
  batch(statements: D1PreparedStatementLike[]): Promise<D1BatchResultLike[]>;
}

interface AdminLeadRow {
  id: string;
  status: LeadStatus;
  full_name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  message: string | null;
  source: string;
  delivery_status: AdminLead["deliveryStatus"];
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export class AdminLeadStaleWriteError extends Error {
  constructor() {
    super("Trạng thái lead đã thay đổi. Hãy tải lại trước khi cập nhật.");
    this.name = "AdminLeadStaleWriteError";
  }
}

export class AdminLeadAtomicWriteError extends Error {}

export async function updateAdminLeadStatusAtomically(
  database: D1DatabaseLike,
  leadId: string,
  expectedStatus: LeadStatus,
  nextStatus: LeadStatus,
  actorSubject: string,
): Promise<AdminLead | null> {
  const existing = await readAdminLead(database, leadId);
  if (!existing) return null;
  if (existing.status !== expectedStatus) throw new AdminLeadStaleWriteError();
  if (expectedStatus === nextStatus) return existing;

  const batchDatabase = requireBatch(database);
  const auditId = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  const changeJson = JSON.stringify({ from: expectedStatus, to: nextStatus });

  const statements: D1PreparedStatementLike[] = [
    database.prepare(`
      INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
      SELECT ?, ?, 'lead.status_updated', 'lead', ?, ?
      WHERE EXISTS (
        SELECT 1
        FROM leads
        WHERE id = ? AND status = ?
      )
      RETURNING id
    `).bind(
      auditId,
      actorSubject,
      leadId,
      changeJson,
      leadId,
      expectedStatus,
    ),
    database.prepare(`
      UPDATE leads
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = ?
        AND EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)
    `).bind(
      nextStatus,
      leadId,
      expectedStatus,
      auditId,
    ),
    database.prepare(`
      INSERT INTO lead_events (id, lead_id, actor_subject, event_type, message)
      SELECT ?, ?, ?, 'status_changed', ?
      WHERE EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)
    `).bind(
      eventId,
      leadId,
      actorSubject,
      changeJson,
      auditId,
    ),
  ];

  const results = await batchDatabase.batch(statements);
  const markerRows = results[0]?.results;
  if (!Array.isArray(markerRows) || markerRows.length !== 1) {
    throw new AdminLeadStaleWriteError();
  }

  return readAdminLead(database, leadId);
}

async function readAdminLead(database: D1DatabaseLike, leadId: string): Promise<AdminLead | null> {
  const row = await database.prepare(`
    SELECT id, status, full_name, company_name, email, phone, country, message,
      source, delivery_status, assigned_to, created_at, updated_at
    FROM leads
    WHERE id = ?
    LIMIT 1
  `).bind(leadId).first<AdminLeadRow>();
  return row ? {
    assignedTo: row.assigned_to,
    companyName: row.company_name,
    country: row.country,
    createdAt: row.created_at,
    deliveryStatus: row.delivery_status,
    email: row.email,
    fullName: row.full_name,
    id: row.id,
    message: row.message,
    phone: row.phone,
    source: row.source,
    status: row.status,
    updatedAt: row.updated_at,
  } : null;
}

function requireBatch(database: D1DatabaseLike): D1BatchDatabaseLike {
  const candidate = database as D1DatabaseLike & { batch?: D1BatchDatabaseLike["batch"] };
  if (typeof candidate.batch !== "function") {
    throw new AdminLeadAtomicWriteError("D1 batch() là bắt buộc để cập nhật lead an toàn.");
  }
  return candidate as D1BatchDatabaseLike;
}
