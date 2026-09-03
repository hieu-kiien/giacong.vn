import type { AdminProductInput, D1DatabaseLike, D1PreparedStatementLike } from "./admin-data.ts";
import {
  ADMIN_PRODUCT_IMPORT_CHUNK_ROWS,
  getAdminProductImportBindCounts,
  MAX_ADMIN_PRODUCT_IMPORT_BIND_VARIABLES,
  MAX_ADMIN_PRODUCT_IMPORT_ROWS,
} from "./admin-product-import-csv.ts";
import type { AdminProductImportEntry } from "./admin-product-import.ts";
import { isAdminProductImportRequestId } from "./admin-product-import-request.ts";

interface D1BatchResultLike {
  results?: unknown[];
}

interface D1BatchDatabaseLike extends D1DatabaseLike {
  batch(statements: D1PreparedStatementLike[]): Promise<D1BatchResultLike[]>;
}

export interface AdminProductImportReplay {
  payloadSha256: string;
  productIds: number[];
}

export class AdminProductImportWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminProductImportWriteError";
  }
}

export class AdminProductImportIdempotencyConflictError extends AdminProductImportWriteError {}

export const ADMIN_PRODUCT_IMPORT_AUDIT_NAMESPACE = "bulk-product-import";

export function adminProductImportAuditId(requestId: string, index: number): string {
  return `${ADMIN_PRODUCT_IMPORT_AUDIT_NAMESPACE}:${requestId}:${String(index).padStart(3, "0")}`;
}

export function isAdminProductImportReplay(storedPayloadSha256: string, payloadSha256: string): boolean {
  return storedPayloadSha256 === payloadSha256;
}

export async function findAdminProductImportReplay(
  database: D1DatabaseLike,
  requestId: string,
): Promise<AdminProductImportReplay | null> {
  const marker = await database.prepare(`
    SELECT action, entity_key, entity_type, request_id, payload_sha256
    FROM admin_audit_log
    WHERE request_id = ?
    LIMIT 1
  `).bind(requestId).first<{
    action: string;
    entity_key: string;
    entity_type: string;
    request_id: string;
    payload_sha256: string;
  }>();
  if (!marker) return null;
  if (
    marker.action !== "create"
    || marker.entity_type !== "product"
    || marker.entity_key !== `${ADMIN_PRODUCT_IMPORT_AUDIT_NAMESPACE}:${requestId}`
  ) {
    throw new AdminProductImportIdempotencyConflictError("Request ID đã được dùng cho một thao tác khác.");
  }
  if (typeof marker.payload_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(marker.payload_sha256)) {
    throw new AdminProductImportWriteError("Audit idempotency của lần nhập không hợp lệ.");
  }

  const auditIds = Array.from(
    { length: MAX_ADMIN_PRODUCT_IMPORT_ROWS },
    (_, index) => adminProductImportAuditId(requestId, index),
  );
  const auditRows = await database.prepare(`
    SELECT id, entity_id
    FROM audit_logs
    WHERE id IN (${auditIds.map(() => "?").join(", ")})
      AND action = 'product.bulk_created'
      AND entity_type = 'product'
    ORDER BY id ASC
  `).bind(...auditIds).all<{ id: string; entity_id: string }>();
  const indexedRows = auditRows.results.map((row) => ({
    index: parseProductImportAuditIndex(row.id, requestId),
    productId: parseProductId(row.entity_id),
  })).sort((left, right) => left.index - right.index);
  if (indexedRows.length === 0 || indexedRows.some((row, index) => row.index !== index)) {
    throw new AdminProductImportWriteError("Không đọc được kết quả lần nhập đã ghi nhận.");
  }
  return { payloadSha256: marker.payload_sha256, productIds: indexedRows.map((row) => row.productId) };
}

