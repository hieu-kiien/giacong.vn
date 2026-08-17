import "server-only";

import type { D1DatabaseLike, D1PreparedStatementLike } from "./admin-data";
import type { MediaAsset, R2BucketLike } from "./media-data";

interface D1BatchResultLike {
  results?: unknown[];
}

interface D1BatchDatabaseLike extends D1DatabaseLike {
  batch(statements: D1PreparedStatementLike[]): Promise<D1BatchResultLike[]>;
}

interface MediaRow {
  alt_text: string | null;
  byte_size: number;
  checksum_sha256: string;
  content_type: string;
  created_at: string;
  id: string;
  namespace: MediaAsset["namespace"];
  original_filename: string;
  product_id: number | null;
  service_id: number | null;
  status: MediaAsset["status"];
  storage_key: string;
  updated_at: string;
  variant_id: number | null;
}

export interface MediaReferenceCounts {
  product: number;
  siteSetting: number;
  variant: number;
}

export class MediaAssetInUseError extends Error {
  readonly references: MediaReferenceCounts;

  constructor(references: MediaReferenceCounts) {
    super("Media đang được nội dung website sử dụng. Hãy gỡ tham chiếu trước khi xóa.");
    this.name = "MediaAssetInUseError";
    this.references = references;
  }
}

export class MediaDeleteConflictError extends Error {
  constructor() {
    super("Trạng thái media đã thay đổi. Hãy tải lại trước khi xóa.");
    this.name = "MediaDeleteConflictError";
  }
}

/**
 * Reference-safe cross-system delete.
 *
 * D1 is changed first: a fresh audit marker is created only if the media is not
 * referenced at transaction time, and the soft-delete is guarded by that marker.
 * R2 is deleted only after the canonical D1 state is safely committed. If R2
 * deletion fails, a retry is safe because an already-soft-deleted row simply
 * retries the idempotent object deletion without writing another audit record.
 */
export async function deleteMediaAssetSafely(
  database: D1DatabaseLike,
  bucket: R2BucketLike,
  assetId: string,
  actorSubject: string,
): Promise<MediaAsset | null> {
  const initial = await getMediaRow(database, assetId);
  if (!initial) return null;
  const publicUrl = toPublicUrl(initial.storage_key);

  const preflightReferences = await readMediaReferences(database, publicUrl);
  if (hasReferences(preflightReferences)) throw new MediaAssetInUseError(preflightReferences);

  if (initial.status !== "deleted") {
    const batchDatabase = requireBatch(database);
    const auditId = crypto.randomUUID();
    const statements: D1PreparedStatementLike[] = [
      database.prepare(`
        INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
        SELECT ?, ?, 'media.deleted', 'media', ?, ?
        WHERE EXISTS (
          SELECT 1 FROM media_assets WHERE id = ? AND status <> 'deleted'
        )
          AND NOT EXISTS (SELECT 1 FROM products WHERE image_url = ?)
          AND NOT EXISTS (SELECT 1 FROM product_variants WHERE image_url = ?)
          AND NOT EXISTS (
            SELECT 1 FROM site_settings
            WHERE draft_value = ? OR published_value = ?
          )
        RETURNING id
      `).bind(
        auditId,
        actorSubject,
        assetId,
        JSON.stringify({
          namespace: initial.namespace,
          publicUrl,
          storageKey: initial.storage_key,
        }),
        assetId,
        publicUrl,
        publicUrl,
        publicUrl,
        publicUrl,
      ),
      database.prepare(`
        UPDATE media_assets
        SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
          AND EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)
      `).bind(assetId, auditId),
    ];

    const results = await batchDatabase.batch(statements);
    const markerRows = results[0]?.results;
    if (!Array.isArray(markerRows) || markerRows.length !== 1) {
      const references = await readMediaReferences(database, publicUrl);
      if (hasReferences(references)) throw new MediaAssetInUseError(references);
      const current = await getMediaRow(database, assetId);
      if (!current) return null;
      if (current.status !== "deleted") throw new MediaDeleteConflictError();
    }
  }

  // Delete from R2 only after D1 says the asset is deleted. A failed object delete
  // leaves an unreferenced object, not a broken canonical URL, and can be retried.
  await bucket.delete(initial.storage_key);
  const deleted = await getMediaRow(database, assetId);
  return deleted ? toMediaAsset(deleted) : toMediaAsset({ ...initial, status: "deleted" });
}

async function readMediaReferences(
  database: D1DatabaseLike,
  publicUrl: string,
): Promise<MediaReferenceCounts> {
  const row = await database.prepare(`
    SELECT
      (SELECT COUNT(*) FROM products WHERE image_url = ?) AS product_refs,
      (SELECT COUNT(*) FROM product_variants WHERE image_url = ?) AS variant_refs,
      (
        SELECT COUNT(*) FROM site_settings
        WHERE draft_value = ? OR published_value = ?
      ) AS site_setting_refs
  `).bind(publicUrl, publicUrl, publicUrl, publicUrl).first<{
    product_refs: number;
    site_setting_refs: number;
    variant_refs: number;
  }>();
  return {
    product: integer(row?.product_refs),
    siteSetting: integer(row?.site_setting_refs),
    variant: integer(row?.variant_refs),
  };
}

async function getMediaRow(database: D1DatabaseLike, assetId: string): Promise<MediaRow | null> {
  return database.prepare(`
    SELECT id, namespace, product_id, variant_id, service_id, storage_key,
      original_filename, content_type, byte_size, checksum_sha256, alt_text,
      status, created_at, updated_at
    FROM media_assets
    WHERE id = ?
    LIMIT 1
  `).bind(assetId).first<MediaRow>();
}

function hasReferences(references: MediaReferenceCounts): boolean {
  return references.product > 0 || references.variant > 0 || references.siteSetting > 0;
}

function integer(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function toPublicUrl(storageKey: string): string {
  return `/media/${storageKey}`;
}

function toMediaAsset(row: MediaRow): MediaAsset {
  return {
    altText: row.alt_text,
    byteSize: row.byte_size,
    checksumSha256: row.checksum_sha256,
    contentType: row.content_type,
    createdAt: row.created_at,
    id: row.id,
    namespace: row.namespace,
    originalFilename: row.original_filename,
    productId: row.product_id,
    publicUrl: toPublicUrl(row.storage_key),
    serviceId: row.service_id,
    status: row.status,
    storageKey: row.storage_key,
    updatedAt: row.updated_at,
    variantId: row.variant_id,
  };
}

function requireBatch(database: D1DatabaseLike): D1BatchDatabaseLike {
  const candidate = database as D1DatabaseLike & { batch?: D1BatchDatabaseLike["batch"] };
  if (typeof candidate.batch !== "function") {
    throw new Error("D1 batch() là bắt buộc để xóa media an toàn.");
  }
  return candidate as D1BatchDatabaseLike;
}
