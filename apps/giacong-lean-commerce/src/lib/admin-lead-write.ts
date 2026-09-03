import type { AdminLead, D1DatabaseLike, D1PreparedStatementLike, LeadStatus } from "./admin-data.ts";
import { tableExists } from "./admin-data.ts";
import { isAdminRequestId } from "./admin-request.ts";

export class AdminLeadWriteConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminLeadWriteConflictError";
  }
}

export class AdminLeadWriteIdempotencyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminLeadWriteIdempotencyConflictError";
  }
}

export class AdminLeadWriteStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminLeadWriteStorageError";
  }
}

export class AdminLeadWriteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminLeadWriteValidationError";
  }
}

interface LeadMutationRow {
  actor_subject: string;
  action: "update";
  entity_key: string;
  entity_type: "lead";
  previous_revision: number;
  previous_status: LeadStatus;
  payload_sha256: string;
  request_id: string;
  resulting_revision: number;
  status: LeadStatus;
}

interface LeadRevisionRow {
  id: string;
  revision: number;
  status: LeadStatus;
}

interface D1BatchResultLike {
  meta?: { changes?: unknown };
  results?: unknown[];
}

interface D1DatabaseWithBatch extends D1DatabaseLike {
  batch(statements: D1PreparedStatementLike[]): Promise<D1BatchResultLike[]>;
}

