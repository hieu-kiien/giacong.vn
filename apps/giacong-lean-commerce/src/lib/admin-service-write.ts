import type {
  AdminServiceInput,
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "./admin-data.ts";
import { tableExists } from "./admin-data.ts";
import { isAdminRequestId } from "./admin-request.ts";

export class AdminServiceWriteConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminServiceWriteConflictError";
  }
}

export class AdminServiceWriteIdempotencyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminServiceWriteIdempotencyConflictError";
  }
}

export class AdminServiceWriteStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminServiceWriteStorageError";
  }
}

export class AdminServiceWriteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminServiceWriteValidationError";
  }
}

interface ServiceMutationRow {
  action: "create" | "delete" | "update";
  entity_key: string;
  entity_type: "service";
  payload_sha256: string;
  request_id: string;
}

interface ServiceRevisionRow {
  id: number;
  revision: number;
}

interface D1BatchResultLike {
  meta?: { changes?: unknown };
  results?: unknown[];
}

interface D1DatabaseWithBatch extends D1DatabaseLike {
  batch(statements: D1PreparedStatementLike[]): Promise<D1BatchResultLike[]>;
}

type ServiceMutationAction = "create" | "delete" | "update";
type ServiceLegacyAction = "service.archived" | "service.created" | "service.updated";

interface ServiceMutationMetaExpectation {
  leadTimeDays?: number | null;
  moqSummary?: string | null;
  status: AdminServiceInput["status"] | "archived";
}

interface ServiceMutationPostcondition {
  action: ServiceMutationAction;
  entityId?: number;
  expectedRevision?: number;
  legacyAction: ServiceLegacyAction;
  metadataJson: string;
  meta: ServiceMutationMetaExpectation | null;
  payloadSha256: string;
  requestId: string;
  serviceInput?: AdminServiceInput;
}

export async function createAdminServiceAtomically(
  database: D1DatabaseLike,
  input: AdminServiceInput,
  actorSubject: string,
  requestId: string,
): Promise<number> {
  const normalizedRequestId = normalizeRequestId(requestId);
  const payloadSha256 = await fingerprint({
    entityType: "service",
    input: canonicalServiceInput(input),
    operation: "create",
  });
  const hasMeta = await requireAuditTables(database);
  const postcondition = createServiceMutationPostcondition(
    normalizedRequestId,
    "create",
    "service.created",
    payloadSha256,
    input,
    undefined,
    hasMeta,
  );
  const existingMutation = await findMutation(database, normalizedRequestId);
  if (existingMutation) {
    assertMatchingMutation(existingMutation, normalizedRequestId, "create", undefined, payloadSha256);
    return ensureServiceMutationComplete(database, existingMutation, postcondition);
  }

  const databaseWithBatch = requireBatch(database);
  const statements: D1PreparedStatementLike[] = [
    buildServiceInsert(database, input),
    buildCreateMutation(database, normalizedRequestId, actorSubject, input.slug, payloadSha256),
    buildLegacyAudit(database, normalizedRequestId, actorSubject, "service.created", "create", input.slug, payloadSha256),
  ];
  if (hasMeta) statements.push(buildServiceMetaWrite(database, normalizedRequestId, actorSubject, input));
  statements.push(buildServicePostconditionAssertion(database, postcondition));

  try {
    await databaseWithBatch.batch(statements);
  } catch (error) {
    const racedMutation = await findMutation(database, normalizedRequestId);
    if (racedMutation) {
      assertMatchingMutation(racedMutation, normalizedRequestId, "create", undefined, payloadSha256);
      return ensureServiceMutationComplete(database, racedMutation, postcondition);
    }
    throw normalizeServiceBatchError(error);
  }
  const mutation = await findMutation(database, normalizedRequestId);
  if (!mutation) throw new AdminServiceWriteStorageError("Không đọc lại được audit dịch vụ vừa tạo.");
  assertMatchingMutation(mutation, normalizedRequestId, "create", undefined, payloadSha256);
  return ensureServiceMutationComplete(database, mutation, postcondition);
}

