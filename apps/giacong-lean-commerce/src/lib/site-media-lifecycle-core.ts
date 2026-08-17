import type { D1DatabaseLike, D1PreparedStatementLike } from "./admin-data.ts";
import { extensionForMediaType, type AllowedMediaContentType } from "./media-upload-policy.ts";
import {
  SiteSettingConflictError,
  SiteSettingNotFoundError,
  type AdminSiteSetting,
  type SiteSettingGroup,
  type SiteSettingKey,
  type SiteSettingType,
} from "./site-settings.ts";

export interface SiteMediaLifecycleBucketLike {
  put(
    key: string,
    value: ArrayBuffer,
    options?: {
      customMetadata?: Record<string, string>;
      httpMetadata?: { contentType?: string };
    },
  ): Promise<unknown>;
  delete(key: string): Promise<unknown>;
}

export interface SiteMediaLifecycleAsset {
  byteSize: number;
  checksumSha256: string;
  contentType: string;
  createdAt: string;
  id: string;
  originalFilename: string;
  publicUrl: string;
  settingKey: string;
  status: "active" | "deleted" | "replaced";
  storageKey: string;
}

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

interface SiteMediaRow {
  byte_size: number;
  checksum_sha256: string;
  content_type: string;
  created_at: string;
  id: string;
  original_filename: string;
  setting_key: string;
  status: SiteMediaLifecycleAsset["status"];
  storage_key: string;
}

export async function createAndActivateSiteMedia(
  database: D1DatabaseLike,
  bucket: SiteMediaLifecycleBucketLike,
  input: {
    actorSubject: string;
    bytes: ArrayBuffer;
    checksumSha256: string;
    contentType: AllowedMediaContentType;
    expectedVersion: number;
    originalFilename: string;
    settingKey: SiteSettingKey;
  },
): Promise<{ media: SiteMediaLifecycleAsset; setting: AdminSiteSetting }> {
  const current = await getSettingRow(database, input.settingKey);
  if (!current) throw new SiteSettingNotFoundError("Không tìm thấy setting ảnh website.");
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1 || current.version !== input.expectedVersion) {
    throw new SiteSettingConflictError("Setting đã thay đổi ở phiên khác. Hãy tải lại trước khi upload ảnh.");
  }

  const batchDatabase = requireBatch(database);
  const assetId = crypto.randomUUID();
  const auditMarkerId = crypto.randomUUID();
  const storageKey = `site-settings/${input.settingKey}/${assetId}${extensionForMediaType(input.contentType)}`;
  const publicUrl = `/media/${storageKey}`;

  await bucket.put(storageKey, input.bytes, {
    customMetadata: { assetId, settingKey: input.settingKey },
    httpMetadata: { contentType: input.contentType },
  });

  const statements: D1PreparedStatementLike[] = [
    database.prepare(`
      INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
      SELECT ?, ?, 'site_setting.updated', 'site_setting', ?, ?
      WHERE EXISTS (
        SELECT 1 FROM site_settings
        WHERE setting_key = ? AND version = ?
      )
      RETURNING id
    `).bind(
      auditMarkerId,
      input.actorSubject,
      input.settingKey,
      JSON.stringify({
        assetId,
        expectedVersion: input.expectedVersion,
        via: "site_media_upload",
      }),
      input.settingKey,
      input.expectedVersion,
    ),
    database.prepare(`
      INSERT INTO site_media_assets (
        id, setting_key, storage_key, original_filename, content_type,
        byte_size, checksum_sha256, created_by
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)
    `).bind(
      assetId,
      input.settingKey,
      storageKey,
      input.originalFilename,
      input.contentType,
      input.bytes.byteLength,
      input.checksumSha256,
      input.actorSubject,
      auditMarkerId,
    ),
    database.prepare(`
      INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
      SELECT ?, ?, 'site_media.created', 'site_media', ?, ?
      WHERE EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)
    `).bind(
      crypto.randomUUID(),
      input.actorSubject,
      assetId,
      JSON.stringify({
        byteSize: input.bytes.byteLength,
        checksumSha256: input.checksumSha256,
        contentType: input.contentType,
        settingKey: input.settingKey,
      }),
      auditMarkerId,
    ),
    database.prepare(`
      UPDATE site_settings
      SET draft_value = ?, version = version + 1,
        updated_by = ?, updated_at = CURRENT_TIMESTAMP
      WHERE setting_key = ? AND version = ?
        AND EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)
    `).bind(
      publicUrl,
      input.actorSubject,
      input.settingKey,
      input.expectedVersion,
      auditMarkerId,
    ),
    database.prepare(`
      UPDATE site_media_assets
      SET status = 'replaced', updated_at = CURRENT_TIMESTAMP
      WHERE setting_key = ? AND status = 'active' AND id <> ?
        AND EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)
    `).bind(input.settingKey, assetId, auditMarkerId),
  ];

  let results: D1BatchResultLike[];
  try {
    results = await batchDatabase.batch(statements);
  } catch (error) {
    await bucket.delete(storageKey).catch(() => undefined);
    throw error;
  }

  if (!markerCreated(results[0]?.results)) {
    await bucket.delete(storageKey).catch(() => undefined);
    throw new SiteSettingConflictError("Setting đã thay đổi ở phiên khác. Hãy tải lại trước khi upload ảnh.");
  }

  const [mediaRow, settingRow] = await Promise.all([
    getSiteMediaRow(database, assetId),
    getSettingRow(database, input.settingKey),
  ]);
  if (!mediaRow || !settingRow) throw new Error("Không đọc lại được media website vừa kích hoạt.");
  return { media: toSiteMediaAsset(mediaRow), setting: toAdminSiteSetting(settingRow) };
}

