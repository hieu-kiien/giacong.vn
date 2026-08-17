import type { D1DatabaseLike, D1PreparedStatementLike } from "./admin-data.ts";
import {
  siteSettingDefinitions,
  SiteSettingConflictError,
  SiteSettingNotFoundError,
  SiteSettingValidationError,
  type AdminSiteSetting,
  type SiteSettingGroup,
  type SiteSettingKey,
  type SiteSettingType,
} from "./site-settings.ts";

interface D1BatchResultLike {
  results?: unknown[];
}

interface D1BatchDatabaseLike extends D1DatabaseLike {
  batch(statements: D1PreparedStatementLike[]): Promise<D1BatchResultLike[]>;
}

interface SiteSettingRow {
  setting_key: SiteSettingKey;
  group_name: SiteSettingGroup;
  label: string;
  description: string;
  value_type: SiteSettingType;
  draft_value: string;
  published_value: string;
  version: number;
  updated_by: string | null;
  updated_at: string;
  published_by: string | null;
  published_at: string | null;
}

export async function updateAdminSiteSettingAtomic(
  database: D1DatabaseLike,
  input: { actorSubject: string; expectedVersion: number; key: string; value: unknown },
): Promise<AdminSiteSetting> {
  const definition = getDefinition(input.key);
  const value = normalizeValue(definition, input.value);
  const current = await getSettingRow(database, definition.key);
  if (!current) throw new SiteSettingNotFoundError("Không tìm thấy setting cần cập nhật.");
  assertExpectedVersion(current.version, input.expectedVersion, "lưu");

  const batchDatabase = requireBatch(database);
  const auditId = crypto.randomUUID();
  const statements: D1PreparedStatementLike[] = [
    revisionAuditMarker(database, {
      action: "site_setting.updated",
      actorSubject: input.actorSubject,
      auditId,
      expectedVersion: input.expectedVersion,
      key: definition.key,
      metadata: {
        expectedVersion: input.expectedVersion,
        valueType: definition.type,
      },
    }),
    database.prepare(`
      UPDATE site_settings
      SET draft_value = ?, version = version + 1,
        updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE setting_key = ? AND version = ?
        AND EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)
    `).bind(value, input.actorSubject, definition.key, input.expectedVersion, auditId),
  ];

  const results = await batchDatabase.batch(statements);
  assertMarkerCreated(results[0]?.results, "lưu");
  return toAdminSiteSetting(await getSettingRowOrThrow(database, definition.key));
}

export async function publishAdminSiteSettingAtomic(
  database: D1DatabaseLike,
  input: { actorSubject: string; expectedVersion: number; key: string },
): Promise<AdminSiteSetting> {
  const definition = getDefinition(input.key);
  const current = await getSettingRow(database, definition.key);
  if (!current) throw new SiteSettingNotFoundError("Không tìm thấy setting cần phát hành.");
  assertExpectedVersion(current.version, input.expectedVersion, "phát hành");

  const batchDatabase = requireBatch(database);
  const auditId = crypto.randomUUID();
  const statements: D1PreparedStatementLike[] = [
    revisionAuditMarker(database, {
      action: "site_setting.published",
      actorSubject: input.actorSubject,
      auditId,
      expectedVersion: input.expectedVersion,
      key: definition.key,
      metadata: { previousPublishedValue: current.published_value },
    }),
    database.prepare(`
      UPDATE site_settings
      SET published_value = draft_value, version = version + 1,
        published_by = ?, published_at = CURRENT_TIMESTAMP,
        updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE setting_key = ? AND version = ?
        AND EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)
    `).bind(
      input.actorSubject,
      input.actorSubject,
      definition.key,
      input.expectedVersion,
      auditId,
    ),
  ];

  const results = await batchDatabase.batch(statements);
  assertMarkerCreated(results[0]?.results, "phát hành");
  return toAdminSiteSetting(await getSettingRowOrThrow(database, definition.key));
}

export async function publishAllAdminSiteSettingsAtomic(
  database: D1DatabaseLike,
  input: { actorSubject: string },
): Promise<{ published: AdminSiteSetting[]; skipped: number }> {
  const rows = await database.prepare(`
    SELECT setting_key, group_name, label, description, value_type,
      draft_value, published_value, version, updated_by, updated_at, published_by, published_at
    FROM site_settings
    WHERE draft_value <> published_value
    ORDER BY setting_key
  `).all<SiteSettingRow>();

  if (rows.results.length === 0) return { published: [], skipped: 0 };

  const batchDatabase = requireBatch(database);
  const statements: D1PreparedStatementLike[] = [];
  const markerIndexes: number[] = [];

  for (const row of rows.results) {
    const auditId = crypto.randomUUID();
    markerIndexes.push(statements.length);
    statements.push(revisionAuditMarker(database, {
      action: "site_setting.published",
      actorSubject: input.actorSubject,
      auditId,
      expectedVersion: row.version,
      key: row.setting_key,
      metadata: {
        bulkPublish: true,
        previousPublishedValue: row.published_value,
      },
      requireDirty: true,
    }));
    statements.push(database.prepare(`
      UPDATE site_settings
      SET published_value = draft_value, version = version + 1,
        published_by = ?, published_at = CURRENT_TIMESTAMP,
        updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE setting_key = ? AND version = ?
        AND EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)
    `).bind(
      input.actorSubject,
      input.actorSubject,
      row.setting_key,
      row.version,
      auditId,
    ));
  }

  const results = await batchDatabase.batch(statements);
  const published: AdminSiteSetting[] = [];
  let skipped = 0;

  for (let index = 0; index < rows.results.length; index += 1) {
    const row = rows.results[index];
    const markerRows = results[markerIndexes[index]]?.results;
    if (!Array.isArray(markerRows) || markerRows.length !== 1) {
      skipped += 1;
      continue;
    }
    const updated = await getSettingRow(database, row.setting_key);
    if (updated) published.push(toAdminSiteSetting(updated));
  }

  return { published, skipped };
}