export async function updateAdminServiceAtomically(
  database: D1DatabaseLike,
  id: number,
  input: AdminServiceInput,
  expectedRevisionRaw: unknown,
  actorSubject: string,
  requestId: string,
): Promise<number | null> {
  const expectedRevision = requireRevision(expectedRevisionRaw, "cập nhật");
  const normalizedRequestId = normalizeRequestId(requestId);
  const payloadSha256 = await fingerprint({
    entityType: "service",
    expectedRevision,
    id,
    input: canonicalServiceInput(input),
    operation: "update",
  });
  const hasMeta = await requireAuditTables(database);
  const postcondition = createServiceMutationPostcondition(
    normalizedRequestId,
    "update",
    "service.updated",
    payloadSha256,
    input,
    id,
    hasMeta,
    expectedRevision,
  );
  const existingMutation = await findMutation(database, normalizedRequestId);
  if (existingMutation) {
    assertMatchingMutation(existingMutation, normalizedRequestId, "update", String(id), payloadSha256);
    return ensureServiceMutationComplete(database, existingMutation, postcondition);
  }

  const existing = await readServiceRevision(database, id);
  if (!existing) return null;
  assertExpectedRevision(existing.revision, expectedRevision, "Dịch vụ đã thay đổi. Hãy tải lại trước khi lưu.");

  const databaseWithBatch = requireBatch(database);
  const statements: D1PreparedStatementLike[] = [
    buildServiceUpdate(database, id, input, expectedRevision),
    buildRevisionMutation(database, normalizedRequestId, actorSubject, "update", id, expectedRevision, payloadSha256),
    buildLegacyAudit(database, normalizedRequestId, actorSubject, "service.updated", "id", id, payloadSha256, expectedRevision),
  ];
  if (hasMeta) statements.push(buildServiceMetaWrite(database, normalizedRequestId, actorSubject, input, id));
  statements.push(buildServicePostconditionAssertion(database, postcondition));

  let results: D1BatchResultLike[];
  try {
    results = await databaseWithBatch.batch(statements);
  } catch (error) {
    const racedMutation = await findMutation(database, normalizedRequestId);
    if (racedMutation) {
      assertMatchingMutation(racedMutation, normalizedRequestId, "update", String(id), payloadSha256);
      return ensureServiceMutationComplete(database, racedMutation, postcondition);
    }
    throw normalizeServiceBatchError(error);
  }
  if (!hasRows(results[0])) return resolveServiceConflict(database, normalizedRequestId, payloadSha256, "update", id, postcondition);
  const mutation = await findMutation(database, normalizedRequestId);
  if (!mutation) throw new AdminServiceWriteStorageError("Không đọc lại được audit dịch vụ vừa cập nhật.");
  assertMatchingMutation(mutation, normalizedRequestId, "update", String(id), payloadSha256);
  return ensureServiceMutationComplete(database, mutation, postcondition);
}