export async function createAdminProductsAtomically(
  database: D1DatabaseLike,
  entries: readonly AdminProductImportEntry[],
  actorSubject: string,
  requestId: string,
  payloadSha256: string,
): Promise<number[]> {
  if (entries.length === 0) throw new AdminProductImportWriteError("Không có sản phẩm để nhập.");
  if (!isAdminProductImportRequestId(requestId)) {
    throw new AdminProductImportWriteError("Request ID nhập sản phẩm không hợp lệ.");
  }
  if (!/^[0-9a-f]{64}$/.test(payloadSha256)) {
    throw new AdminProductImportWriteError("Dấu vân tay payload nhập sản phẩm không hợp lệ.");
  }
  if (entries.some(({ input }) => input.status !== "draft" || input.isActive)) {
    throw new AdminProductImportWriteError("Nhập hàng loạt chỉ được tạo sản phẩm Draft đang ẩn.");
  }
  assertImportBindVariableBudget(entries.length);

  const batchDatabase = requireBatch(database);
  const statements: D1PreparedStatementLike[] = [buildIdempotencyMarker(database, actorSubject, requestId, payloadSha256)];
  const chunks = chunkEntries(entries);
  for (const [chunkIndex, chunk] of chunks.entries()) {
    statements.push(buildProductInsert(database, chunk));
    statements.push(buildProductMetaInsert(database, chunk, actorSubject));
    statements.push(buildProductAuditInsert(
      database,
      chunk,
      actorSubject,
      requestId,
      payloadSha256,
      chunkIndex * ADMIN_PRODUCT_IMPORT_CHUNK_ROWS,
    ));
  }
  const results = await batchDatabase.batch(statements);
  assertSingleResult(results[0]?.results, "request ID");
  const returnedRows: Array<{ id: number; slug: string }> = [];
  let resultIndex = 1;
  for (const chunk of chunks) {
    const chunkRows = readProductRows(results[resultIndex]?.results);
    if (chunkRows.length !== chunk.length) throw new AdminProductImportWriteError("Không ghi đủ sản phẩm vừa nhập.");
    returnedRows.push(...chunkRows);
    assertResultCount(results[resultIndex + 1]?.results, chunk.length, "metadata sản phẩm");
    assertResultCount(results[resultIndex + 2]?.results, chunk.length, "audit sản phẩm");
    resultIndex += 3;
  }
  if (results.length !== resultIndex || returnedRows.length !== entries.length) {
    throw new AdminProductImportWriteError("Không ghi đủ sản phẩm vừa nhập.");
  }
  const idsBySlug = new Map(returnedRows.map((row) => [row.slug, row.id]));
  const productIds = entries.map(({ input }) => idsBySlug.get(input.slug));
  if (productIds.some((id) => id === undefined)) {
    throw new AdminProductImportWriteError("Không đối chiếu được sản phẩm vừa nhập.");
  }
  return productIds as number[];
}

