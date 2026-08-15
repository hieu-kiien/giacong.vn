import { getCloudflareContext } from "@opennextjs/cloudflare";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_MULTIPART_OVERHEAD = 256 * 1024;
const ALLOWED = new Map<string, { ext: "jpg" | "png" | "webp"; signature: (bytes: Uint8Array) => boolean }>([
  ["image/jpeg", { ext: "jpg", signature: b => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff }],
  ["image/png", { ext: "png", signature: b => b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a }],
  ["image/webp", { ext: "webp", signature: b => b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 }],
]);

interface Statement { bind(...values: unknown[]): Statement; first<T = Record<string, unknown>>(): Promise<T | null>; run(): Promise<{ meta?: { changes?: number } }>; all<T = Record<string, unknown>>(): Promise<{ results: T[] }>; }
interface Database { prepare(sql: string): Statement; }
interface R2ObjectLike { key: string; size: number; httpMetadata?: { contentType?: string }; uploaded?: Date; }
interface R2Bucket { put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType: string } }): Promise<R2ObjectLike | null>; head(key: string): Promise<R2ObjectLike | null>; delete(key: string | string[]): Promise<void>; list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{ objects: R2ObjectLike[]; truncated: boolean; cursor?: string }>; }
interface Env { GIACONG_VN_CATALOG?: Database; GIACONG_VN_PRODUCT_MEDIA?: R2Bucket; }

export class AdminMediaValidationError extends Error {}
export class AdminMediaPayloadTooLargeError extends Error {}
export class AdminMediaConflictError extends Error {}
export class AdminMediaIdempotencyConflictError extends Error {}

export function mediaPublicUrl(key: string): string { return `/media/${key}`; }

export async function uploadProductMedia(file: File, actorSubject: string, requestId: string): Promise<{ key: string; url: string; contentType: string; size: number }> {
  const mime = file.type.toLowerCase();
  const descriptor = ALLOWED.get(mime);
  if (!descriptor) throw new AdminMediaValidationError("Unsupported media type.");
  if (file.size <= 0 || file.size > MAX_FILE_BYTES) throw new AdminMediaPayloadTooLargeError("Media file is too large.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength !== file.size || bytes.byteLength > MAX_FILE_BYTES) throw new AdminMediaPayloadTooLargeError("Media file is too large.");
  if (!descriptor.signature(bytes)) throw new AdminMediaValidationError("Media signature does not match content type.");

  const db = getDatabase();
  const hash = await sha256(bytes);
  const existing = await db.prepare("SELECT entity_key AS entityKey,payload_sha256 AS payloadHash FROM admin_audit_log WHERE request_id=? LIMIT 1").bind(requestId).first<{ entityKey: string; payloadHash: string }>();
  if (existing) {
    if (existing.payloadHash !== hash) throw new AdminMediaIdempotencyConflictError("Request ID already used with different payload.");
    const object = await getBucket().head(existing.entityKey);
    if (!object) throw new AdminMediaConflictError("Previous media upload is unavailable.");
    return { key: existing.entityKey, url: mediaPublicUrl(existing.entityKey), contentType: mime, size: object.size };
  }

  const key = `products/${crypto.randomUUID()}.${descriptor.ext}`;
  const bucket = getBucket();
  const uploadBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  await bucket.put(key, uploadBuffer, { httpMetadata: { contentType: mime } });
  try {
    await db.prepare(`INSERT INTO admin_audit_log(request_id,actor_subject,action,entity_type,entity_key,previous_revision,resulting_revision,payload_sha256) VALUES(?,?, 'upload','media',?,?,NULL,?)`).bind(requestId, actorSubject, key, null, hash).run();
  } catch (error) {
    await bucket.delete(key);
    throw error;
  }
  return { key, url: mediaPublicUrl(key), contentType: mime, size: bytes.byteLength };
}

export async function listProductMedia(cursor?: string): Promise<{ objects: Array<{ key: string; url: string; size: number; contentType: string | null; uploadedAt: string | null }>; cursor: string | null; truncated: boolean }> {
  const result = await getBucket().list({ prefix: "products/", limit: 100, cursor: cursor || undefined });
  return {
    objects: result.objects.map(object => ({ key: object.key, url: mediaPublicUrl(object.key), size: object.size, contentType: object.httpMetadata?.contentType ?? null, uploadedAt: object.uploaded ? object.uploaded.toISOString() : null })),
    cursor: result.truncated ? result.cursor ?? null : null,
    truncated: result.truncated,
  };
}

export async function deleteProductMedia(key: string, actorSubject: string, requestId: string): Promise<void> {
  if (!/^products\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/.test(key)) throw new AdminMediaValidationError("Invalid media key.");
  const db = getDatabase();
  const publicUrl = mediaPublicUrl(key);
  const reference = await db.prepare("SELECT id FROM products WHERE image_url=? LIMIT 1").bind(publicUrl).first<{ id: number }>();
  if (reference) throw new AdminMediaConflictError("Media is still referenced by a product.");
  const variantReference = await db.prepare("SELECT id FROM product_variants WHERE image_url=? LIMIT 1").bind(publicUrl).first<{ id: number }>();
  if (variantReference) throw new AdminMediaConflictError("Media is still referenced by a variant.");

  const hash = await sha256String(JSON.stringify({ key }));
  const existing = await db.prepare("SELECT entity_type AS entityType,entity_key AS entityKey,payload_sha256 AS payloadHash FROM admin_audit_log WHERE request_id=? LIMIT 1").bind(requestId).first<{ entityType: string; entityKey: string; payloadHash: string }>();
  if (existing) {
    if (existing.payloadHash !== hash || existing.entityType !== "media" || existing.entityKey !== key) throw new AdminMediaIdempotencyConflictError("Request ID already used with different payload.");
    return;
  }

  const bucket = getBucket();
  const object = await bucket.head(key);
  if (object) await bucket.delete(key);
  await db.prepare(`INSERT INTO admin_audit_log(request_id,actor_subject,action,entity_type,entity_key,previous_revision,resulting_revision,payload_sha256) VALUES(?,?, 'delete','media',?,?,NULL,?)`).bind(requestId, actorSubject, key, null, hash).run();
}

export function assertMultipartSize(contentLength: number): void {
  if (Number.isFinite(contentLength) && contentLength > MAX_FILE_BYTES + MAX_MULTIPART_OVERHEAD) throw new AdminMediaPayloadTooLargeError("Multipart payload is too large.");
}

function getDatabase(): Database { const { env } = getCloudflareContext(); const db = (env as unknown as Env).GIACONG_VN_CATALOG; if (!db) throw new Error("Missing D1 catalog binding."); return db; }
function getBucket(): R2Bucket { const { env } = getCloudflareContext(); const bucket = (env as unknown as Env).GIACONG_VN_PRODUCT_MEDIA; if (!bucket) throw new Error("Missing product media R2 binding."); return bucket; }
async function sha256(bytes: Uint8Array): Promise<string> {
  const copy = bytes.slice();
  const digest = await crypto.subtle.digest("SHA-256", copy);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
async function sha256String(value: string): Promise<string> { return sha256(new TextEncoder().encode(value)); }
