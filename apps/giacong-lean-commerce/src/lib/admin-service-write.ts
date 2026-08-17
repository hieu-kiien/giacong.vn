import type {
  AdminServiceInput,
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "./admin-data.ts";

interface D1BatchResultLike {
  results?: unknown[];
}

interface D1BatchDatabaseLike extends D1DatabaseLike {
  batch(statements: D1PreparedStatementLike[]): Promise<D1BatchResultLike[]>;
}

export class AdminServiceStaleWriteError extends Error {
  constructor() {
    super("Dữ liệu dịch vụ đã thay đổi. Hãy tải lại trước khi lưu.");
    this.name = "AdminServiceStaleWriteError";
  }
}

export class AdminServiceAtomicWriteError extends Error {}

export async function createAdminServiceAtomically(
  database: D1DatabaseLike,
  input: AdminServiceInput,
  actorSubject: string,
): Promise<number> {
  const batchDatabase = requireBatch(database);
  const auditId = crypto.randomUUID();
  const statements: D1PreparedStatementLike[] = [
    database.prepare(`
      INSERT INTO services (
        slug, name, summary, description, meta_title, is_active, revision
      ) VALUES (?, ?, ?, ?, '', ?, 1)
      RETURNING id
    `).bind(
      input.slug,
      input.name,
      input.summary,
      input.description,
      input.isActive ? 1 : 0,
    ),
    database.prepare(`
      INSERT INTO service_admin_meta (
        service_id, status, lead_time_days, moq_summary, updated_by, updated_at
      )
      SELECT id, ?, ?, ?, ?, CURRENT_TIMESTAMP
      FROM services
      WHERE slug = ?
      LIMIT 1
      ON CONFLICT(service_id) DO UPDATE SET
        status = excluded.status,
        lead_time_days = excluded.lead_time_days,
        moq_summary = excluded.moq_summary,
        updated_by = excluded.updated_by,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      input.status,
      input.leadTimeDays,
      input.moqSummary,
      actorSubject,
      input.slug,
    ),
    database.prepare(`
      INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
      SELECT ?, ?, 'service.created', 'service', CAST(id AS TEXT), ?
      FROM services
      WHERE slug = ?
      LIMIT 1
    `).bind(
      auditId,
      actorSubject,
      JSON.stringify({ input }),
      input.slug,
    ),
  ];

  const results = await batchDatabase.batch(statements);
  const createdId = returningPositiveInteger(results[0]?.results, "id");
  if (!createdId) throw new AdminServiceAtomicWriteError("Không đọc được ID dịch vụ vừa tạo.");
  return createdId;
}

export async function updateAdminServiceAtomically(
  database: D1DatabaseLike,
  serviceId: number,
  input: AdminServiceInput,
  expectedRevisionRaw: unknown,
  actorSubject: string,
): Promise<void> {
  const expectedRevision = requireRevision(expectedRevisionRaw, "cập nhật");
  const batchDatabase = requireBatch(database);
  const auditId = crypto.randomUUID();
  const metadataJson = JSON.stringify({ after: input, expectedRevision, serviceId });

  const statements: D1PreparedStatementLike[] = [
    revisionAuditMarker(
      database,
      auditId,
      actorSubject,
      "service.updated",
      serviceId,
      expectedRevision,
      metadataJson,
    ),
    database.prepare(`
      UPDATE services
      SET slug = ?, name = ?, summary = ?, description = ?,
        is_active = ?, updated_at = CURRENT_TIMESTAMP, revision = revision + 1
      WHERE id = ? AND revision = ?
        AND EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)
    `).bind(
      input.slug,
      input.name,
      input.summary,
      input.description,
      input.isActive ? 1 : 0,
      serviceId,
      expectedRevision,
      auditId,
    ),
    database.prepare(`
      INSERT INTO service_admin_meta (
        service_id, status, lead_time_days, moq_summary, updated_by, updated_at
      )
      SELECT ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
      WHERE EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)
      ON CONFLICT(service_id) DO UPDATE SET
        status = excluded.status,
        lead_time_days = excluded.lead_time_days,
        moq_summary = excluded.moq_summary,
        updated_by = excluded.updated_by,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      serviceId,
      input.status,
      input.leadTimeDays,
      input.moqSummary,
      actorSubject,
      auditId,
    ),
  ];

  const results = await batchDatabase.batch(statements);
  assertMarkerCreated(results[0]?.results);
}

export async function archiveAdminServiceAtomically(
  database: D1DatabaseLike,
  serviceId: number,
  expectedRevisionRaw: unknown,
  actorSubject: string,
): Promise<void> {
  const expectedRevision = requireRevision(expectedRevisionRaw, "ẩn");
  const batchDatabase = requireBatch(database);
  const auditId = crypto.randomUUID();
  const metadataJson = JSON.stringify({ expectedRevision, serviceId });

  const statements: D1PreparedStatementLike[] = [
    revisionAuditMarker(
      database,
      auditId,
      actorSubject,
      "service.archived",
      serviceId,
      expectedRevision,
      metadataJson,
    ),
    database.prepare(`
      UPDATE services
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP, revision = revision + 1
      WHERE id = ? AND revision = ?
        AND EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)
    `).bind(serviceId, expectedRevision, auditId),
    database.prepare(`
      INSERT INTO service_admin_meta (
        service_id, status, updated_by, updated_at
      )
      SELECT ?, 'archived', ?, CURRENT_TIMESTAMP
      WHERE EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)
      ON CONFLICT(service_id) DO UPDATE SET
        status = 'archived',
        updated_by = excluded.updated_by,
        updated_at = CURRENT_TIMESTAMP
    `).bind(serviceId, actorSubject, auditId),
  ];

  const results = await batchDatabase.batch(statements);
  assertMarkerCreated(results[0]?.results);
}

function revisionAuditMarker(
  database: D1DatabaseLike,
  auditId: string,
  actorSubject: string,
  action: string,
  serviceId: number,
  expectedRevision: number,
  metadataJson: string,
): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
    SELECT ?, ?, ?, 'service', ?, ?
    WHERE EXISTS (
      SELECT 1
      FROM services
      WHERE id = ? AND revision = ?
    )
    RETURNING id
  `).bind(
    auditId,
    actorSubject,
    action,
    String(serviceId),
    metadataJson,
    serviceId,
    expectedRevision,
  );
}

function assertMarkerCreated(rows: unknown[] | undefined): void {
  if (!Array.isArray(rows) || rows.length !== 1) throw new AdminServiceStaleWriteError();
}

function returningPositiveInteger(rows: unknown[] | undefined, key: string): number | null {
  if (!Array.isArray(rows) || rows.length !== 1) return null;
  const row = rows[0];
  if (typeof row !== "object" || row === null || Array.isArray(row)) return null;
  const value = (row as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function requireRevision(value: unknown, action: string): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new AdminServiceAtomicWriteError(`Revision hiện tại là bắt buộc khi ${action} dịch vụ.`);
  }
  return Number(value);
}

function requireBatch(database: D1DatabaseLike): D1BatchDatabaseLike {
  const candidate = database as D1DatabaseLike & { batch?: D1BatchDatabaseLike["batch"] };
  if (typeof candidate.batch !== "function") {
    throw new AdminServiceAtomicWriteError("D1 batch() là bắt buộc để ghi dịch vụ an toàn.");
  }
  return candidate as D1BatchDatabaseLike;
}
