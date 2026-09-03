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
    SELECT audit.id, audit.entity_id, product.id AS product_id, meta.product_id AS meta_product_id
    FROM audit_logs AS audit
    LEFT JOIN products AS product ON product.id = CAST(audit.entity_id AS INTEGER)
    LEFT JOIN product_admin_meta AS meta ON meta.product_id = product.id
    WHERE audit.id IN (${auditIds.map(() => "?").join(", ")})
      AND audit.action = 'product.bulk_created'
      AND audit.entity_type = 'product'
    ORDER BY audit.id ASC
  `).bind(...auditIds).all<{
    id: string;
    entity_id: string;
    product_id: number | null;
    meta_product_id: number | null;
  }>();
  const indexedRows = auditRows.results.map((row) => ({
    index: parseProductImportAuditIndex(row.id, requestId),
    productId: parseReplayProductId(row),
  })).sort((left, right) => left.index - right.index);
  if (
    indexedRows.length === 0
    || indexedRows.some((row, index) => row.index !== index)
    || new Set(indexedRows.map((row) => row.productId)).size !== indexedRows.length
  ) {
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
    statements.push(buildProductImportPostcondition(
      database,
      actorSubject,
      requestId,
      payloadSha256,
      chunk,
      chunkIndex * ADMIN_PRODUCT_IMPORT_CHUNK_ROWS,
    ));
  }
  const results = await batchDatabase.batch(statements);
  const returnedRows = readReturnedProductRows(results, chunks)
    ?? await readCommittedProductRows(database, entries);
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

function buildProductImportPostcondition(
  database: D1DatabaseLike,
  actorSubject: string,
  requestId: string,
  payloadSha256: string,
  entries: readonly AdminProductImportEntry[],
  indexOffset: number,
): D1PreparedStatementLike {
  const expectedRows = entries.map(() => "SELECT ? AS slug, ? AS lead_time_days").join(" UNION ALL ");
  const auditPlaceholders = entries.map(() => "?").join(", ");
  const values = [
    requestId,
    `${ADMIN_PRODUCT_IMPORT_AUDIT_NAMESPACE}:${requestId}`,
    payloadSha256,
    ...entries.flatMap(({ input }) => [input.slug, input.leadTimeDays]),
    actorSubject,
    ...entries.map((_, index) => adminProductImportAuditId(requestId, indexOffset + index)),
    entries.length,
  ];

  return database.prepare(`
    /* product import postcondition */
    INSERT INTO admin_audit_log (
      request_id, actor_subject, action, entity_type, entity_key,
      previous_revision, resulting_revision, payload_sha256
    )
    SELECT NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
    WHERE NOT (
      EXISTS (
        SELECT 1
        FROM admin_audit_log
        WHERE request_id = ?
          AND action = 'create'
          AND entity_type = 'product'
          AND entity_key = ?
          AND resulting_revision = 1
          AND payload_sha256 = ?
      )
      AND NOT EXISTS (
        WITH expected(slug, lead_time_days) AS (${expectedRows})
        SELECT 1
        FROM expected
        LEFT JOIN products AS product ON product.slug = expected.slug
        LEFT JOIN product_admin_meta AS meta ON meta.product_id = product.id
        WHERE product.id IS NULL
           OR product.is_active <> 0
           OR meta.product_id IS NULL
           OR meta.status <> 'draft'
           OR meta.lead_time_days IS NOT expected.lead_time_days
           OR meta.updated_by IS NOT ?
      )
      AND (
        SELECT COUNT(*)
        FROM audit_logs
        WHERE id IN (${auditPlaceholders})
          AND action = 'product.bulk_created'
          AND entity_type = 'product'
      ) = ?
    )
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

function readReturnedProductRows(
  results: D1BatchResultLike[] | undefined,
  chunks: readonly (readonly AdminProductImportEntry[])[],
): Array<{ id: number; slug: string }> | null {
  if (!Array.isArray(results) || results.length !== 1 + chunks.length * 4) return null;
  const returnedRows: Array<{ id: number; slug: string }> = [];
  let resultIndex = 1;
  for (const chunk of chunks) {
    const chunkRows = readProductRows(results[resultIndex]?.results);
    if (chunkRows.length !== chunk.length) return null;
    returnedRows.push(...chunkRows);
    resultIndex += 4;
  }
  return returnedRows.length === chunks.reduce((total, chunk) => total + chunk.length, 0)
    ? returnedRows
    : null;
}

async function readCommittedProductRows(
  database: D1DatabaseLike,
  entries: readonly AdminProductImportEntry[],
): Promise<Array<{ id: number; slug: string }>> {
  const slugs = entries.map(({ input }) => input.slug);
  const result = await database.prepare(`
    SELECT id, slug
    FROM products
    WHERE slug IN (${slugs.map(() => "?").join(", ")})
    ORDER BY slug ASC
  `).bind(...slugs).all<{ id: number; slug: string }>();
  const rows = readProductRows(result.results);
  if (rows.length !== entries.length) {
    throw new AdminProductImportWriteError("Không đối chiếu được sản phẩm vừa nhập sau khi commit.");
  }
  return rows;
}

function parseProductId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw new AdminProductImportWriteError("Audit sản phẩm chứa ID không hợp lệ.");
  }
  return id;
}

function parseReplayProductId(row: {
  entity_id: string;
  product_id?: number | null;
  meta_product_id?: number | null;
}): number {
  const productId = parseProductId(row.entity_id);
  if (row.product_id !== productId || row.meta_product_id !== productId) {
    throw new AdminProductImportWriteError("Kết quả lần nhập không còn đủ dữ liệu sản phẩm.");
  }
  return productId;
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

function requireBatch(database: D1DatabaseLike): D1BatchDatabaseLike {
  const candidate = database as D1DatabaseLike & { batch?: D1BatchDatabaseLike["batch"] };
  if (typeof candidate.batch !== "function") {
    throw new AdminProductImportWriteError("D1 batch() là bắt buộc để ghi sản phẩm an toàn.");
  }
  return candidate as D1BatchDatabaseLike;
}
