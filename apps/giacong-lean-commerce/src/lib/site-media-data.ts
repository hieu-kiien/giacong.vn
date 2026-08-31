import "server-only";

import { tableExists, type D1DatabaseLike, type D1PreparedStatementLike } from "./admin-data";
import { isAdminRequestId } from "./admin-request.ts";
import type { R2BucketLike } from "./media-data";

export interface SiteMediaAsset {
  byteSize: number;
  checksumSha256: string;
  contentType: string;
  createdAt: string;
  id: string;
  originalFilename: string;
  settingKey: string;
  status: "active" | "deleted" | "replaced";
  storageKey: string;
  publicUrl: string;
  revision: number;
}

interface SiteMediaRow {
  byte_size: number;
  checksum_sha256: string;
  content_type: string;
  created_at: string;
  id: string;
  original_filename: string;
  setting_key: string;
  status: SiteMediaAsset["status"];
  storage_key: string;
  revision: number;
}

export class SiteMediaStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SiteMediaStorageError";
  }
}

export class SiteMediaConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SiteMediaConflictError";
  }
}

export class SiteMediaIdempotencyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SiteMediaIdempotencyConflictError";
  }
}

export async function createSiteMediaAsset(
  database: D1DatabaseLike,
  bucket: R2BucketLike,
  input: {
    bytes: ArrayBuffer;
    checksumSha256: string;
    contentType: string;
    createdBy: string;
    originalFilename: string;
    requestId?: string;
    settingKey: string;
  },
): Promise<SiteMediaAsset> {
  const normalizedRequestId = normalizeRequestId(input.requestId);
  const actorSubject = normalizeActor(input.createdBy);
  const payloadSha256 = await fingerprint({
    byteSize: input.bytes.byteLength,
    checksumSha256: input.checksumSha256,
    contentType: input.contentType,
    entityType: "site_media_asset",
    operation: "create",
    originalFilename: input.originalFilename,
    settingKey: input.settingKey,
  });
  await requireSiteMediaAuditTables(database);
  const existingMutation = await findSiteMediaMutation(database, normalizedRequestId);
  if (existingMutation) {
    assertMatchingSiteMediaMutation(existingMutation, "create", payloadSha256);
    return readSiteMediaMutation(database, existingMutation);
  }

  const id = crypto.randomUUID();
  const storageKey = `site-settings/${input.settingKey}/${id}${extensionFor(input.contentType)}`;

  await bucket.put(storageKey, input.bytes, {
    customMetadata: { assetId: id, settingKey: input.settingKey },
    httpMetadata: { contentType: input.contentType },
  });

  try {
    const databaseWithBatch = requireBatch(database);
    const results = await databaseWithBatch.batch([
      database.prepare(`
        INSERT INTO site_media_assets (
          id, setting_key, storage_key, original_filename, content_type,
          byte_size, checksum_sha256, created_by, revision, last_request_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      `).bind(
        id,
        input.settingKey,
        storageKey,
        input.originalFilename,
        input.contentType,
        input.bytes.byteLength,
        input.checksumSha256,
        actorSubject,
        normalizedRequestId,
      ),
      buildSiteMediaAudit(database, normalizedRequestId, actorSubject, "create", id, payloadSha256),
    ]);
    if (!hasRows(results[0]) || !hasRows(results[1])) throw new SiteMediaStorageError("Media website chưa ghi đủ metadata và audit.");
  } catch (error) {
    await bucket.delete(storageKey).catch(() => undefined);
    const racedMutation = await findSiteMediaMutation(database, normalizedRequestId);
    if (racedMutation) {
      assertMatchingSiteMediaMutation(racedMutation, "create", payloadSha256);
      return readSiteMediaMutation(database, racedMutation);
    }
    throw error;
  }

  const mutation = await findSiteMediaMutation(database, normalizedRequestId);
  if (!mutation) throw new SiteMediaStorageError("Không đọc lại được audit media website vừa upload.");
  assertMatchingSiteMediaMutation(mutation, "create", payloadSha256);
  return readSiteMediaMutation(database, mutation);
}

export async function replaceActiveSiteMedia(
  database: D1DatabaseLike,
  settingKey: string,
  exceptId: string,
  actorSubject = "system",
  requestId?: string,
): Promise<void> {
  const rows = await database.prepare(`
    SELECT id, revision
    FROM site_media_assets
    WHERE setting_key = ? AND status = 'active' AND id <> ?
    ORDER BY id ASC
    LIMIT 100
  `).bind(settingKey, exceptId).all<{ id: string; revision: number }>();
  if (rows.results.length === 0) return;
  await requireSiteMediaAuditTables(database);
  const databaseWithBatch = requireBatch(database);
  const statements: D1PreparedStatementLike[] = [];
  for (const row of rows.results) {
    const childRequestId = crypto.randomUUID();
    const payloadSha256 = await fingerprint({
      entityType: "site_media_asset",
      expectedRevision: row.revision,
      id: row.id,
      operation: "update",
      parentRequestId: requestId ?? null,
      status: "replaced",
    });
    statements.push(
      database.prepare(`
        UPDATE site_media_assets
        SET status = 'replaced', revision = revision + 1, last_request_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'active' AND revision = ?
      `).bind(childRequestId, row.id, row.revision),
      buildSiteMediaAudit(database, childRequestId, actorSubject, "update", row.id, payloadSha256, row.revision, "replaced"),
      buildLegacySiteMediaAudit(database, actorSubject, "site_media.replaced", row.id, payloadSha256, row.revision, childRequestId, "replaced"),
    );
  }
  const results = await databaseWithBatch.batch(statements);
  for (let index = 0; index < results.length; index += 3) {
    if (!hasRows(results[index]) || !hasRows(results[index + 1]) || !hasRows(results[index + 2])) {
      throw new SiteMediaStorageError("Không thể ghi trạng thái replaced và audit media website đồng bộ.");
    }
  }
}

