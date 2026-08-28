import type { AdminProductInput, D1DatabaseLike, D1PreparedStatementLike } from "./admin-data.ts";
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

export async function findAdminProductImportReplay(
  database: D1DatabaseLike,
  requestId: string,
): Promise<AdminProductImportReplay | null> {
  const marker = await database.prepare(`
    SELECT request_id, payload_sha256
    FROM admin_audit_log
    WHERE request_id = ?
    LIMIT 1
  `).bind(requestId).first<{ request_id: string; payload_sha256: string }>();
  if (!marker) return null;
  if (typeof marker.payload_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(marker.payload_sha256)) {
    throw new AdminProductImportWriteError("Audit idempotency của lần nhập không hợp lệ.");
  }

  const auditRows = await database.prepare(`
    SELECT entity_id
    FROM audit_logs
    WHERE id LIKE ?
      AND action = 'product.bulk_created'
      AND entity_type = 'product'
    ORDER BY id ASC
  `).bind(`bulk-product-import:${requestId}:%`).all<{ entity_id: string }>();
  const productIds = auditRows.results.map((row) => parseProductId(row.entity_id));
  if (productIds.length === 0) {
    throw new AdminProductImportWriteError("Không đọc được kết quả lần nhập đã ghi nhận.");
  }
  return { payloadSha256: marker.payload_sha256, productIds };
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

  const batchDatabase = requireBatch(database);
  const statements: D1PreparedStatementLike[] = [
    buildIdempotencyMarker(database, actorSubject, requestId, payloadSha256),
    buildProductInsert(database, entries),
    buildProductMetaInsert(database, entries, actorSubject),
    buildProductAuditInsert(database, entries, actorSubject, requestId, payloadSha256),
  ];
  const results = await batchDatabase.batch(statements);
  assertSingleResult(results[0]?.results, "request ID");
  assertResultCount(results[2]?.results, entries.length, "metadata sản phẩm");
  assertResultCount(results[3]?.results, entries.length, "audit sản phẩm");

  const returnedRows = readProductRows(results[1]?.results);
  if (returnedRows.length !== entries.length) {
    throw new AdminProductImportWriteError("Không đọc đủ sản phẩm vừa nhập.");
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
    ) VALUES (?, ?, 'create', 'product', ?, NULL, NULL, ?)
    RETURNING request_id
  `).bind(
    requestId,
    actorSubject,
    `bulk-product-import:${requestId}`,
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
): D1PreparedStatementLike {
  const selects = entries.map(({ input, rowNumber }, index) => `
    SELECT ?, ?, 'product.bulk_created', 'product', CAST(id AS TEXT), ?
    FROM products
    WHERE slug = ?
  `).join(" UNION ALL ");
  const values = entries.flatMap(({ input, rowNumber }, index) => [
    `bulk-product-import:${requestId}:${String(index).padStart(3, "0")}`,
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
