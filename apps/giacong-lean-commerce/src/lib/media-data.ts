import "server-only";

import { tableExists, type D1DatabaseLike, type D1PreparedStatementLike } from "./admin-data.ts";
import { isAdminRequestId } from "./admin-request.ts";

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
  revision: number;
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
  revision: number;
}

export async function listMediaAssets(
  database: D1DatabaseLike,
  input: { all?: boolean; productId?: number; serviceId?: number; variantId?: number; includeDeleted?: boolean },
): Promise<MediaAsset[]> {
  const filters: string[] = [];
  const params: unknown[] = [];
  if (input.all) {
    // Library-wide listing for the media picker; entity filters take precedence.
  } else {
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
  }
  if (!input.includeDeleted) filters.push("status = 'active'");
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const rows = await database.prepare(`
    SELECT id, namespace, product_id, variant_id, service_id, storage_key,
      original_filename, content_type, byte_size, checksum_sha256, alt_text,
      status, revision, created_at, updated_at
    FROM media_assets
    ${where}
    ORDER BY created_at DESC
    LIMIT 100
  `).bind(...params).all<MediaRow>();
  return rows.results.map(toMediaAsset);
}

export class MediaWriteConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaWriteConflictError";
  }
}

export class MediaWriteIdempotencyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaWriteIdempotencyConflictError";
  }
}

export class MediaWriteStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaWriteStorageError";
  }
}