export async function deleteSiteMediaAsset(
  database: D1DatabaseLike,
  bucket: R2BucketLike,
  assetId: string,
  expectedRevisionRaw: unknown = 1,
  actorSubject = "system",
  requestId?: string,
): Promise<void> {
  const normalizedRequestId = normalizeRequestId(requestId);
  const expectedRevision = requireRevision(expectedRevisionRaw);
  const normalizedActor = normalizeActor(actorSubject);
  const normalizedAssetId = normalizeAssetId(assetId);
  const payloadSha256 = await fingerprint({
    actorSubject: normalizedActor,
    entityType: "site_media_asset",
    expectedRevision,
    id: normalizedAssetId,
    operation: "delete",
  });
  await requireSiteMediaAuditTables(database);
  const existingMutation = await findSiteMediaMutation(database, normalizedRequestId);
  if (existingMutation) {
    assertMatchingSiteMediaMutation(existingMutation, "delete", payloadSha256);
    const replayed = await readSiteMediaMutation(database, existingMutation);
    await bucket.delete(replayed.storageKey);
    return;
  }

  const row = await getSiteMediaRow(database, normalizedAssetId);
  if (!row) return;
  if (row.revision !== expectedRevision) throw new SiteMediaConflictError("Media website đã thay đổi ở phiên khác. Hãy tải lại rồi thử lại.");
  if (row.status === "deleted") return;

  const databaseWithBatch = requireBatch(database);
  const results = await databaseWithBatch.batch([
    database.prepare(`
      UPDATE site_media_assets
      SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP,
        revision = revision + 1, last_request_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND revision = ? AND status <> 'deleted'
    `).bind(normalizedRequestId, normalizedAssetId, expectedRevision),
    buildSiteMediaAudit(database, normalizedRequestId, normalizedActor, "delete", normalizedAssetId, payloadSha256, expectedRevision, "deleted"),
    buildLegacySiteMediaAudit(database, normalizedActor, "site_media.deleted", normalizedAssetId, payloadSha256, expectedRevision, normalizedRequestId, "deleted"),
  ]);
  if (!hasRows(results[0])) throw new SiteMediaConflictError("Media website đã thay đổi ở phiên khác. Hãy tải lại rồi thử lại.");
  if (!hasRows(results[1]) || !hasRows(results[2])) throw new SiteMediaStorageError("Media website chưa ghi đủ audit xóa đồng bộ.");
  await bucket.delete(row.storage_key);
}

async function getSiteMediaRow(database: D1DatabaseLike, id: string): Promise<SiteMediaRow | null> {
  return database.prepare(`
    SELECT id, setting_key, storage_key, original_filename, content_type,
      byte_size, checksum_sha256, status, revision, created_at
    FROM site_media_assets WHERE id = ? LIMIT 1
  `).bind(id).first<SiteMediaRow>();
}

interface SiteMediaMutationRow {
  action: "create" | "update" | "delete";
  entity_key: string;
  entity_type: "site_media_asset";
  payload_sha256: string;
  request_id: string;
}

interface D1BatchResultLike {
  meta?: { changes?: unknown };
}

interface D1DatabaseWithBatch extends D1DatabaseLike {
  batch(statements: D1PreparedStatementLike[]): Promise<D1BatchResultLike[]>;
}

async function requireSiteMediaAuditTables(database: D1DatabaseLike): Promise<void> {
  const [hasMediaAudit, hasLegacyAudit] = await Promise.all([
    tableExists(database, "admin_media_audit"),
    tableExists(database, "audit_logs"),
  ]);
  if (!hasMediaAudit || !hasLegacyAudit) throw new SiteMediaStorageError("Các bảng audit media website chưa được triển khai.");
}

async function findSiteMediaMutation(database: D1DatabaseLike, requestId: string): Promise<SiteMediaMutationRow | null> {
  return database.prepare(`
    SELECT action, entity_key, entity_type, payload_sha256, request_id
    FROM admin_media_audit
    WHERE request_id = ? AND entity_type = 'site_media_asset'
    LIMIT 1
  `).bind(requestId).first<SiteMediaMutationRow>();
}