export async function cleanupSiteMediaAsset(
  database: D1DatabaseLike,
  bucket: SiteMediaLifecycleBucketLike,
  input: { actorSubject: string; assetId: string },
): Promise<void> {
  const row = await getSiteMediaRow(database, input.assetId);
  if (!row) return;

  if (row.status !== "deleted") {
    const batchDatabase = requireBatch(database);
    const auditId = crypto.randomUUID();
    const results = await batchDatabase.batch([
      database.prepare(`
        INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
        SELECT ?, ?, 'site_media.deleted', 'site_media', ?, ?
        WHERE EXISTS (
          SELECT 1 FROM site_media_assets
          WHERE id = ? AND status <> 'deleted'
        )
        RETURNING id
      `).bind(
        auditId,
        input.actorSubject,
        row.id,
        JSON.stringify({ compensation: true, settingKey: row.setting_key }),
        row.id,
      ),
      database.prepare(`
        UPDATE site_media_assets
        SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status <> 'deleted'
          AND EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)
      `).bind(row.id, auditId),
    ]);

    if (!markerCreated(results[0]?.results)) {
      const latest = await getSiteMediaRow(database, input.assetId);
      if (!latest || latest.status !== "deleted") {
        throw new Error("Không thể đánh dấu media website đã xóa.");
      }
    }
  }

  await bucket.delete(row.storage_key);
}

function requireBatch(database: D1DatabaseLike): D1BatchDatabaseLike {
  const candidate = database as D1DatabaseLike & { batch?: D1BatchDatabaseLike["batch"] };
  if (typeof candidate.batch !== "function") {
    throw new Error("D1 batch() là bắt buộc để thay đổi media website an toàn.");
  }
  return candidate as D1BatchDatabaseLike;
}

function markerCreated(rows: unknown[] | undefined): boolean {
  return Array.isArray(rows) && rows.length === 1;
}

async function getSettingRow(database: D1DatabaseLike, key: SiteSettingKey): Promise<SiteSettingRow | null> {
  return database.prepare(`
    SELECT setting_key, group_name, label, description, value_type,
      draft_value, published_value, version, updated_by, updated_at, published_by, published_at
    FROM site_settings WHERE setting_key = ? LIMIT 1
  `).bind(key).first<SiteSettingRow>();
}

async function getSiteMediaRow(database: D1DatabaseLike, id: string): Promise<SiteMediaRow | null> {
  return database.prepare(`
    SELECT id, setting_key, storage_key, original_filename, content_type,
      byte_size, checksum_sha256, status, created_at
    FROM site_media_assets WHERE id = ? LIMIT 1
  `).bind(id).first<SiteMediaRow>();
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

function toSiteMediaAsset(row: SiteMediaRow): SiteMediaLifecycleAsset {
  return {
    byteSize: row.byte_size,
    checksumSha256: row.checksum_sha256,
    contentType: row.content_type,
    createdAt: row.created_at,
    id: row.id,
    originalFilename: row.original_filename,
    publicUrl: `/media/${row.storage_key}`,
    settingKey: row.setting_key,
    status: row.status,
    storageKey: row.storage_key,
  };
}
