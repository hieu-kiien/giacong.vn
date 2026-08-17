import type {
  AdminProductInput,
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "./admin-data.ts";

interface D1BatchResultLike {
  results?: unknown[];
}

interface D1BatchDatabaseLike extends D1DatabaseLike {
  batch(statements: D1PreparedStatementLike[]): Promise<D1BatchResultLike[]>;
}

export class AdminProductStaleWriteError extends Error {
  constructor() {
    super("Dữ liệu sản phẩm đã thay đổi. Hãy tải lại trước khi lưu.");
    this.name = "AdminProductStaleWriteError";
  }
}

export class AdminProductAtomicWriteError extends Error {}

export async function createAdminProductAtomically(
  database: D1DatabaseLike,
  input: AdminProductInput,
  actorSubject: string,
): Promise<number> {
  const batchDatabase = requireBatch(database);
  const auditId = crypto.randomUUID();
  const statements: D1PreparedStatementLike[] = [
    database.prepare(`
      INSERT INTO products (
        name, slug, sku, short_description, description, image_url,
        category_id, is_active, revision
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      RETURNING id
    `).bind(
      input.name,
      input.slug,
      input.sku,
      input.shortDescription,
      input.description,
      input.imageUrl,
      input.categoryId,
      input.isActive ? 1 : 0,
    ),
    database.prepare(`
      INSERT INTO product_admin_meta (
        product_id, status, lead_time_days, updated_by, updated_at
      )
      SELECT id, ?, ?, ?, CURRENT_TIMESTAMP
      FROM products
      WHERE slug = ? AND sku = ?
      LIMIT 1
      ON CONFLICT(product_id) DO UPDATE SET
        status = excluded.status,
        lead_time_days = excluded.lead_time_days,
        updated_by = excluded.updated_by,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      input.status,
      input.leadTimeDays,
      actorSubject,
      input.slug,
      input.sku,
    ),
    database.prepare(`
      INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
      SELECT ?, ?, 'product.created', 'product', CAST(id AS TEXT), ?
      FROM products
      WHERE slug = ? AND sku = ?
      LIMIT 1
    `).bind(
      auditId,
      actorSubject,
      JSON.stringify({ input }),
      input.slug,
      input.sku,
    ),
  ];

  const results = await batchDatabase.batch(statements);
  const createdId = returningPositiveInteger(results[0]?.results, "id");
  if (!createdId) throw new AdminProductAtomicWriteError("Không đọc được ID sản phẩm vừa tạo.");
  return createdId;
}

export async function updateAdminProductAtomically(
  database: D1DatabaseLike,
  productId: number,
  input: AdminProductInput,
  expectedRevisionRaw: unknown,
  actorSubject: string,
): Promise<void> {
  const expectedRevision = requireRevision(expectedRevisionRaw, "cập nhật");
  const batchDatabase = requireBatch(database);
  const auditId = crypto.randomUUID();
  const metadataJson = JSON.stringify({ after: input, expectedRevision, productId });

  const statements: D1PreparedStatementLike[] = [
    revisionAuditMarker(
      database,
      auditId,
      actorSubject,
      "product.updated",
      productId,
      expectedRevision,
      metadataJson,
    ),
    database.prepare(`
      UPDATE products
      SET name = ?, slug = ?, sku = ?, short_description = ?, description = ?,
        image_url = ?, category_id = ?, is_active = ?, revision = revision + 1
      WHERE id = ? AND revision = ?
        AND EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)
    `).bind(
      input.name,
      input.slug,
      input.sku,
      input.shortDescription,
      input.description,
      input.imageUrl,
      input.categoryId,
      input.isActive ? 1 : 0,
      productId,
      expectedRevision,
      auditId,
    ),
    database.prepare(`
      INSERT INTO product_admin_meta (
        product_id, status, lead_time_days, updated_by, updated_at
      )
      SELECT ?, ?, ?, ?, CURRENT_TIMESTAMP
      WHERE EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)
      ON CONFLICT(product_id) DO UPDATE SET
        status = excluded.status,
        lead_time_days = excluded.lead_time_days,
        updated_by = excluded.updated_by,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      productId,
      input.status,
      input.leadTimeDays,
      actorSubject,
      auditId,
    ),
  ];

  const results = await batchDatabase.batch(statements);
  assertMarkerCreated(results[0]?.results);
}

export async function archiveAdminProductAtomically(
  database: D1DatabaseLike,
  productId: number,
  expectedRevisionRaw: unknown,
  actorSubject: string,
): Promise<void> {
  const expectedRevision = requireRevision(expectedRevisionRaw, "ẩn");
  const batchDatabase = requireBatch(database);
  const auditId = crypto.randomUUID();
  const metadataJson = JSON.stringify({ expectedRevision, productId });

  const statements: D1PreparedStatementLike[] = [
    revisionAuditMarker(
      database,
      auditId,
      actorSubject,
      "product.archived",
      productId,
      expectedRevision,
      metadataJson,
    ),
    database.prepare(`
      UPDATE products
      SET is_active = 0, revision = revision + 1
      WHERE id = ? AND revision = ?
        AND EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)
    `).bind(productId, expectedRevision, auditId),
    database.prepare(`
      INSERT INTO product_admin_meta (
        product_id, status, updated_by, updated_at
      )
      SELECT ?, 'archived', ?, CURRENT_TIMESTAMP
      WHERE EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)
      ON CONFLICT(product_id) DO UPDATE SET
        status = 'archived',
        updated_by = excluded.updated_by,
        updated_at = CURRENT_TIMESTAMP
    `).bind(productId, actorSubject, auditId),
  ];

  const results = await batchDatabase.batch(statements);
  assertMarkerCreated(results[0]?.results);
}

function revisionAuditMarker(
  database: D1DatabaseLike,
  auditId: string,
  actorSubject: string,
  action: string,
  productId: number,
  expectedRevision: number,
  metadataJson: string,
): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
    SELECT ?, ?, ?, 'product', ?, ?
    WHERE EXISTS (
      SELECT 1
      FROM products
      WHERE id = ? AND revision = ?
    )
    RETURNING id
  `).bind(
    auditId,
    actorSubject,
    action,
    String(productId),
    metadataJson,
    productId,
    expectedRevision,
  );
}

function assertMarkerCreated(rows: unknown[] | undefined): void {
  if (!Array.isArray(rows) || rows.length !== 1) throw new AdminProductStaleWriteError();
}

function returningPositiveInteger(rows: unknown[] | undefined, key: string): number | null {
  if (!Array.isArray(rows) || rows.length !== 1) return null;
  const row = rows[0];
  if (typeof row !== "object" || row === null || Array.isArray(row)) return null;
  const value = (row as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function requireRevision(value: unknown, action: string): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    throw new AdminProductAtomicWriteError(`Revision hiện tại là bắt buộc khi ${action} sản phẩm.`);
  }
  return Number(value);
}

function requireBatch(database: D1DatabaseLike): D1BatchDatabaseLike {
  const candidate = database as D1DatabaseLike & { batch?: D1BatchDatabaseLike["batch"] };
  if (typeof candidate.batch !== "function") {
    throw new AdminProductAtomicWriteError("D1 batch() là bắt buộc để ghi sản phẩm an toàn.");
  }
  return candidate as D1BatchDatabaseLike;
}