export async function archiveAdminServiceAtomically(
  database: D1DatabaseLike,
  id: number,
  expectedRevisionRaw: unknown,
  actorSubject: string,
  requestId: string,
): Promise<number | null> {
  const expectedRevision = requireRevision(expectedRevisionRaw, "ẩn");
  const normalizedRequestId = normalizeRequestId(requestId);
  const payloadSha256 = await fingerprint({
    entityType: "service",
    expectedRevision,
    id,
    operation: "archive",
  });
  const hasMeta = await requireAuditTables(database);
  const postcondition = createServiceMutationPostcondition(
    normalizedRequestId,
    "delete",
    "service.archived",
    payloadSha256,
    undefined,
    id,
    hasMeta,
    expectedRevision,
  );
  const existingMutation = await findMutation(database, normalizedRequestId);
  if (existingMutation) {
    assertMatchingMutation(existingMutation, normalizedRequestId, "delete", String(id), payloadSha256);
    return ensureServiceMutationComplete(database, existingMutation, postcondition);
  }

  const existing = await readServiceRevision(database, id);
  if (!existing) return null;
  assertExpectedRevision(existing.revision, expectedRevision, "Dịch vụ đã thay đổi. Hãy tải lại trước khi ẩn.");

  const databaseWithBatch = requireBatch(database);
  const statements: D1PreparedStatementLike[] = [
    buildServiceArchive(database, id, expectedRevision),
    buildRevisionMutation(database, normalizedRequestId, actorSubject, "delete", id, expectedRevision, payloadSha256),
    buildLegacyAudit(database, normalizedRequestId, actorSubject, "service.archived", "id", id, payloadSha256, expectedRevision),
  ];
  if (hasMeta) statements.push(buildServiceArchiveMeta(database, normalizedRequestId, actorSubject, id));
  statements.push(buildServicePostconditionAssertion(database, postcondition));

  let results: D1BatchResultLike[];
  try {
    results = await databaseWithBatch.batch(statements);
  } catch (error) {
    const racedMutation = await findMutation(database, normalizedRequestId);
    if (racedMutation) {
      assertMatchingMutation(racedMutation, normalizedRequestId, "delete", String(id), payloadSha256);
      return ensureServiceMutationComplete(database, racedMutation, postcondition);
    }
    throw normalizeServiceBatchError(error);
  }
  if (!hasRows(results[0])) return resolveServiceConflict(database, normalizedRequestId, payloadSha256, "delete", id, postcondition);
  const mutation = await findMutation(database, normalizedRequestId);
  if (!mutation) throw new AdminServiceWriteStorageError("Không đọc lại được audit dịch vụ vừa ẩn.");
  assertMatchingMutation(mutation, normalizedRequestId, "delete", String(id), payloadSha256);
  return ensureServiceMutationComplete(database, mutation, postcondition);
}

async function requireAuditTables(database: D1DatabaseLike): Promise<boolean> {
  const [hasMarker, hasLegacyAudit] = await Promise.all([
    tableExists(database, "admin_audit_log"),
    tableExists(database, "audit_logs"),
  ]);
  if (!hasMarker || !hasLegacyAudit) {
    throw new AdminServiceWriteStorageError("Các bảng audit dịch vụ chưa được triển khai.");
  }
  return tableExists(database, "service_admin_meta");
}

async function findMutation(database: D1DatabaseLike, requestId: string): Promise<ServiceMutationRow | null> {
  return database.prepare(`
    SELECT action, entity_key, entity_type, payload_sha256, request_id
    FROM admin_audit_log
    WHERE request_id = ?
    LIMIT 1
  `).bind(requestId).first<ServiceMutationRow>();
}

async function readServiceRevision(database: D1DatabaseLike, id: number): Promise<ServiceRevisionRow | null> {
  const row = await database.prepare(`
    SELECT id, revision
    FROM services
    WHERE id = ?
    LIMIT 1
  `).bind(id).first<ServiceRevisionRow>();
  if (!row) return null;
  if (!Number.isSafeInteger(row.id) || row.id < 1 || !Number.isSafeInteger(row.revision) || row.revision < 1) {
    throw new AdminServiceWriteStorageError("Dịch vụ chưa có revision hợp lệ cho thao tác an toàn.");
  }
  return row;
}

