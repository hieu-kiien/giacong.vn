import type { D1DatabaseLike, D1PreparedStatementLike } from "./admin-data.ts";
import { hasOnlyKeys, isAdminRequestId } from "./admin-request.ts";
import { MAX_PRODUCT_GALLERY_IMAGES } from "./admin-product-gallery-contract.ts";

export { MAX_PRODUCT_GALLERY_IMAGES } from "./admin-product-gallery-contract.ts";
const MAX_PRODUCT_GALLERY_IMAGE_URL_LENGTH = 2_048;

export interface AdminProductGalleryImageInput {
  imageUrl: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface AdminProductGalleryCommand {
  expectedRevision: number;
  images: AdminProductGalleryImageInput[];
  requestId: string;
}

interface GalleryMutationRow {
  action: string;
  entity_key: string;
  entity_type: string;
  payload_sha256: string;
  previous_revision: number | null;
  request_id: string;
  resulting_revision: number | null;
}

interface GalleryBatchResult {
  meta?: { changes?: number };
}

interface DatabaseWithBatch extends D1DatabaseLike {
  batch(statements: D1PreparedStatementLike[]): Promise<GalleryBatchResult[]>;
}

export class AdminProductGalleryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminProductGalleryValidationError";
  }
}

export class AdminProductGalleryConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminProductGalleryConflictError";
  }
}

export class AdminProductGalleryIdempotencyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminProductGalleryIdempotencyConflictError";
  }
}

export class AdminProductGalleryNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminProductGalleryNotFoundError";
  }
}

export class AdminProductGalleryStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminProductGalleryStorageError";
  }
}

export function parseAdminProductGalleryCommand(value: unknown): AdminProductGalleryCommand {
  if (!isRecord(value) || !hasOnlyKeys(value, ["expectedRevision", "images", "requestId"])) {
    throw new AdminProductGalleryValidationError("Request thư viện ảnh có trường không hợp lệ.");
  }
  if (!isAdminRequestId(value.requestId)) {
    throw new AdminProductGalleryValidationError("requestId phải là UUID hợp lệ.");
  }
  if (!Number.isSafeInteger(value.expectedRevision) || Number(value.expectedRevision) < 1) {
    throw new AdminProductGalleryValidationError("expectedRevision phải là số nguyên dương.");
  }

  return {
    expectedRevision: Number(value.expectedRevision),
    images: parseAdminProductGalleryPayload({ images: value.images }),
    requestId: value.requestId.trim(),
  };
}

export function parseAdminProductGalleryPayload(value: unknown): AdminProductGalleryImageInput[] {
  if (!isRecord(value) || !Array.isArray(value.images)) {
    throw new AdminProductGalleryValidationError("Request phải có danh sách images hợp lệ.");
  }
  if (value.images.length > MAX_PRODUCT_GALLERY_IMAGES) {
    throw new AdminProductGalleryValidationError(`Thư viện chỉ hỗ trợ tối đa ${MAX_PRODUCT_GALLERY_IMAGES} ảnh.`);
  }

  const seenUrls = new Set<string>();
  const images = value.images.map((item, index): AdminProductGalleryImageInput => {
    if (!isRecord(item) || !hasOnlyKeys(item, ["imageUrl", "isPrimary"]) || typeof item.imageUrl !== "string") {
      throw new AdminProductGalleryValidationError(`Ảnh thứ ${index + 1} có dữ liệu không hợp lệ.`);
    }

    const imageUrl = item.imageUrl.trim();
    if (!isSafeGalleryImageUrl(imageUrl)) {
      throw new AdminProductGalleryValidationError(`URL ảnh thứ ${index + 1} không hợp lệ.`);
    }
    if (seenUrls.has(imageUrl)) {
      throw new AdminProductGalleryValidationError("Thư viện không thể chứa cùng một URL ảnh nhiều lần.");
    }
    seenUrls.add(imageUrl);

    if (item.isPrimary !== undefined && typeof item.isPrimary !== "boolean") {
      throw new AdminProductGalleryValidationError(`Ảnh thứ ${index + 1} có trạng thái ảnh chính không hợp lệ.`);
    }

    return {
      imageUrl,
      isPrimary: item.isPrimary === undefined ? index === 0 : item.isPrimary,
      sortOrder: index,
    };
  });

  const primaryCount = images.filter((image) => image.isPrimary).length;
  if (primaryCount > 1) {
    throw new AdminProductGalleryValidationError("Chỉ được chọn một ảnh chính cho thư viện.");
  }
  if (images.length > 0 && primaryCount === 0) images[0]!.isPrimary = true;

  return images;
}