function revisionAuditMarker(
  database: D1DatabaseLike,
  input: {
    action: string;
    actorSubject: string;
    auditId: string;
    expectedVersion: number;
    key: SiteSettingKey;
    metadata: unknown;
    requireDirty?: boolean;
  },
): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
    SELECT ?, ?, ?, 'site_setting', ?, ?
    WHERE EXISTS (
      SELECT 1 FROM site_settings
      WHERE setting_key = ? AND version = ?
        ${input.requireDirty ? "AND draft_value <> published_value" : ""}
    )
    RETURNING id
  `).bind(
    input.auditId,
    input.actorSubject,
    input.action,
    input.key,
    JSON.stringify(input.metadata),
    input.key,
    input.expectedVersion,
  );
}

function requireBatch(database: D1DatabaseLike): D1BatchDatabaseLike {
  const candidate = database as D1DatabaseLike & { batch?: D1BatchDatabaseLike["batch"] };
  if (typeof candidate.batch !== "function") {
    throw new Error("D1 batch() là bắt buộc để ghi site settings an toàn.");
  }
  return candidate as D1BatchDatabaseLike;
}

function assertExpectedVersion(current: number, expected: number, action: string): void {
  if (!Number.isInteger(expected) || expected < 1 || current !== expected) {
    throw new SiteSettingConflictError(`Setting đã thay đổi ở phiên khác. Hãy tải lại trước khi ${action}.`);
  }
}

function assertMarkerCreated(rows: unknown[] | undefined, action: string): void {
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new SiteSettingConflictError(`Setting đã thay đổi ở phiên khác. Hãy tải lại trước khi ${action}.`);
  }
}

function getDefinition(key: string) {
  const definition = siteSettingDefinitions.find((item) => item.key === key);
  if (!definition) throw new SiteSettingValidationError("Setting không được phép chỉnh sửa.");
  return definition;
}

function normalizeValue(definition: (typeof siteSettingDefinitions)[number], value: unknown): string {
  if (typeof value !== "string") throw new SiteSettingValidationError("Giá trị setting phải là chuỗi.");
  const normalized = value.trim();
  if (normalized.length > (definition.type === "multiline" ? 8000 : 1000)) {
    throw new SiteSettingValidationError("Nội dung setting vượt quá giới hạn cho phép.");
  }
  if (definition.type === "color" && !/^#[0-9a-f]{6}$/i.test(normalized)) {
    throw new SiteSettingValidationError("Màu phải ở định dạng hex, ví dụ #6cbe45.");
  }
  if ((definition.type === "url" || definition.type === "image") && normalized && !isSafeUrl(normalized)) {
    throw new SiteSettingValidationError("URL chỉ được dùng http(s), mailto, tel hoặc đường dẫn nội bộ.");
  }
  return normalized;
}

function isSafeUrl(value: string): boolean {
  if (value.startsWith("/") || value.startsWith("#")) return true;
  try {
    const url = new URL(value);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol);
  } catch {
    return false;
  }
}

async function getSettingRow(database: D1DatabaseLike, key: SiteSettingKey): Promise<SiteSettingRow | null> {
  return database.prepare(`
    SELECT setting_key, group_name, label, description, value_type,
      draft_value, published_value, version, updated_by, updated_at, published_by, published_at
    FROM site_settings WHERE setting_key = ? LIMIT 1
  `).bind(key).first<SiteSettingRow>();
}

async function getSettingRowOrThrow(database: D1DatabaseLike, key: SiteSettingKey): Promise<SiteSettingRow> {
  const row = await getSettingRow(database, key);
  if (!row) throw new SiteSettingNotFoundError("Không tìm thấy setting.");
  return row;
}

function toAdminSiteSetting(row: SiteSettingRow): AdminSiteSetting {
  return {
    key: row.setting_key,
    group: row.group_name,
    label: row.label,
    description: row.description,
    type: row.value_type,
    draftValue: row.draft_value,
    publishedValue: row.published_value,
    version: row.version,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
    publishedBy: row.published_by,
    publishedAt: row.published_at,
    dirty: row.draft_value !== row.published_value,
  };
}