function buildServiceInsert(database: D1DatabaseLike, input: AdminServiceInput): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO services (slug, name, summary, description, image_url, meta_title, is_active, revision)
    VALUES (?, ?, ?, ?, ?, '', ?, 1)
    RETURNING id, revision
  `).bind(
    input.slug,
    input.name,
    input.summary,
    input.description,
    input.imageUrl,
    input.isActive ? 1 : 0,
  );
}

function buildServiceUpdate(
  database: D1DatabaseLike,
  id: number,
  input: AdminServiceInput,
  expectedRevision: number,
): D1PreparedStatementLike {
  return database.prepare(`
    UPDATE services
    SET slug = ?, name = ?, summary = ?, description = ?, image_url = ?,
      is_active = ?, updated_at = CURRENT_TIMESTAMP, revision = revision + 1
    WHERE id = ? AND revision = ?
    RETURNING id, revision
  `).bind(
    input.slug,
    input.name,
    input.summary,
    input.description,
    input.imageUrl,
    input.isActive ? 1 : 0,
    id,
    expectedRevision,
  );
}

function buildServiceArchive(
  database: D1DatabaseLike,
  id: number,
  expectedRevision: number,
): D1PreparedStatementLike {
  return database.prepare(`
    UPDATE services
    SET is_active = 0, updated_at = CURRENT_TIMESTAMP, revision = revision + 1
    WHERE id = ? AND revision = ?
    RETURNING id, revision
  `).bind(id, expectedRevision);
}

function buildCreateMutation(
  database: D1DatabaseLike,
  requestId: string,
  actorSubject: string,
  slug: string,
  payloadSha256: string,
): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO admin_audit_log (
      request_id, actor_subject, action, entity_type, entity_key,
      previous_revision, resulting_revision, payload_sha256
    )
    SELECT ?, ?, 'create', 'service', CAST(id AS TEXT), NULL, revision, ?
    FROM services
    WHERE slug = ? AND changes() = 1
    LIMIT 1
    RETURNING request_id
  `).bind(requestId, actorSubject, payloadSha256, slug);
}

function buildRevisionMutation(
  database: D1DatabaseLike,
  requestId: string,
  actorSubject: string,
  action: Exclude<ServiceMutationAction, "create">,
  id: number,
  expectedRevision: number,
  payloadSha256: string,
): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO admin_audit_log (
      request_id, actor_subject, action, entity_type, entity_key,
      previous_revision, resulting_revision, payload_sha256
    )
    SELECT ?, ?, '${action}', 'service', CAST(id AS TEXT), ?, revision, ?
    FROM services
    WHERE id = ? AND revision = ? AND changes() = 1
    LIMIT 1
    RETURNING request_id
  `).bind(requestId, actorSubject, expectedRevision, payloadSha256, id, expectedRevision + 1);
}

function buildLegacyAudit(
  database: D1DatabaseLike,
  requestId: string,
  actorSubject: string,
  action: ServiceLegacyAction,
  lookup: "create" | "id",
  lookupValue: string | number,
  payloadSha256: string,
  expectedRevision?: number,
): D1PreparedStatementLike {
  const metadata = buildServiceLegacyMetadata(requestId, payloadSha256, expectedRevision);
  const where = lookup === "create" ? "slug = ?" : "id = ?";
  return database.prepare(`
    INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
    SELECT ?, ?, '${action}', 'service', CAST(id AS TEXT), ?
    FROM services
    WHERE ${where}
      AND EXISTS (SELECT 1 FROM admin_audit_log WHERE request_id = ?)
      AND changes() = 1
    LIMIT 1
    RETURNING id
  `).bind(crypto.randomUUID(), actorSubject, metadata, lookupValue, requestId);
}

function buildServiceMetaWrite(
  database: D1DatabaseLike,
  requestId: string,
  actorSubject: string,
  input: AdminServiceInput,
  id?: number,
): D1PreparedStatementLike {
  const idExpression = id === undefined
    ? "(SELECT CAST(entity_key AS INTEGER) FROM admin_audit_log WHERE request_id = ?)"
    : "?";
  const values = id === undefined
    ? [requestId, input.status, input.leadTimeDays, input.moqSummary, actorSubject, requestId]
    : [id, input.status, input.leadTimeDays, input.moqSummary, actorSubject, requestId];
  return database.prepare(`
    INSERT INTO service_admin_meta (service_id, status, lead_time_days, moq_summary, updated_by, updated_at)
    SELECT ${idExpression}, ?, ?, ?, ?, CURRENT_TIMESTAMP
    WHERE EXISTS (SELECT 1 FROM admin_audit_log WHERE request_id = ?)
      AND changes() = 1
    ON CONFLICT(service_id) DO UPDATE SET
      status = excluded.status,
      lead_time_days = excluded.lead_time_days,
      moq_summary = excluded.moq_summary,
      updated_by = excluded.updated_by,
      updated_at = CURRENT_TIMESTAMP
    RETURNING service_id
  `).bind(...values);
}

function buildServiceArchiveMeta(
  database: D1DatabaseLike,
  requestId: string,
  actorSubject: string,
  id: number,
): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO service_admin_meta (service_id, status, updated_by, updated_at)
    SELECT ?, 'archived', ?, CURRENT_TIMESTAMP
    WHERE EXISTS (SELECT 1 FROM admin_audit_log WHERE request_id = ?)
      AND changes() = 1
    ON CONFLICT(service_id) DO UPDATE SET
      status = 'archived',
      updated_by = excluded.updated_by,
      updated_at = CURRENT_TIMESTAMP
    RETURNING service_id
  `).bind(id, actorSubject, requestId);
}

