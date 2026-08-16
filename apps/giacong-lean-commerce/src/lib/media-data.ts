import "server-only";

import type { D1DatabaseLike } from "./admin-data";

export interface R2BucketLike {
  delete(key: string): Promise<void>;
  list?(options?: { cursor?: string; limit?: number; prefix?: string }): Promise<{
    objects: Array<{ key: string }>;
    truncated: boolean;
    cursor?: string;
  }>;
  put(
    key: string,
    value: ArrayBuffer,
    options?: {
      customMetadata?: Record<string, string>;
      httpMetadata?: { contentType?: string };
    },
  ): Promise<unknown>;
}

export interface MediaAsset {
  altText: string | null;
  byteSize: number;
  checksumSha256: string;
  contentType: string;
  createdAt: string;
  id: string;
  namespace: "product" | "service" | "variant";
  originalFilename: string;
  productId: number | null;
  publicUrl: string;
  serviceId: number | null;
  status: "active" | "deleted" | "orphaned" | "replaced";
  storageKey: string;
  updatedAt: string;
  variantId: number | null;
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

export async function listMediaAssets(
  database: D1DatabaseLike,
  input: { productId?: number; serviceId?: number; variantId?: number; includeDeleted?: boolean },
): Promise<MediaAsset[]> {
  const filters: string[] = [];
  const params: unknown[] = [];
  if (input.productId) {
    filters.push("product_id = ?");
    params.push(input.productId);
  }
  if (input.variantId) {
    filters.push("variant_id = ?");
    params.push(input.variantId);
  }
  if (input.serviceId) {
    filters.push("service_id = ?");
    params.push(input.serviceId);
  }
  if (!input.includeDeleted) filters.push("status = 'active'");
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const rows = await database.prepare(`
    SELECT id, namespace, product_id, variant_id, service_id, storage_key,
      original_filename, content_type, byte_size, checksum_sha256, alt_text,
      status, created_at, updated_at
    FROM media_assets
    ${where}
    ORDER BY created_at DESC
  `).bind(...params).all<MediaRow>();
  return rows.results.map(toMediaAsset);
}

export async function createMediaAsset(
  database: D1DatabaseLike,
  bucket: R2BucketLike,
  input: {
    altText: string | null;
    bytes: ArrayBuffer;
    checksumSha256: string;
    contentType: string;
    createdBy: string;
    originalFilename: string;
    productId: number | null;
    serviceId: number | null;
    variantId: number | null;
  },
): Promise<MediaAsset> {
  const id = crypto.randomUUID();
  const scope = input.serviceId
    ? `services/${input.serviceId}`
    : input.variantId
    ? `products/${input.productId}/variants/${input.variantId}`
    : `products/${input.productId}`;
  const extension = extensionFor(input.contentType);
  const storageKey = `${scope}/${id}${extension}`;
  await bucket.put(storageKey, input.bytes, {
    customMetadata: {
      assetId: id,
      ...(input.productId ? { productId: String(input.productId) } : {}),
      ...(input.serviceId ? { serviceId: String(input.serviceId) } : {}),
      ...(input.variantId ? { variantId: String(input.variantId) } : {}),
    },
    httpMetadata: { contentType: input.contentType },
  });

  try {
    await database.prepare(`
      INSERT INTO media_assets (
        id, namespace, product_id, variant_id, service_id, storage_key, original_filename,
        content_type, byte_size, checksum_sha256, alt_text, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      input.serviceId ? "service" : input.variantId ? "variant" : "product",
      input.productId,
      input.variantId,
      input.serviceId,
      storageKey,
      input.originalFilename,
      input.contentType,
      input.bytes.byteLength,
      input.checksumSha256,
      input.altText,
      input.createdBy,
    ).run();
  } catch (error) {
    await bucket.delete(storageKey).catch(() => undefined);
    throw error;
  }

  const created = await database.prepare(`
    SELECT id, namespace, product_id, variant_id, service_id, storage_key,
      original_filename, content_type, byte_size, checksum_sha256, alt_text,
      status, created_at, updated_at
    FROM media_assets WHERE id = ? LIMIT 1
  `).bind(id).first<MediaRow>();
  if (!created) throw new Error("Không đọc lại được media vừa upload.");
  return toMediaAsset(created);
}

export async function deleteMediaAsset(
  database: D1DatabaseLike,
  bucket: R2BucketLike,
  assetId: string,
): Promise<MediaAsset | null> {
  const row = await database.prepare(`
    SELECT id, namespace, product_id, variant_id, service_id, storage_key,
      original_filename, content_type, byte_size, checksum_sha256, alt_text,
      status, created_at, updated_at
    FROM media_assets WHERE id = ? LIMIT 1
  `).bind(assetId).first<MediaRow>();
  if (!row) return null;
  if (row.status === "active") await bucket.delete(row.storage_key);
  await database.prepare(`
    UPDATE media_assets
    SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(assetId).run();
  return toMediaAsset({ ...row, status: "deleted" });
}

export async function updateMediaAssetAltText(
  database: D1DatabaseLike,
  assetId: string,
  altText: string | null,
): Promise<MediaAsset | null> {
  await database.prepare(`
    UPDATE media_assets
    SET alt_text = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'active'
  `).bind(altText, assetId).run();
  const row = await database.prepare(`
    SELECT id, namespace, product_id, variant_id, service_id, storage_key,
      original_filename, content_type, byte_size, checksum_sha256, alt_text,
      status, created_at, updated_at
    FROM media_assets WHERE id = ? LIMIT 1
  `).bind(assetId).first<MediaRow>();
  return row ? toMediaAsset(row) : null;
}

export async function cleanupOrphanedMediaAssets(
  database: D1DatabaseLike,
  bucket: R2BucketLike,
  limit = 100,
): Promise<{ deleted: number; scanned: number }> {
  if (!bucket.list) throw new Error("R2 media bucket does not support list().");
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 500);
  const [knownRows, knownSiteRows] = await Promise.all([
    database.prepare(`
      SELECT storage_key, status
      FROM media_assets
      WHERE status IN ('active', 'replaced', 'deleted', 'orphaned')
    `).all<{ storage_key: string; status: MediaAsset["status"] }>(),
    database.prepare(`
      SELECT storage_key, status
      FROM site_media_assets
      WHERE status IN ('active', 'replaced', 'deleted')
    `).all<{ storage_key: string; status: "active" | "replaced" | "deleted" }>(),
  ]);
  const known = new Map([
    ...knownRows.results.map((row) => [row.storage_key, row.status] as const),
    ...knownSiteRows.results.map((row) => [row.storage_key, row.status] as const),
  ]);
  const objects: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ cursor, limit: safeLimit });
    objects.push(...page.objects.map((object) => object.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor && objects.length < safeLimit);

  let deleted = 0;
  for (const key of objects.slice(0, safeLimit)) {
    const status = known.get(key);
    if (status === "active") continue;
    await bucket.delete(key);
    deleted += 1;
    if (status) {
      await database.prepare(`
        UPDATE media_assets
        SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE storage_key = ?
      `).bind(key).run();
    }
  }
  return { deleted, scanned: objects.length };
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
    publicUrl: `/media/${row.storage_key}`,
    serviceId: row.service_id,
    status: row.status,
    storageKey: row.storage_key,
    updatedAt: row.updated_at,
    variantId: row.variant_id,
  };
}

function extensionFor(contentType: string): string {
  return contentType === "image/jpeg" ? ".jpg"
    : contentType === "image/png" ? ".png"
      : contentType === "image/webp" ? ".webp"
        : ".avif";
}