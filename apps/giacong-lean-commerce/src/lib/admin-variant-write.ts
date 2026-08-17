import type {
  AdminProductVariantInput,
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "./admin-data.ts";

interface D1BatchResultLike {
  results?: unknown[];
}

interface D1BatchDatabaseLike extends D1DatabaseLike {
  batch(statements: D1PreparedStatementLike[]): Promise<D1BatchResultLike[]>;
}

export class AdminVariantStaleWriteError extends Error {
  constructor() {
    super("Dữ liệu variant đã thay đổi. Hãy tải lại trước khi lưu.");
    this.name = "AdminVariantStaleWriteError";
  }
}

export class AdminVariantAtomicWriteError extends Error {}

/** Create the variant, all tiers and its audit record in one D1 transaction. */
export async function createAdminVariantAtomically(
  database: D1DatabaseLike,
  productId: number,
  input: AdminProductVariantInput,
  actorSubject: string,
): Promise<number> {
  const batchDatabase = requireBatch(database);
  const auditId = crypto.randomUUID();
  const metadataJson = JSON.stringify({ input, productId });
  const statements: D1PreparedStatementLike[] = [
    database.prepare(`
      INSERT INTO product_variants (
        product_id, name, sku, option_label, unit, moq, quantity_step,
        contact_from_quantity, is_available, sort_order, attribute_id,
        attribute_code, attribute_label, option_id, image_url, revision
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      RETURNING id
    `).bind(
      productId,
      input.name,
      input.sku,
      input.optionLabel,
      input.unit,
      input.moq,
      input.quantityStep,
      input.contactFromQuantity,
      input.isAvailable ? 1 : 0,
      input.sortOrder,
      input.attributeId,
      input.attributeCode,
      input.attributeLabel,
      input.optionId,
      input.imageUrl,
    ),
  ];

  for (const tier of input.tierPrices) {
    statements.push(database.prepare(`
      INSERT INTO variant_tier_prices (variant_id, min_quantity, price, currency)
      SELECT id, ?, ?, ?
      FROM product_variants
      WHERE product_id = ? AND sku = ?
      LIMIT 1
    `).bind(
      tier.minQuantity,
      tier.price,
      tier.currency,
      productId,
      input.sku,
    ));
  }

  statements.push(database.prepare(`
    INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
    SELECT ?, ?, 'variant.created', 'variant', CAST(id AS TEXT), ?
    FROM product_variants
    WHERE product_id = ? AND sku = ?
    LIMIT 1
  `).bind(
    auditId,
    actorSubject,
    metadataJson,
    productId,
    input.sku,
  ));

  const results = await batchDatabase.batch(statements);
  const createdId = returningPositiveInteger(results[0]?.results, "id");
  if (!createdId) throw new AdminVariantAtomicWriteError("Không đọc được ID variant vừa tạo.");
  return createdId;
}

/**
 * Atomically updates one variant, replaces all tier prices and records the audit row.
 *
 * The audit marker is inserted first only when the expected revision still matches.
 * Every later write is guarded by that fresh marker id. A stale request therefore
 * produces a transaction containing only no-op statements, while constraint failures
 * during a valid mutation make D1 roll back the whole batch.
 */
export async function updateAdminVariantAtomically(
  database: D1DatabaseLike,
  productId: number,
  variantId: number,
  input: AdminProductVariantInput,
  actorSubject: string,
): Promise<void> {
  const expectedRevision = requireRevision(input.revision, "cập nhật");
  const batchDatabase = requireBatch(database);
  const auditId = crypto.randomUUID();
  const metadataJson = JSON.stringify({
    after: input,
    expectedRevision,
    productId,
    variantId,
  });

  const statements: D1PreparedStatementLike[] = [
    revisionAuditMarker(
      database,
      auditId,
      actorSubject,
      "variant.updated",
      productId,
      variantId,
      expectedRevision,
      metadataJson,
    ),
    database.prepare(`
      UPDATE product_variants
      SET name = ?, sku = ?, option_label = ?, unit = ?, moq = ?, quantity_step = ?,
        contact_from_quantity = ?, is_available = ?, sort_order = ?, attribute_id = ?,
        attribute_code = ?, attribute_label = ?, option_id = ?, image_url = ?,
        revision = revision + 1, updated_at = CURRENT_TIMESTAMP
      WHERE product_id = ? AND id = ? AND revision = ?
        AND EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)
    `).bind(
      input.name,
      input.sku,
      input.optionLabel,
      input.unit,
      input.moq,
      input.quantityStep,
      input.contactFromQuantity,
      input.isAvailable ? 1 : 0,
      input.sortOrder,
      input.attributeId,
      input.attributeCode,
      input.attributeLabel,
      input.optionId,
      input.imageUrl,
      productId,
      variantId,
      expectedRevision,
      auditId,
    ),
    database.prepare(`
      DELETE FROM variant_tier_prices
      WHERE variant_id = ?
        AND EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)
    `).bind(variantId, auditId),
  ];

  for (const tier of input.tierPrices) {
    statements.push(database.prepare(`
      INSERT INTO variant_tier_prices (variant_id, min_quantity, price, currency)
      SELECT ?, ?, ?, ?
      WHERE EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)
    `).bind(
      variantId,
      tier.minQuantity,
      tier.price,
      tier.currency,
      auditId,
    ));
  }

  const results = await batchDatabase.batch(statements);
  assertMarkerCreated(results[0]?.results);
}

/** Soft-archive a variant with exact-revision CAS and audit in one batch. */
export async function archiveAdminVariantAtomically(
  database: D1DatabaseLike,
  productId: number,
  variantId: number,
  expectedRevisionRaw: unknown,
  actorSubject: string,
): Promise<void> {
  const expectedRevision = requireRevision(expectedRevisionRaw, "ẩn");
  const batchDatabase = requireBatch(database);
  const auditId = crypto.randomUUID();
  const metadataJson = JSON.stringify({ expectedRevision, productId, variantId });
  const statements: D1PreparedStatementLike[] = [
    revisionAuditMarker(
      database,
      auditId,
      actorSubject,
      "variant.archived",
      productId,
      variantId,
      expectedRevision,
      metadataJson,
    ),
    database.prepare(`
      UPDATE product_variants
      SET is_available = 0, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
      WHERE product_id = ? AND id = ? AND revision = ?
        AND EXISTS (SELECT 1 FROM audit_logs WHERE id = ?)
    `).bind(productId, variantId, expectedRevision, auditId),
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
  variantId: number,
  expectedRevision: number,
  metadataJson: string,
): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
    SELECT ?, ?, ?, 'variant', ?, ?
    WHERE EXISTS (
      SELECT 1
      FROM product_variants
      WHERE product_id = ? AND id = ? AND revision = ?
    )
    RETURNING id
  `).bind(
    auditId,
    actorSubject,
    action,
    String(variantId),
    metadataJson,
    productId,
    variantId,
    expectedRevision,
  );
}

function assertMarkerCreated(rows: unknown[] | undefined): void {
  if (!Array.isArray(rows) || rows.length !== 1) throw new AdminVariantStaleWriteError();
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
    throw new AdminVariantAtomicWriteError(`Revision hiện tại là bắt buộc khi ${action} variant.`);
  }
  return Number(value);
}

function requireBatch(database: D1DatabaseLike): D1BatchDatabaseLike {
  const candidate = database as D1DatabaseLike & { batch?: D1BatchDatabaseLike["batch"] };
  if (typeof candidate.batch !== "function") {
    throw new AdminVariantAtomicWriteError("D1 batch() là bắt buộc để ghi variant an toàn.");
  }
  return candidate as D1BatchDatabaseLike;
}