export class MediaWriteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaWriteValidationError";
  }
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
    requestId?: string;
    serviceId: number | null;
    variantId: number | null;
  },
): Promise<MediaAsset> {
  const normalizedRequestId = normalizeRequestId(input.requestId);
  const actorSubject = normalizeActor(input.createdBy);
  const payloadSha256 = await fingerprint({
    altText: input.altText,
    byteSize: input.bytes.byteLength,
    checksumSha256: input.checksumSha256,
    contentType: input.contentType,
    entityType: "media_asset",
    operation: "create",
    originalFilename: input.originalFilename,
    productId: input.productId,
    serviceId: input.serviceId,
    variantId: input.variantId,
  });
  await requireMediaAuditTables(database);
  const existingMutation = await findMediaMutation(database, normalizedRequestId, "media_asset");
  if (existingMutation) {
    assertMatchingMediaMutation(existingMutation, "create", undefined, payloadSha256);
    return readMediaMutationAsset(database, existingMutation);
  }

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
    const databaseWithBatch = requireBatch(database);
    const results = await databaseWithBatch.batch([
      database.prepare(`
      INSERT INTO media_assets (
        id, namespace, product_id, variant_id, service_id, storage_key, original_filename,
        content_type, byte_size, checksum_sha256, alt_text, created_by,
        revision, last_request_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
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
        actorSubject,
        normalizedRequestId,
      ),
      buildMediaAudit(database, normalizedRequestId, actorSubject, "create", "media_asset", id, payloadSha256),
      buildLegacyMediaAudit(database, actorSubject, "media.created", id, payloadSha256),
    ]);
    if (!hasRows(results[0]) || !hasRows(results[1]) || !hasRows(results[2])) {
      throw new MediaWriteStorageError("Media chưa ghi đủ metadata và audit đồng bộ.");
    }
  } catch (error) {
    await bucket.delete(storageKey).catch(() => undefined);
    const racedMutation = await findMediaMutation(database, normalizedRequestId, "media_asset");
    if (racedMutation) {
      assertMatchingMediaMutation(racedMutation, "create", undefined, payloadSha256);
      return readMediaMutationAsset(database, racedMutation);
    }
    throw error;
  }
  const mutation = await findMediaMutation(database, normalizedRequestId, "media_asset");
  if (!mutation) throw new MediaWriteStorageError("Không đọc lại được audit media vừa upload.");
  assertMatchingMediaMutation(mutation, "create", id, payloadSha256);
  return readMediaMutationAsset(database, mutation);
}

export class MediaReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaReferenceError";
  }
}

/**
 * Live rows that still point at this asset as their main image. Deleting such an
 * asset would orphan an active reference, so the caller must refuse with a
 * conflict instead of deleting.
 */
export async function findActiveMainImageReferences(
  database: D1DatabaseLike,
  storageKey: string,
): Promise<Array<{ kind: "product" | "service" | "variant"; id: number; name: string }>> {
  const publicUrl = `/media/${storageKey}`;
  const rows = await database.prepare(`
    SELECT 'product' AS kind, id, name FROM products WHERE image_url = ?
    UNION ALL
    SELECT 'variant' AS kind, id, name FROM product_variants WHERE image_url = ?
    UNION ALL
    SELECT 'service' AS kind, id, name FROM services WHERE image_url = ?
  `).bind(publicUrl, publicUrl, publicUrl).all<{ id: number; kind: "product" | "service" | "variant"; name: string }>();
  return rows.results;
}

export async function deleteMediaAsset(
  database: D1DatabaseLike,
  bucket: R2BucketLike,
  assetId: string,
  expectedRevisionRaw: unknown = 1,
  actorSubject = "system",
  requestId?: string,
): Promise<MediaAsset | null> {
  const normalizedAssetId = normalizeMediaId(assetId);
  const expectedRevision = requireRevision(expectedRevisionRaw);
  const normalizedActor = normalizeActor(actorSubject);
  const normalizedRequestId = normalizeRequestId(requestId);
  const payloadSha256 = await fingerprint({
    actorSubject: normalizedActor,
    entityType: "media_asset",
    expectedRevision,
    id: normalizedAssetId,
    operation: "delete",
  });
  await requireMediaAuditTables(database);
  const existingMutation = await findMediaMutation(database, normalizedRequestId, "media_asset");
  if (existingMutation) {
    assertMatchingMediaMutation(existingMutation, "delete", normalizedAssetId, payloadSha256);
    const replayed = await readMediaMutationAsset(database, existingMutation);
    await bucket.delete(replayed.storageKey);
    return replayed;
  }

  const row = await readMediaAssetRow(database, normalizedAssetId);
  if (!row) return null;
  if (row.revision !== expectedRevision) {
    throw new MediaWriteConflictError("Media đã thay đổi ở phiên khác. Hãy tải lại trước khi xóa.");
  }
  if (row.status !== "active") return toMediaAsset(row);

  const references = await findActiveMainImageReferences(database, row.storage_key);
  if (references.length > 0) {
    throw new MediaReferenceError(
      references.map((reference) => `${reference.kind === "service" ? "Dịch vụ" : reference.kind === "variant" ? "Biến thể" : "Sản phẩm"} #${reference.id} (${reference.name})`).join(", "),
    );
  }

  const databaseWithBatch = requireBatch(database);
  try {
    const results = await databaseWithBatch.batch([
      database.prepare(`
        UPDATE media_assets
        SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP,
          revision = revision + 1, last_request_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'active' AND revision = ?
      `).bind(normalizedRequestId, normalizedAssetId, expectedRevision),
      buildMediaAudit(database, normalizedRequestId, normalizedActor, "delete", "media_asset", normalizedAssetId, payloadSha256, expectedRevision, "deleted"),
      buildLegacyMediaAudit(database, normalizedActor, "media.deleted", normalizedAssetId, payloadSha256, expectedRevision, normalizedRequestId, "deleted"),
    ]);
    if (!hasRows(results[0])) return resolveMediaConflict(database, normalizedRequestId, normalizedAssetId, payloadSha256, "delete");
    if (!hasRows(results[1]) || !hasRows(results[2])) throw new MediaWriteStorageError("Media chưa ghi đủ audit xóa đồng bộ.");
  } catch (error) {
    const racedMutation = await findMediaMutation(database, normalizedRequestId, "media_asset");
    if (racedMutation) {
      assertMatchingMediaMutation(racedMutation, "delete", normalizedAssetId, payloadSha256);
      const replayed = await readMediaMutationAsset(database, racedMutation);
      await bucket.delete(replayed.storageKey);
      return replayed;
    }
    throw error;
  }

  // D1 marks the asset deleted before the external R2 delete. If R2 is
  // temporarily unavailable, a retry with the same requestId can finish the
  // blob deletion without reopening the public reference.
  await bucket.delete(row.storage_key);
  const deleted = await readMediaAssetRow(database, normalizedAssetId);
  if (!deleted) throw new MediaWriteStorageError("Không đọc lại được media sau khi xóa.");
  return toMediaAsset(deleted);
}

export async function updateMediaAssetAltText(
  database: D1DatabaseLike,
  assetId: string,
  altText: string | null,
  expectedRevisionRaw: unknown = 1,
  actorSubject = "system",
  requestId?: string,
): Promise<MediaAsset | null> {
  const normalizedAssetId = normalizeMediaId(assetId);
  const expectedRevision = requireRevision(expectedRevisionRaw);
  const normalizedActor = normalizeActor(actorSubject);
  const normalizedRequestId = normalizeRequestId(requestId);
  const normalizedAltText = normalizeAltText(altText);
  const payloadSha256 = await fingerprint({
    actorSubject: normalizedActor,
    altText: normalizedAltText,
    entityType: "media_asset",
    expectedRevision,
    id: normalizedAssetId,
    operation: "update",
  });
  await requireMediaAuditTables(database);
  const existingMutation = await findMediaMutation(database, normalizedRequestId, "media_asset");
  if (existingMutation) {
    assertMatchingMediaMutation(existingMutation, "update", normalizedAssetId, payloadSha256);
    return readMediaMutationAsset(database, existingMutation);
  }

  const current = await readMediaAssetRow(database, normalizedAssetId);
  if (!current || current.status !== "active") return current ? toMediaAsset(current) : null;
  if (current.revision !== expectedRevision) {
    throw new MediaWriteConflictError("Media đã thay đổi ở phiên khác. Hãy tải lại trước khi lưu alt text.");
  }
  if (current.alt_text === normalizedAltText) return toMediaAsset(current);

  const databaseWithBatch = requireBatch(database);
  try {
    const results = await databaseWithBatch.batch([
      database.prepare(`
        UPDATE media_assets
        SET alt_text = ?, revision = revision + 1, last_request_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'active' AND revision = ?
      `).bind(normalizedAltText, normalizedRequestId, normalizedAssetId, expectedRevision),
      buildMediaAudit(database, normalizedRequestId, normalizedActor, "update", "media_asset", normalizedAssetId, payloadSha256, expectedRevision, "active"),
      buildLegacyMediaAudit(database, normalizedActor, "media.updated", normalizedAssetId, payloadSha256, expectedRevision, normalizedRequestId, "active"),
    ]);
    if (!hasRows(results[0])) return resolveMediaConflict(database, normalizedRequestId, normalizedAssetId, payloadSha256, "update");
    if (!hasRows(results[1]) || !hasRows(results[2])) throw new MediaWriteStorageError("Media chưa ghi đủ audit cập nhật đồng bộ.");
  } catch (error) {
    const racedMutation = await findMediaMutation(database, normalizedRequestId, "media_asset");
    if (racedMutation) {
      assertMatchingMediaMutation(racedMutation, "update", normalizedAssetId, payloadSha256);
      return readMediaMutationAsset(database, racedMutation);
    }
    throw error;
  }
  return readMediaMutationAsset(database, {
    action: "update",
    entity_key: normalizedAssetId,
    entity_type: "media_asset",
    payload_sha256: payloadSha256,
    request_id: normalizedRequestId,
  });
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

interface MediaMutationRow {
  action: "create" | "update" | "delete";
  entity_key: string;
  entity_type: "media_asset" | "site_media_asset";
  payload_sha256: string;
  request_id: string;
}

interface D1BatchResultLike {
  meta?: { changes?: unknown };
  results?: unknown[];
}

interface D1DatabaseWithBatch extends D1DatabaseLike {
  batch(statements: D1PreparedStatementLike[]): Promise<D1BatchResultLike[]>;
}

async function requireMediaAuditTables(database: D1DatabaseLike): Promise<void> {
  const [hasMediaAudit, hasLegacyAudit] = await Promise.all([
    tableExists(database, "admin_media_audit"),
    tableExists(database, "audit_logs"),
  ]);
  if (!hasMediaAudit || !hasLegacyAudit) {
    throw new MediaWriteStorageError("Các bảng audit media chưa được triển khai.");
  }
}

async function findMediaMutation(
  database: D1DatabaseLike,
  requestId: string,
  entityType: MediaMutationRow["entity_type"],
): Promise<MediaMutationRow | null> {
  return database.prepare(`
    SELECT action, entity_key, entity_type, payload_sha256, request_id
    FROM admin_media_audit
    WHERE request_id = ? AND entity_type = ?
    LIMIT 1
  `).bind(requestId, entityType).first<MediaMutationRow>();
}

async function readMediaAssetRow(database: D1DatabaseLike, assetId: string): Promise<MediaRow | null> {
  return database.prepare(`
    SELECT id, namespace, product_id, variant_id, service_id, storage_key,
      original_filename, content_type, byte_size, checksum_sha256, alt_text,
      status, revision, created_at, updated_at
    FROM media_assets WHERE id = ? LIMIT 1
  `).bind(assetId).first<MediaRow>();
}

async function readMediaMutationAsset(database: D1DatabaseLike, mutation: MediaMutationRow): Promise<MediaAsset> {
  if (mutation.entity_type !== "media_asset") throw new MediaWriteStorageError("Audit media không thuộc asset catalog.");
  const row = await readMediaAssetRow(database, normalizeMediaId(mutation.entity_key));
  if (!row) throw new MediaWriteStorageError("Không đọc lại được kết quả media từ audit.");
  return toMediaAsset(row);
}

async function resolveMediaConflict(
  database: D1DatabaseLike,
  requestId: string,
  assetId: string,
  payloadSha256: string,
  action: "update" | "delete",
): Promise<MediaAsset> {
  const mutation = await findMediaMutation(database, requestId, "media_asset");
  if (mutation) {
    assertMatchingMediaMutation(mutation, action, assetId, payloadSha256);
    return readMediaMutationAsset(database, mutation);
  }
  throw new MediaWriteConflictError("Media đã thay đổi ở phiên khác. Hãy tải lại rồi thử lại.");
}

function buildMediaAudit(
  database: D1DatabaseLike,
  requestId: string,
  actorSubject: string,
  action: "create" | "update" | "delete",
  entityType: MediaMutationRow["entity_type"],
  entityId: string,
  payloadSha256: string,
  previousRevision?: number,
  resultingStatus?: MediaAsset["status"],
): D1PreparedStatementLike {
  return action === "create"
    ? database.prepare(`
      INSERT INTO admin_media_audit (
        request_id, actor_subject, action, entity_type, entity_key,
        previous_revision, resulting_revision, payload_sha256
      ) VALUES (?, ?, 'create', ?, ?, NULL, 1, ?)
    `).bind(requestId, actorSubject, entityType, entityId, payloadSha256)
    : database.prepare(`
      INSERT INTO admin_media_audit (
        request_id, actor_subject, action, entity_type, entity_key,
        previous_revision, resulting_revision, payload_sha256
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, ?
      FROM media_assets
      WHERE id = ? AND status = ? AND revision = ? AND last_request_id = ?
    `).bind(
      requestId,
      actorSubject,
      action,
      entityType,
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

function buildLegacyMediaAudit(
  database: D1DatabaseLike,
  actorSubject: string,
  action: "media.created" | "media.updated" | "media.deleted",
  entityId: string,
  payloadSha256: string,
  expectedRevision?: number,
  requestId?: string,
  resultingStatus?: MediaAsset["status"],
): D1PreparedStatementLike {
  const metadata = JSON.stringify({ expectedRevision, payloadSha256 });
  return expectedRevision === undefined
    ? database.prepare(`
      INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
      VALUES (?, ?, '${action}', 'media_asset', ?, ?)
    `).bind(crypto.randomUUID(), actorSubject, entityId, metadata)
    : database.prepare(`
      INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
      SELECT ?, ?, '${action}', 'media_asset', ?, ?
      FROM media_assets
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

function assertMatchingMediaMutation(
  mutation: MediaMutationRow,
  action: MediaMutationRow["action"],
  entityId: string | undefined,
  payloadSha256: string,
): void {
  if (mutation.action !== action || (entityId !== undefined && mutation.entity_key !== entityId) || mutation.payload_sha256 !== payloadSha256) {
    throw new MediaWriteIdempotencyConflictError("requestId đã được dùng cho một payload media khác.");
  }
}

function requireBatch(database: D1DatabaseLike): D1DatabaseWithBatch {
  const databaseWithBatch = database as D1DatabaseWithBatch;
  if (typeof databaseWithBatch.batch !== "function") {
    throw new MediaWriteStorageError("D1 atomic batch chưa sẵn sàng cho media write.");
  }
  return databaseWithBatch;
}

function hasRows(result: unknown): boolean {
  if (typeof result !== "object" || result === null) return false;
  const record = result as D1BatchResultLike & { results?: unknown[] };
  if (Array.isArray(record.results)) return record.results.length > 0;
  const changes = record.meta?.changes;
  return changes !== undefined && Number(changes) > 0;
}

function normalizeMediaId(value: string): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new MediaWriteValidationError("id media không hợp lệ.");
  }
  return value.toLowerCase();
}

function normalizeRequestId(value?: string): string {
  const requestId = value?.trim().toLowerCase() ?? crypto.randomUUID();
  if (!isAdminRequestId(requestId)) throw new MediaWriteValidationError("requestId phải là UUID hợp lệ.");
  return requestId;
}

function normalizeActor(value: string): string {
  const actor = value.trim();
  if (!actor || actor.length > 255) throw new MediaWriteValidationError("createdBy không hợp lệ.");
  return actor;
}

function normalizeAltText(value: string | null): string | null {
  if (value !== null && typeof value !== "string") throw new MediaWriteValidationError("altText phải là chuỗi hoặc null.");
  const altText = value?.trim() || null;
  if (altText && altText.length > 300) throw new MediaWriteValidationError("altText không được vượt quá 300 ký tự.");
  return altText;
}

function requireRevision(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new MediaWriteValidationError("revision phải là số nguyên dương.");
  }
  return value;
}

async function fingerprint(input: Record<string, unknown>): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(input));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
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
    revision: row.revision,
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