function createServiceMutationPostcondition(
  requestId: string,
  action: ServiceMutationAction,
  legacyAction: ServiceLegacyAction,
  payloadSha256: string,
  input: AdminServiceInput | undefined,
  entityId: number | undefined,
  hasMeta: boolean,
  expectedRevision?: number,
): ServiceMutationPostcondition {
  return {
    action,
    entityId,
    legacyAction,
    metadataJson: buildServiceLegacyMetadata(requestId, payloadSha256, expectedRevision),
    meta: hasMeta
      ? input
        ? {
            leadTimeDays: input.leadTimeDays,
            moqSummary: input.moqSummary,
            status: input.status,
          }
        : { status: "archived" }
      : null,
    payloadSha256,
    requestId,
    serviceInput: input,
    expectedRevision,
  };
}

function buildServiceLegacyMetadata(
  requestId: string,
  payloadSha256: string,
  expectedRevision?: number,
): string {
  return JSON.stringify({
    expectedRevision: expectedRevision ?? null,
    payloadSha256,
    requestId,
  });
}

function buildServicePostconditionAssertion(
  database: D1DatabaseLike,
  postcondition: ServiceMutationPostcondition,
): D1PreparedStatementLike {
  const { expression, values } = buildServiceMutationPostconditionExpression(postcondition);
  const started = buildServiceMutationStartedExpression(postcondition);
  return database.prepare(`
    /* service-write-postcondition-assert */
    INSERT INTO admin_audit_log (
      request_id, actor_subject, action, entity_type, entity_key,
      previous_revision, resulting_revision, payload_sha256
    )
    SELECT NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
    WHERE (${started.expression}
      OR EXISTS (
        SELECT 1
        FROM admin_audit_log
        WHERE request_id = ?
      ))
      AND NOT (${expression})
  `).bind(...started.values, postcondition.requestId, ...values);
}

async function ensureServiceMutationComplete(
  database: D1DatabaseLike,
  mutation: ServiceMutationRow,
  postcondition: ServiceMutationPostcondition,
): Promise<number> {
  const { expression, values } = buildServiceMutationReplayExpression(postcondition);
  const row = await database.prepare(`
    /* service-write-postcondition-read */
    SELECT CASE WHEN (${expression}) THEN 1 ELSE 0 END AS complete
  `).bind(...values).first<{ complete?: unknown }>();
  if (Number(row?.complete) !== 1) {
    throw new AdminServiceWriteStorageError(
      "Không thể xác nhận đầy đủ trạng thái dịch vụ và audit; thao tác bị khóa để tránh báo thành công sai.",
    );
  }
  return readMutationId(mutation);
}