interface LeadMutationPostcondition {
  actorSubject: string;
  expectedRevision: number;
  fromStatus: LeadStatus;
  leadId: string;
  payloadSha256: string;
  requestId: string;
  toStatus: LeadStatus;
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

export async function updateAdminLeadStatusAtomically(
  database: D1DatabaseLike,
  leadId: string,
  status: LeadStatus,
  expectedRevisionRaw: unknown,
  actorSubject: string,
  requestId: string,
): Promise<string | null> {
  const normalizedLeadId = normalizeLeadId(leadId);
  const normalizedStatus = normalizeStatus(status);
  const expectedRevision = requireRevision(expectedRevisionRaw);
  const normalizedActor = normalizeActor(actorSubject);
  const normalizedRequestId = normalizeRequestId(requestId);
  const payloadSha256 = await fingerprint({
    actorSubject: normalizedActor,
    entityType: "lead",
    expectedRevision,
    id: normalizedLeadId,
    operation: "update",
    status: normalizedStatus,
  });
  await requireLeadAuditTables(database);

  const existingMutation = await findMutation(database, normalizedRequestId);
  if (existingMutation) {
    assertMatchingMutation(existingMutation, normalizedLeadId, payloadSha256);
    await ensureLeadMutationComplete(database, {
      actorSubject: existingMutation.actor_subject,
      expectedRevision: existingMutation.previous_revision,
      fromStatus: existingMutation.previous_status,
      leadId: existingMutation.entity_key,
      payloadSha256,
      requestId: normalizedRequestId,
      toStatus: existingMutation.status,
    });
    return existingMutation.entity_key;
  }

  const current = await readLeadRevision(database, normalizedLeadId);
  if (!current) return null;
  if (current.revision !== expectedRevision) {
    throw new AdminLeadWriteConflictError("Lead đã thay đổi ở phiên khác. Hãy tải lại trước khi lưu.");
  }
  if (current.status === normalizedStatus) return normalizedLeadId;

  const postcondition: LeadMutationPostcondition = {
    actorSubject: normalizedActor,
    expectedRevision,
    fromStatus: current.status,
    leadId: normalizedLeadId,
    payloadSha256,
    requestId: normalizedRequestId,
    toStatus: normalizedStatus,
  };

  const databaseWithBatch = requireBatch(database);
  const statements = [
    buildLeadUpdate(database, normalizedLeadId, normalizedStatus, expectedRevision, normalizedRequestId),
    buildLeadEvent(database, normalizedLeadId, normalizedActor, current.status, normalizedStatus, expectedRevision + 1, normalizedRequestId),
    buildLeadAudit(database, normalizedRequestId, normalizedActor, normalizedLeadId, current.status, normalizedStatus, expectedRevision, payloadSha256),
    buildLegacyAudit(database, normalizedActor, normalizedLeadId, current.status, normalizedStatus, payloadSha256, expectedRevision, normalizedRequestId),
  ];
  try {
    await databaseWithBatch.batch([
      ...statements,
      buildLeadPostcondition(database, postcondition),
    ]);
  } catch (error) {
    const racedMutation = await findMutation(database, normalizedRequestId);
    if (racedMutation) {
      assertMatchingMutation(racedMutation, normalizedLeadId, payloadSha256);
      await ensureLeadMutationComplete(database, {
        actorSubject: racedMutation.actor_subject,
        expectedRevision: racedMutation.previous_revision,
        fromStatus: racedMutation.previous_status,
        leadId: racedMutation.entity_key,
        payloadSha256,
        requestId: normalizedRequestId,
        toStatus: racedMutation.status,
      });
      return racedMutation.entity_key;
    }
    const latest = await readLeadRevision(database, normalizedLeadId);
    if (latest && latest.revision !== expectedRevision) {
      throw new AdminLeadWriteConflictError("Lead đã thay đổi ở phiên khác. Hãy tải lại trước khi lưu.");
    }
    throw normalizeLeadWriteError(error);
  }
  const mutation = await findMutation(database, normalizedRequestId);
  if (!mutation) return resolveLeadConflict(database, normalizedRequestId, normalizedLeadId, payloadSha256);
  assertMatchingMutation(mutation, normalizedLeadId, payloadSha256);
  await ensureLeadMutationComplete(database, postcondition);
  return mutation.entity_key;
}

export async function readAdminLeadForWrite(database: D1DatabaseLike, leadId: string): Promise<AdminLead | null> {
  const row = await database.prepare(`
    SELECT id, status, full_name, company_name, email, phone, country, message,
      source, delivery_status, assigned_to, revision, created_at, updated_at
    FROM leads
    WHERE id = ?
    LIMIT 1
  `).bind(normalizeLeadId(leadId)).first<AdminLeadRow>();
  return row ? toAdminLead(row) : null;
}

async function requireLeadAuditTables(database: D1DatabaseLike): Promise<void> {
  const [hasLeadAudit, hasLegacyAudit] = await Promise.all([
    tableExists(database, "admin_lead_audit"),
    tableExists(database, "audit_logs"),
  ]);
  if (!hasLeadAudit || !hasLegacyAudit) {
    throw new AdminLeadWriteStorageError("Các bảng audit lead chưa được triển khai.");
  }
}

async function findMutation(database: D1DatabaseLike, requestId: string): Promise<LeadMutationRow | null> {
  return database.prepare(`
    SELECT actor_subject, action, entity_key, entity_type,
      previous_revision, previous_status, payload_sha256, request_id,
      resulting_revision, status
    FROM admin_lead_audit
    WHERE request_id = ?
    LIMIT 1
  `).bind(requestId).first<LeadMutationRow>();
}

async function ensureLeadMutationComplete(
  database: D1DatabaseLike,
  postcondition: LeadMutationPostcondition,
): Promise<void> {
  const eventMessage = JSON.stringify({ from: postcondition.fromStatus, to: postcondition.toStatus });
  const legacyMetadata = JSON.stringify({
    expectedRevision: postcondition.expectedRevision,
    from: postcondition.fromStatus,
    payloadSha256: postcondition.payloadSha256,
    to: postcondition.toStatus,
  });
  const row = await database.prepare(`
    /* admin-write-postcondition-read */
    SELECT CASE WHEN (
      EXISTS (
        SELECT 1
        FROM admin_lead_audit marker
        JOIN leads lead_row ON lead_row.id = marker.entity_key
        WHERE marker.request_id = ?
          AND marker.actor_subject = ?
          AND marker.action = 'update'
          AND marker.entity_type = 'lead'
          AND marker.entity_key = ?
          AND marker.previous_status = ?
          AND marker.status = ?
          AND marker.previous_revision = ?
          AND marker.resulting_revision = ?
          AND marker.payload_sha256 = ?
          AND lead_row.revision = ?
          AND lead_row.last_request_id = ?
          AND lead_row.status = ?
      )
      AND EXISTS (
        SELECT 1 FROM lead_events event
        WHERE event.lead_id = ?
          AND event.actor_subject = ?
          AND event.event_type = 'status_changed'
          AND event.message = ?
      )
      AND EXISTS (
        SELECT 1 FROM audit_logs legacy
        WHERE legacy.actor_subject = ?
          AND legacy.action = 'lead.status_updated'
          AND legacy.entity_type = 'lead'
          AND legacy.entity_id = ?
          AND legacy.metadata_json = ?
      )
    ) THEN 1 ELSE 0 END AS complete
  `).bind(
    postcondition.requestId,
    postcondition.actorSubject,
    postcondition.leadId,
    postcondition.fromStatus,
    postcondition.toStatus,
    postcondition.expectedRevision,
    postcondition.expectedRevision + 1,
    postcondition.payloadSha256,
    postcondition.expectedRevision + 1,
    postcondition.requestId,
    postcondition.toStatus,
    postcondition.leadId,
    postcondition.actorSubject,
    eventMessage,
    postcondition.actorSubject,
    postcondition.leadId,
    legacyMetadata,
  ).first<{ complete?: unknown }>();
  if (Number(row?.complete) !== 1) {
    throw new AdminLeadWriteStorageError(
      "Không thể xác nhận đầy đủ trạng thái lead, sự kiện và audit; thao tác bị khóa để tránh báo thành công sai.",
    );
  }
}

function buildLeadPostcondition(
  database: D1DatabaseLike,
  postcondition: LeadMutationPostcondition,
): D1PreparedStatementLike {
  const eventMessage = JSON.stringify({ from: postcondition.fromStatus, to: postcondition.toStatus });
  const legacyMetadata = JSON.stringify({
    expectedRevision: postcondition.expectedRevision,
    from: postcondition.fromStatus,
    payloadSha256: postcondition.payloadSha256,
    to: postcondition.toStatus,
  });
  return database.prepare(`
    /* admin-write-postcondition */
    INSERT INTO admin_lead_audit (
      request_id, actor_subject, entity_key, previous_status, status,
      payload_sha256, action, entity_type, previous_revision, resulting_revision
    )
    SELECT NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
    WHERE NOT (
      EXISTS (
        SELECT 1
        FROM admin_lead_audit marker
        JOIN leads lead_row ON lead_row.id = marker.entity_key
        WHERE marker.request_id = ?
          AND marker.actor_subject = ?
          AND marker.action = 'update'
          AND marker.entity_type = 'lead'
          AND marker.entity_key = ?
          AND marker.previous_status = ?
          AND marker.status = ?
          AND marker.previous_revision = ?
          AND marker.resulting_revision = ?
          AND marker.payload_sha256 = ?
          AND lead_row.revision = ?
          AND lead_row.last_request_id = ?
          AND lead_row.status = ?
      )
      AND EXISTS (
        SELECT 1 FROM lead_events event
        WHERE event.lead_id = ?
          AND event.actor_subject = ?
          AND event.event_type = 'status_changed'
          AND event.message = ?
      )
      AND EXISTS (
        SELECT 1 FROM audit_logs legacy
        WHERE legacy.actor_subject = ?
          AND legacy.action = 'lead.status_updated'
          AND legacy.entity_type = 'lead'
          AND legacy.entity_id = ?
          AND legacy.metadata_json = ?
      )
    )
  `).bind(
    postcondition.requestId,
    postcondition.actorSubject,
    postcondition.leadId,
    postcondition.fromStatus,
    postcondition.toStatus,
    postcondition.expectedRevision,
    postcondition.expectedRevision + 1,
    postcondition.payloadSha256,
    postcondition.expectedRevision + 1,
    postcondition.requestId,
    postcondition.toStatus,
    postcondition.leadId,
    postcondition.actorSubject,
    eventMessage,
    postcondition.actorSubject,
    postcondition.leadId,
    legacyMetadata,
  );
}

async function readLeadRevision(database: D1DatabaseLike, leadId: string): Promise<LeadRevisionRow | null> {
  const row = await database.prepare(`
    SELECT id, status, revision
    FROM leads
    WHERE id = ?
    LIMIT 1
  `).bind(leadId).first<LeadRevisionRow>();
  if (!row) return null;
  if (!Number.isSafeInteger(row.revision) || row.revision < 1) {
    throw new AdminLeadWriteStorageError("Lead chưa có revision hợp lệ cho thao tác an toàn.");
  }
  return row;
}

async function resolveLeadConflict(
  database: D1DatabaseLike,
  requestId: string,
  leadId: string,
  payloadSha256: string,
): Promise<string> {
  const mutation = await findMutation(database, requestId);
  if (mutation) {
    assertMatchingMutation(mutation, leadId, payloadSha256);
    return mutation.entity_key;
  }
  throw new AdminLeadWriteConflictError("Lead đã thay đổi ở phiên khác. Hãy tải lại trước khi lưu.");
}

function buildLeadUpdate(
  database: D1DatabaseLike,
  leadId: string,
  status: LeadStatus,
  expectedRevision: number,
  requestId: string,
): D1PreparedStatementLike {
  return database.prepare(`
    UPDATE leads
    SET status = ?, revision = revision + 1, last_request_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND revision = ?
  `).bind(status, requestId, leadId, expectedRevision);
}

function buildLeadEvent(
  database: D1DatabaseLike,
  leadId: string,
  actorSubject: string,
  from: LeadStatus,
  to: LeadStatus,
  resultingRevision: number,
  requestId: string,
): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO lead_events (id, lead_id, actor_subject, event_type, message)
    SELECT ?, ?, ?, 'status_changed', ?
    FROM leads
    WHERE id = ? AND revision = ? AND last_request_id = ? AND status = ?
  `).bind(crypto.randomUUID(), leadId, actorSubject, JSON.stringify({ from, to }), leadId, resultingRevision, requestId, to);
}

function buildLeadAudit(
  database: D1DatabaseLike,
  requestId: string,
  actorSubject: string,
  leadId: string,
  from: LeadStatus,
  to: LeadStatus,
  previousRevision: number,
  payloadSha256: string,
): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO admin_lead_audit (
      request_id, actor_subject, entity_key, previous_status, status,
      payload_sha256, action, entity_type, previous_revision, resulting_revision
    )
    SELECT ?, ?, ?, ?, ?, ?, 'update', 'lead', ?, ?
    FROM leads
    WHERE id = ? AND revision = ? AND last_request_id = ? AND status = ?
  `).bind(requestId, actorSubject, leadId, from, to, payloadSha256, previousRevision, previousRevision + 1, leadId, previousRevision + 1, requestId, to);
}