export async function replaceAdminProductGalleryAtomically(
  database: D1DatabaseLike,
  productId: number,
  actorSubject: string,
  command: AdminProductGalleryCommand,
): Promise<{ revision: number; replayed: boolean }> {
  const payloadSha256 = await fingerprint({
    entityType: "product",
    expectedRevision: command.expectedRevision,
    images: command.images,
    operation: "gallery.replace",
    productId,
  });

  if (!await tableExists(database, "admin_audit_log")) {
    throw new AdminProductGalleryStorageError("Bảng audit catalog chưa được triển khai.");
  }

  const existingMutation = await findMutation(database, command.requestId);
  if (existingMutation) {
    assertMatchingMutation(existingMutation, productId, command, payloadSha256);
    return { revision: await requireProductRevision(database, productId), replayed: true };
  }

  const revision = await requireProductRevision(database, productId);
  if (revision !== command.expectedRevision) {
    throw new AdminProductGalleryConflictError("Sản phẩm đã thay đổi ở phiên khác. Hãy tải lại rồi thử lại.");
  }

  const databaseWithBatch = requireBatch(database);
  const statements = [
    buildGalleryAuditMarker(database, productId, actorSubject, command, payloadSha256),
    buildGalleryProductRevisionUpdate(database, productId, command, payloadSha256),
    buildGalleryDelete(database, productId, command, payloadSha256),
    ...command.images.map((image) => buildGalleryInsert(database, productId, command, payloadSha256, image)),
    buildGalleryPostconditionAssertion(database, productId, command, payloadSha256),
  ];

  try {
    await databaseWithBatch.batch(statements);
  } catch (error) {
    const racedMutation = await findMutation(database, command.requestId);
    if (racedMutation) {
      assertMatchingMutation(racedMutation, productId, command, payloadSha256);
      return { revision: await requireProductRevision(database, productId), replayed: true };
    }
    const latestRevision = await readProductRevision(database, productId);
    if (latestRevision === null) throw new AdminProductGalleryNotFoundError("Không tìm thấy sản phẩm.");
    if (latestRevision !== command.expectedRevision) {
      throw new AdminProductGalleryConflictError("Sản phẩm đã thay đổi ở phiên khác. Hãy tải lại rồi thử lại.");
    }
    throw error;
  }

  const mutation = await findMutation(database, command.requestId);
  if (!mutation) throw new AdminProductGalleryStorageError("Không đọc lại được audit gallery vừa lưu.");
  assertMatchingMutation(mutation, productId, command, payloadSha256);
  return { revision: await requireProductRevision(database, productId), replayed: false };
}

function buildGalleryAuditMarker(
  database: D1DatabaseLike,
  productId: number,
  actorSubject: string,
  command: AdminProductGalleryCommand,
  payloadSha256: string,
): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO admin_audit_log (
      request_id, actor_subject, action, entity_type, entity_key,
      previous_revision, resulting_revision, payload_sha256
    )
    SELECT ?, ?, 'update', 'product', CAST(id AS TEXT), revision, revision + 1, ?
    FROM products
    WHERE id = ? AND revision = ?
      AND NOT EXISTS (SELECT 1 FROM admin_audit_log WHERE request_id = ?)
    LIMIT 1
  `).bind(
    command.requestId,
    actorSubject,
    payloadSha256,
    productId,
    command.expectedRevision,
    command.requestId,
  );
}

function buildGalleryProductRevisionUpdate(
  database: D1DatabaseLike,
  productId: number,
  command: AdminProductGalleryCommand,
  payloadSha256: string,
): D1PreparedStatementLike {
  return database.prepare(`
    UPDATE products
    SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND revision = ?
      AND EXISTS (
        SELECT 1 FROM admin_audit_log
        WHERE request_id = ? AND entity_type = 'product'
          AND entity_key = CAST(products.id AS TEXT)
          AND previous_revision = ? AND resulting_revision = ?
          AND payload_sha256 = ?
      )
  `).bind(
    productId,
    command.expectedRevision,
    command.requestId,
    command.expectedRevision,
    command.expectedRevision + 1,
    payloadSha256,
  );
}

function buildGalleryDelete(
  database: D1DatabaseLike,
  productId: number,
  command: AdminProductGalleryCommand,
  payloadSha256: string,
): D1PreparedStatementLike {
  return database.prepare(`
    DELETE FROM product_gallery_images
    WHERE product_id = ?
      AND EXISTS (
        SELECT 1 FROM products
        JOIN admin_audit_log ON admin_audit_log.entity_key = CAST(products.id AS TEXT)
        WHERE products.id = ? AND products.revision = ?
          AND admin_audit_log.request_id = ?
          AND admin_audit_log.entity_type = 'product'
          AND admin_audit_log.previous_revision = ?
          AND admin_audit_log.resulting_revision = ?
          AND admin_audit_log.payload_sha256 = ?
      )
  `).bind(
    productId,
    productId,
    command.expectedRevision + 1,
    command.requestId,
    command.expectedRevision,
    command.expectedRevision + 1,
    payloadSha256,
  );
}

function buildGalleryInsert(
  database: D1DatabaseLike,
  productId: number,
  command: AdminProductGalleryCommand,
  payloadSha256: string,
  image: AdminProductGalleryImageInput,
): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO product_gallery_images (product_id, image_url, sort_order, is_primary)
    SELECT ?, ?, ?, ?
    WHERE EXISTS (
      SELECT 1 FROM products
      JOIN admin_audit_log ON admin_audit_log.entity_key = CAST(products.id AS TEXT)
      WHERE products.id = ? AND products.revision = ?
        AND admin_audit_log.request_id = ?
        AND admin_audit_log.entity_type = 'product'
        AND admin_audit_log.previous_revision = ?
        AND admin_audit_log.resulting_revision = ?
        AND admin_audit_log.payload_sha256 = ?
    )
  `).bind(
    productId,
    image.imageUrl,
    image.sortOrder,
    image.isPrimary ? 1 : 0,
    productId,
    command.expectedRevision + 1,
    command.requestId,
    command.expectedRevision,
    command.expectedRevision + 1,
    payloadSha256,
  );
}