function buildServiceMutationReplayExpression(
  postcondition: ServiceMutationPostcondition,
): { expression: string; values: unknown[] } {
  const revision = postcondition.expectedRevision === undefined
    ? {
        sql: "marker.previous_revision IS NULL AND marker.resulting_revision = 1",
        values: [],
      }
    : {
        sql: "marker.previous_revision = ? AND marker.resulting_revision = ?",
        values: [postcondition.expectedRevision, postcondition.expectedRevision + 1],
      };
  const entity = postcondition.entityId === undefined
    ? { sql: "", values: [] }
    : { sql: "AND service_row.id = ?", values: [postcondition.entityId] };
  const parts = [
    `EXISTS (
      SELECT 1
      FROM admin_audit_log marker
      JOIN services service_row ON service_row.id = CAST(marker.entity_key AS INTEGER)
      WHERE marker.request_id = ?
        AND marker.action = ?
        AND marker.entity_type = 'service'
        AND marker.payload_sha256 = ?
        ${entity.sql}
        AND ${revision.sql}
    )`,
    `EXISTS (
      SELECT 1
      FROM audit_logs legacy
      JOIN admin_audit_log marker
        ON marker.request_id = ?
       AND marker.entity_key = legacy.entity_id
      WHERE legacy.action = ?
        AND legacy.entity_type = 'service'
        AND legacy.metadata_json = ?
    )`,
  ];
  const values: unknown[] = [
    postcondition.requestId,
    postcondition.action,
    postcondition.payloadSha256,
    ...entity.values,
    ...revision.values,
    postcondition.requestId,
    postcondition.legacyAction,
    postcondition.metadataJson,
  ];
  if (postcondition.meta) {
    parts.push(`EXISTS (
      SELECT 1
      FROM service_admin_meta meta
      JOIN admin_audit_log marker
        ON marker.request_id = ?
       AND meta.service_id = CAST(marker.entity_key AS INTEGER)
      WHERE meta.updated_by IS NOT NULL
    )`);
    values.push(postcondition.requestId);
  }
  return { expression: parts.join("\n AND "), values };
}

function buildServiceMutationStartedExpression(
  postcondition: ServiceMutationPostcondition,
): { expression: string; values: unknown[] } {
  if (postcondition.entityId === undefined || postcondition.serviceInput) {
    const input = postcondition.serviceInput;
    if (postcondition.entityId === undefined) {
      return {
        expression: `EXISTS (
          SELECT 1
          FROM services
          WHERE slug = ?
            AND name = ?
            AND summary = ?
            AND description = ?
            AND image_url IS ?
            AND is_active = ?
            AND revision = 1
        )`,
        values: [
          input?.slug,
          input?.name,
          input?.summary,
          input?.description,
          input?.imageUrl,
          input?.isActive ? 1 : 0,
        ],
      };
    }
    return {
      expression: `EXISTS (
        SELECT 1
        FROM services
        WHERE id = ?
          AND revision = ?
          AND slug = ?
          AND name = ?
          AND summary = ?
          AND description = ?
          AND image_url IS ?
          AND is_active = ?
      )`,
      values: [
        postcondition.entityId,
        (postcondition.expectedRevision ?? 0) + 1,
        input?.slug,
        input?.name,
        input?.summary,
        input?.description,
        input?.imageUrl,
        input?.isActive ? 1 : 0,
      ],
    };
  }
  return {
    expression: `EXISTS (
      SELECT 1
      FROM services
      WHERE id = ?
        AND revision = ?
        AND is_active = 0
    )`,
    values: [postcondition.entityId, (postcondition.expectedRevision ?? 0) + 1],
  };
}