async function readSiteMediaMutation(database: D1DatabaseLike, mutation: SiteMediaMutationRow): Promise<SiteMediaAsset> {
  const row = await getSiteMediaRow(database, normalizeAssetId(mutation.entity_key));
  if (!row) throw new SiteMediaStorageError("Không đọc lại được kết quả media website từ audit.");
  return toSiteMediaAsset(row);
}

function assertMatchingSiteMediaMutation(
  mutation: SiteMediaMutationRow,
  action: SiteMediaMutationRow["action"],
  payloadSha256: string,
): void {
  if (mutation.action !== action || mutation.payload_sha256 !== payloadSha256) {
    throw new SiteMediaIdempotencyConflictError("requestId đã được dùng cho một payload media website khác.");
  }
}

function buildSiteMediaAudit(
  database: D1DatabaseLike,
  requestId: string,
  actorSubject: string,
  action: "create" | "update" | "delete",
  entityId: string,
  payloadSha256: string,
  previousRevision?: number,
  resultingStatus?: SiteMediaAsset["status"],
): D1PreparedStatementLike {
  return action === "create"
    ? database.prepare(`
      INSERT INTO admin_media_audit (
        request_id, actor_subject, action, entity_type, entity_key,
        previous_revision, resulting_revision, payload_sha256
      ) VALUES (?, ?, 'create', 'site_media_asset', ?, NULL, 1, ?)
    `).bind(requestId, actorSubject, entityId, payloadSha256)
    : database.prepare(`
      INSERT INTO admin_media_audit (
        request_id, actor_subject, action, entity_type, entity_key,
        previous_revision, resulting_revision, payload_sha256
      )
      SELECT ?, ?, ?, 'site_media_asset', ?, ?, ?, ?
      FROM site_media_assets
      WHERE id = ? AND status = ? AND revision = ? AND last_request_id = ?
    `).bind(
      requestId,
      actorSubject,
      action,
      entityId,
      previousRevision,
      (previousRevision ?? 0) + 1,
      payloadSha256,
      entityId,
      resultingStatus,
      (previousRevision ?? 0) + 1,
      requestId,
    );
}

function buildLegacySiteMediaAudit(
  database: D1DatabaseLike,
  actorSubject: string,
  action: "site_media.replaced" | "site_media.deleted",
  entityId: string,
  payloadSha256: string,
  expectedRevision?: number,
  requestId?: string,
  resultingStatus?: SiteMediaAsset["status"],
): D1PreparedStatementLike {
  const metadata = JSON.stringify({ expectedRevision, payloadSha256 });
  return expectedRevision === undefined
    ? database.prepare(`
      INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
      VALUES (?, ?, '${action}', 'site_media_asset', ?, ?)
    `).bind(crypto.randomUUID(), actorSubject, entityId, metadata)
    : database.prepare(`
      INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
      SELECT ?, ?, '${action}', 'site_media_asset', ?, ?
      FROM site_media_assets
      WHERE id = ? AND status = ? AND revision = ? AND last_request_id = ?
    `).bind(
      crypto.randomUUID(),
      actorSubject,
      entityId,
      metadata,
      entityId,
      resultingStatus,
      expectedRevision + 1,
      requestId ?? "",
    );
}

function requireBatch(database: D1DatabaseLike): D1DatabaseWithBatch {
  const databaseWithBatch = database as D1DatabaseWithBatch;
  if (typeof databaseWithBatch.batch !== "function") throw new SiteMediaStorageError("D1 atomic batch chưa sẵn sàng cho media website.");
  return databaseWithBatch;
}

function hasRows(result: unknown): boolean {
  if (typeof result !== "object" || result === null) return true;
  const changes = (result as D1BatchResultLike).meta?.changes;
  return changes === undefined || Number(changes) > 0;
}

function normalizeRequestId(value?: string): string {
  const requestId = value?.trim().toLowerCase() ?? crypto.randomUUID();
  if (!isAdminRequestId(requestId)) throw new SiteMediaStorageError("requestId phải là UUID hợp lệ.");
  return requestId;
}

function normalizeActor(value: string): string {
  const actor = value.trim();
  if (!actor || actor.length > 255) throw new SiteMediaStorageError("createdBy không hợp lệ.");
  return actor;
}

function normalizeAssetId(value: string): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new SiteMediaStorageError("id media website không hợp lệ.");
  }
  return value.toLowerCase();
}

function requireRevision(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) throw new SiteMediaStorageError("revision không hợp lệ.");
  return value;
}

async function fingerprint(input: Record<string, unknown>): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(input));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toSiteMediaAsset(row: SiteMediaRow): SiteMediaAsset {
  return {
    byteSize: row.byte_size,
    checksumSha256: row.checksum_sha256,
    contentType: row.content_type,
    createdAt: row.created_at,
    id: row.id,
    originalFilename: row.original_filename,
    publicUrl: `/media/${row.storage_key}`,
    revision: row.revision,
    settingKey: row.setting_key,
    status: row.status,
    storageKey: row.storage_key,
  };
}

function extensionFor(contentType: string): string {
  return contentType === "image/jpeg" ? ".jpg"
    : contentType === "image/png" ? ".png"
      : contentType === "image/webp" ? ".webp"
        : ".avif";
}