function buildGalleryPostconditionAssertion(
  database: D1DatabaseLike,
  productId: number,
  command: AdminProductGalleryCommand,
  payloadSha256: string,
): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO admin_audit_log (
      request_id, actor_subject, action, entity_type, entity_key,
      previous_revision, resulting_revision, payload_sha256
    )
    SELECT NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
    WHERE NOT EXISTS (
      SELECT 1 FROM admin_audit_log
      WHERE request_id = ? AND action = 'update' AND entity_type = 'product'
        AND entity_key = ? AND previous_revision = ? AND resulting_revision = ?
        AND payload_sha256 = ?
    ) OR NOT EXISTS (
      SELECT 1 FROM products WHERE id = ? AND revision = ?
    )
  `).bind(
    command.requestId,
    String(productId),
    command.expectedRevision,
    command.expectedRevision + 1,
    payloadSha256,
    productId,
    command.expectedRevision + 1,
  );
}

async function findMutation(database: D1DatabaseLike, requestId: string): Promise<GalleryMutationRow | null> {
  return database.prepare(`
    SELECT action, entity_key, entity_type, payload_sha256,
      previous_revision, request_id, resulting_revision
    FROM admin_audit_log
    WHERE request_id = ?
    LIMIT 1
  `).bind(requestId).first<GalleryMutationRow>();
}

function assertMatchingMutation(
  mutation: GalleryMutationRow,
  productId: number,
  command: AdminProductGalleryCommand,
  payloadSha256: string,
): void {
  if (
    mutation.action !== "update"
    || mutation.entity_key !== String(productId)
    || mutation.entity_type !== "product"
    || mutation.payload_sha256 !== payloadSha256
    || mutation.previous_revision !== command.expectedRevision
    || mutation.resulting_revision !== command.expectedRevision + 1
  ) {
    throw new AdminProductGalleryIdempotencyConflictError("requestId đã được dùng cho một thao tác khác.");
  }
}

async function requireProductRevision(database: D1DatabaseLike, productId: number): Promise<number> {
  const revision = await readProductRevision(database, productId);
  if (revision === null) throw new AdminProductGalleryNotFoundError("Không tìm thấy sản phẩm.");
  return revision;
}

async function readProductRevision(database: D1DatabaseLike, productId: number): Promise<number | null> {
  const row = await database.prepare("SELECT revision FROM products WHERE id = ? LIMIT 1")
    .bind(productId)
    .first<{ revision: number }>();
  return row && Number.isSafeInteger(row.revision) && row.revision > 0 ? row.revision : null;
}

async function tableExists(database: D1DatabaseLike, tableName: string): Promise<boolean> {
  return Boolean(await database.prepare(
    "SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
  ).bind(tableName).first<{ found: number }>());
}

function requireBatch(database: D1DatabaseLike): DatabaseWithBatch {
  const databaseWithBatch = database as DatabaseWithBatch;
  if (typeof databaseWithBatch.batch !== "function") {
    throw new AdminProductGalleryStorageError("D1 batch() là bắt buộc để lưu thư viện ảnh an toàn.");
  }
  return databaseWithBatch;
}

function isSafeGalleryImageUrl(value: string): boolean {
  if (!value || value.length > MAX_PRODUCT_GALLERY_IMAGE_URL_LENGTH || /[\u0000-\u001f\u007f]/.test(value)) return false;
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return true;

  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function fingerprint(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