function buildServiceMutationPostconditionExpression(
  postcondition: ServiceMutationPostcondition,
): { expression: string; values: unknown[] } {
  const entity = postcondition.entityId === undefined
    ? {
        sql: `EXISTS (
          SELECT 1
          FROM admin_audit_log marker
          JOIN services service_row ON service_row.id = CAST(marker.entity_key AS INTEGER)
          WHERE marker.request_id = ?
            AND marker.action = ?
            AND marker.entity_type = 'service'
            AND marker.payload_sha256 = ?
            AND service_row.slug = ?
            AND service_row.name = ?
            AND service_row.summary = ?
            AND service_row.description = ?
            AND service_row.image_url IS ?
            AND service_row.is_active = ?
            AND service_row.revision = 1
        )`,
        values: [
          postcondition.requestId,
          postcondition.action,
          postcondition.payloadSha256,
          postcondition.serviceInput?.slug,
          postcondition.serviceInput?.name,
          postcondition.serviceInput?.summary,
          postcondition.serviceInput?.description,
          postcondition.serviceInput?.imageUrl,
          postcondition.serviceInput?.isActive ? 1 : 0,
        ],
      }
    : postcondition.serviceInput
      ? {
          sql: `EXISTS (
            SELECT 1
            FROM admin_audit_log marker
            JOIN services service_row ON service_row.id = CAST(marker.entity_key AS INTEGER)
            WHERE marker.request_id = ?
              AND marker.action = ?
              AND marker.entity_type = 'service'
              AND marker.payload_sha256 = ?
              AND service_row.id = ?
              AND service_row.revision = ?
              AND service_row.slug = ?
              AND service_row.name = ?
              AND service_row.summary = ?
              AND service_row.description = ?
              AND service_row.image_url IS ?
              AND service_row.is_active = ?
          )`,
          values: [
            postcondition.requestId,
            postcondition.action,
            postcondition.payloadSha256,
            postcondition.entityId,
            (postcondition.expectedRevision ?? 0) + 1,
            postcondition.serviceInput.slug,
            postcondition.serviceInput.name,
            postcondition.serviceInput.summary,
            postcondition.serviceInput.description,
            postcondition.serviceInput.imageUrl,
            postcondition.serviceInput.isActive ? 1 : 0,
          ],
        }
      : {
          sql: `EXISTS (
            SELECT 1
            FROM admin_audit_log marker
            JOIN services service_row ON service_row.id = CAST(marker.entity_key AS INTEGER)
            WHERE marker.request_id = ?
              AND marker.action = ?
              AND marker.entity_type = 'service'
              AND marker.payload_sha256 = ?
              AND service_row.id = ?
              AND service_row.revision = ?
              AND service_row.is_active = 0
          )`,
          values: [
            postcondition.requestId,
            postcondition.action,
            postcondition.payloadSha256,
            postcondition.entityId,
            (postcondition.expectedRevision ?? 0) + 1,
          ],
        };

  const legacy = {
    sql: `EXISTS (
      SELECT 1
      FROM audit_logs legacy
      JOIN admin_audit_log marker
        ON marker.request_id = ?
       AND marker.entity_key = legacy.entity_id
      WHERE legacy.action = ?
        AND legacy.entity_type = 'service'
        AND legacy.metadata_json = ?
    )`,
    values: [postcondition.requestId, postcondition.legacyAction, postcondition.metadataJson],
  };

  const parts = [entity.sql, legacy.sql];
  const values: unknown[] = [...entity.values, ...legacy.values];
  const meta = postcondition.meta;
  if (meta) {
    if (meta.leadTimeDays !== undefined && meta.moqSummary !== undefined) {
      parts.push(`EXISTS (
        SELECT 1
        FROM service_admin_meta meta
        JOIN admin_audit_log marker
          ON marker.request_id = ?
         AND meta.service_id = CAST(marker.entity_key AS INTEGER)
        WHERE meta.status = ?
          AND meta.lead_time_days IS ?
          AND meta.moq_summary IS ?
          AND meta.updated_by IS NOT NULL
      )`);
      values.push(
        postcondition.requestId,
        meta.status,
        meta.leadTimeDays,
        meta.moqSummary,
      );
    } else {
      parts.push(`EXISTS (
        SELECT 1
        FROM service_admin_meta meta
        JOIN admin_audit_log marker
          ON marker.request_id = ?
         AND meta.service_id = CAST(marker.entity_key AS INTEGER)
        WHERE meta.status = ?
          AND meta.updated_by IS NOT NULL
      )`);
      values.push(postcondition.requestId, meta.status);
    }
  }
  return { expression: parts.join("\n AND "), values };
}