function buildIdempotencyMarker(
  database: D1DatabaseLike,
  actorSubject: string,
  requestId: string,
  payloadSha256: string,
): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO admin_audit_log (
      request_id, actor_subject, action, entity_type, entity_key,
      previous_revision, resulting_revision, payload_sha256
    ) VALUES (?, ?, 'create', 'product', ?, NULL, 1, ?)
    RETURNING request_id
  `).bind(
    requestId,
    actorSubject,
    `${ADMIN_PRODUCT_IMPORT_AUDIT_NAMESPACE}:${requestId}`,
    payloadSha256,
  );
}

function buildProductInsert(
  database: D1DatabaseLike,
  entries: readonly AdminProductImportEntry[],
): D1PreparedStatementLike {
  const placeholders = entries.map(() => "(?, ?, ?, ?, ?, ?, ?, 0)").join(", ");
  const values = entries.flatMap(({ input }) => productValues(input));
  return database.prepare(`
    INSERT INTO products (
      name, slug, sku, short_description, description, image_url, category_id, is_active
    ) VALUES ${placeholders}
    RETURNING id, slug
  `).bind(...values);
}

function buildProductMetaInsert(
  database: D1DatabaseLike,
  entries: readonly AdminProductImportEntry[],
  actorSubject: string,
): D1PreparedStatementLike {
  const selects = entries.map(() => `
    SELECT id, ?, ?, ?, CURRENT_TIMESTAMP
    FROM products
    WHERE slug = ?
  `).join(" UNION ALL ");
  const values = entries.flatMap(({ input }) => [
    "draft",
    input.leadTimeDays,
    actorSubject,
    input.slug,
  ]);
  return database.prepare(`
    INSERT INTO product_admin_meta (
      product_id, status, lead_time_days, updated_by, updated_at
    ) ${selects}
    RETURNING product_id
  `).bind(...values);
}

function buildProductAuditInsert(
  database: D1DatabaseLike,
  entries: readonly AdminProductImportEntry[],
  actorSubject: string,
  requestId: string,
  payloadSha256: string,
  indexOffset: number,
): D1PreparedStatementLike {
  const selects = entries.map(({ input, rowNumber }, index) => `
    SELECT ?, ?, 'product.bulk_created', 'product', CAST(id AS TEXT), ?
    FROM products
    WHERE slug = ?
  `).join(" UNION ALL ");
  const values = entries.flatMap(({ input, rowNumber }, index) => [
    adminProductImportAuditId(requestId, indexOffset + index),
    actorSubject,
    JSON.stringify({ payloadSha256, requestId, rowNumber, source: "bulk_product_import" }),
    input.slug,
  ]);
  return database.prepare(`
    INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
    ${selects}
    RETURNING id
  `).bind(...values);
}

function productValues(input: AdminProductInput): unknown[] {
  return [
    input.name,
    input.slug,
    input.sku,
    input.shortDescription,
    input.description,
    input.imageUrl,
    input.categoryId,
  ];
}

function readProductRows(rows: unknown[] | undefined): Array<{ id: number; slug: string }> {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (typeof row !== "object" || row === null || Array.isArray(row)) return [];
    const value = row as Record<string, unknown>;
    return typeof value.id === "number"
        && Number.isInteger(value.id)
        && value.id > 0
        && typeof value.slug === "string"
      ? [{ id: value.id, slug: value.slug }]
      : [];
  });
}

function parseProductId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw new AdminProductImportWriteError("Audit sản phẩm chứa ID không hợp lệ.");
  }
  return id;
}

function parseProductImportAuditIndex(value: string, requestId: string): number {
  const prefix = `${ADMIN_PRODUCT_IMPORT_AUDIT_NAMESPACE}:${requestId}:`;
  if (!value.startsWith(prefix)) {
    throw new AdminProductImportWriteError("Audit sản phẩm không thuộc namespace của lần nhập.");
  }
  const suffix = value.slice(prefix.length);
  if (!/^\d{3}$/.test(suffix)) {
    throw new AdminProductImportWriteError("Audit sản phẩm chứa chỉ mục không hợp lệ.");
  }
  const index = Number(suffix);
  if (index >= MAX_ADMIN_PRODUCT_IMPORT_ROWS) {
    throw new AdminProductImportWriteError("Audit sản phẩm chứa chỉ mục vượt giới hạn.");
  }
  return index;
}

function assertImportBindVariableBudget(rowCount: number): void {
  if (
    !Number.isSafeInteger(rowCount)
    || rowCount < 1
    || rowCount > MAX_ADMIN_PRODUCT_IMPORT_ROWS
    || Object.values(getAdminProductImportBindCounts(ADMIN_PRODUCT_IMPORT_CHUNK_ROWS))
      .some((count) => count > MAX_ADMIN_PRODUCT_IMPORT_BIND_VARIABLES)
  ) {
    throw new AdminProductImportWriteError("Lần nhập vượt giới hạn biến bind an toàn của D1.");
  }
}

function chunkEntries<T>(entries: readonly T[]): T[][] {
  const chunks: T[][] = [];
  for (let offset = 0; offset < entries.length; offset += ADMIN_PRODUCT_IMPORT_CHUNK_ROWS) {
    chunks.push(entries.slice(offset, offset + ADMIN_PRODUCT_IMPORT_CHUNK_ROWS));
  }
  return chunks;
}

function assertSingleResult(rows: unknown[] | undefined, label: string): void {
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new AdminProductImportWriteError(`Không ghi được ${label}.`);
  }
}

function assertResultCount(rows: unknown[] | undefined, expected: number, label: string): void {
  if (!Array.isArray(rows) || rows.length !== expected) {
    throw new AdminProductImportWriteError(`Không ghi đủ ${label}.`);
  }
}

function requireBatch(database: D1DatabaseLike): D1BatchDatabaseLike {
  const candidate = database as D1DatabaseLike & { batch?: D1BatchDatabaseLike["batch"] };
  if (typeof candidate.batch !== "function") {
    throw new AdminProductImportWriteError("D1 batch() là bắt buộc để ghi sản phẩm an toàn.");
  }
  return candidate as D1BatchDatabaseLike;
}