function buildLegacyAudit(
  database: D1DatabaseLike,
  actorSubject: string,
  leadId: string,
  from: LeadStatus,
  to: LeadStatus,
  payloadSha256: string,
  expectedRevision: number,
  requestId: string,
): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
    SELECT ?, ?, 'lead.status_updated', 'lead', ?, ?
    FROM leads
    WHERE id = ? AND revision = ? AND last_request_id = ? AND status = ?
  `).bind(
    crypto.randomUUID(),
    actorSubject,
    leadId,
    JSON.stringify({ expectedRevision, from, payloadSha256, to }),
    leadId,
    expectedRevision + 1,
    requestId,
    to,
  );
}

function assertMatchingMutation(mutation: LeadMutationRow, leadId: string, payloadSha256: string): void {
  if (mutation.action !== "update" || mutation.entity_key !== leadId || mutation.payload_sha256 !== payloadSha256) {
    throw new AdminLeadWriteIdempotencyConflictError("requestId đã được dùng cho một payload lead khác.");
  }
}

function requireBatch(database: D1DatabaseLike): D1DatabaseWithBatch {
  const databaseWithBatch = database as D1DatabaseWithBatch;
  if (typeof databaseWithBatch.batch !== "function") {
    throw new AdminLeadWriteStorageError("D1 atomic batch chưa sẵn sàng cho lead write.");
  }
  return databaseWithBatch;
}

function assertRows(result: D1BatchResultLike | undefined, message: string): void {
  if (!hasRows(result)) throw new AdminLeadWriteStorageError(message);
}

function hasRows(result: unknown): boolean {
  if (typeof result !== "object" || result === null) return false;
  const record = result as D1BatchResultLike & { results?: unknown[] };
  if (Array.isArray(record.results)) return record.results.length > 0;
  const changes = record.meta?.changes;
  return changes !== undefined && Number(changes) > 0;
}

function normalizeLeadWriteError(error: unknown): unknown {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  if (message.includes("admin-write-postcondition")
    || (normalized.includes("admin_lead_audit") && normalized.includes("constraint"))
    || (normalized.includes("lead_events") && normalized.includes("constraint"))
    || (normalized.includes("audit_logs") && normalized.includes("constraint"))) {
    return new AdminLeadWriteStorageError(
      "Không ghi đồng bộ được lead, sự kiện và audit; hệ thống đã rollback để tránh báo thành công sai.",
    );
  }
  return error;
}

function normalizeLeadId(value: string): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new AdminLeadWriteValidationError("id lead không hợp lệ.");
  }
  return value.toLowerCase();
}

function normalizeStatus(value: LeadStatus): LeadStatus {
  if (typeof value !== "string" || !leadStatuses.has(value)) {
    throw new AdminLeadWriteValidationError("Trạng thái lead không hợp lệ.");
  }
  return value;
}

function normalizeRequestId(value: string): string {
  if (!isAdminRequestId(value)) throw new AdminLeadWriteValidationError("requestId phải là UUID hợp lệ.");
  return value.trim().toLowerCase();
}

function normalizeActor(value: string): string {
  const actor = value.trim();
  if (!actor || actor.length > 255) throw new AdminLeadWriteValidationError("actorSubject không hợp lệ.");
  return actor;
}

function requireRevision(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new AdminLeadWriteValidationError("revision phải là số nguyên dương.");
  }
  return value;
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
  revision: number;
  created_at: string;
  updated_at: string;
}

function toAdminLead(row: AdminLeadRow): AdminLead {
  return {
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
    revision: row.revision,
    source: row.source,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

async function fingerprint(input: Record<string, unknown>): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(input));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