async function resolveServiceConflict(
  database: D1DatabaseLike,
  requestId: string,
  payloadSha256: string,
  action: ServiceMutationAction,
  id: number,
  postcondition: ServiceMutationPostcondition,
): Promise<number> {
  const mutation = await findMutation(database, requestId);
  if (mutation) {
    assertMatchingMutation(mutation, requestId, action, String(id), payloadSha256);
    return ensureServiceMutationComplete(database, mutation, postcondition);
  }
  throw new AdminServiceWriteConflictError("Dịch vụ đã thay đổi ở phiên khác. Hãy tải lại rồi thử lại.");
}

function assertMatchingMutation(
  mutation: ServiceMutationRow,
  requestId: string,
  action: ServiceMutationAction,
  entityKey: string | undefined,
  payloadSha256: string,
): void {
  const entityMatches = entityKey === undefined
    ? isPositiveEntityKey(mutation.entity_key)
    : mutation.entity_key === entityKey;
  if (mutation.request_id !== requestId
    || mutation.action !== action
    || mutation.entity_type !== "service"
    || !entityMatches
    || mutation.payload_sha256 !== payloadSha256) {
    throw new AdminServiceWriteIdempotencyConflictError("requestId đã được dùng cho một payload khác.");
  }
}

function readMutationId(mutation: ServiceMutationRow): number {
  const id = Number(mutation.entity_key);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new AdminServiceWriteStorageError("Audit dịch vụ chứa entity id không hợp lệ.");
  }
  return id;
}

function assertExpectedRevision(actual: number, expected: number, message: string): void {
  if (actual !== expected) throw new AdminServiceWriteConflictError(message);
}

function hasRows(result: D1BatchResultLike | undefined): boolean {
  return Array.isArray(result?.results) && result.results.length > 0;
}

function normalizeServiceBatchError(error: unknown): unknown {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("service write postcondition failed")
    || (message.includes("admin_audit_log") && message.toLowerCase().includes("constraint failed"))) {
    return new AdminServiceWriteStorageError(
      "Không ghi đồng bộ được dịch vụ và audit; hệ thống đã rollback để tránh trạng thái dở dang.",
    );
  }
  return error;
}

function requireBatch(database: D1DatabaseLike): D1DatabaseWithBatch {
  const candidate = database as D1DatabaseWithBatch;
  if (typeof candidate.batch !== "function") {
    throw new AdminServiceWriteStorageError("D1 batch() là bắt buộc để ghi dịch vụ an toàn.");
  }
  return candidate;
}

function normalizeRequestId(value: unknown): string {
  if (typeof value !== "string" || !isAdminRequestId(value)) {
    throw new AdminServiceWriteValidationError("requestId phải là UUID hợp lệ.");
  }
  return value.trim().toLowerCase();
}

function requireRevision(value: unknown, action: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new AdminServiceWriteValidationError(`Revision hiện tại là bắt buộc khi ${action} dịch vụ.`);
  }
  return value;
}

function canonicalServiceInput(input: AdminServiceInput): AdminServiceInput {
  return {
    description: input.description,
    imageUrl: input.imageUrl,
    isActive: input.isActive,
    leadTimeDays: input.leadTimeDays,
    moqSummary: input.moqSummary,
    name: input.name,
    slug: input.slug,
    status: input.status,
    summary: input.summary,
  };
}

function isPositiveEntityKey(value: string): boolean {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0;
}

async function fingerprint(input: Record<string, unknown>): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(input));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
