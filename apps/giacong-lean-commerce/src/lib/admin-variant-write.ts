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
  const expectedRevision = input.revision;
  if (!Number.isInteger(expectedRevision) || Number(expectedRevision) < 1) {
    throw new AdminVariantAtomicWriteError("Revision hiện tại là bắt buộc khi cập nhật variant.");
  }

  const batchDatabase = requireBatch(database);
  const auditId = crypto.randomUUID();
  const metadataJson = JSON.stringify({
    after: input,
    expectedRevision,
    productId,
    variantId,
  });

  const statements: D1PreparedStatementLike[] = [
    database.prepare(`
      INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
      SELECT ?, ?, 'variant.updated', 'variant', ?, ?
      WHERE EXISTS (
        SELECT 1
        FROM product_variants
        WHERE product_id = ? AND id = ? AND revision = ?
      )
      RETURNING id
    `).bind(
      auditId,
      actorSubject,
      String(variantId),
      metadataJson,
      productId,
      variantId,
      expectedRevision,
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
  const auditRows = results[0]?.results;
  if (!Array.isArray(auditRows) || auditRows.length !== 1) {
    throw new AdminVariantStaleWriteError();
  }
}

function requireBatch(database: D1DatabaseLike): D1BatchDatabaseLike {
  const candidate = database as D1DatabaseLike & { batch?: D1BatchDatabaseLike["batch"] };
  if (typeof candidate.batch !== "function") {
    throw new AdminVariantAtomicWriteError("D1 batch() là bắt buộc để cập nhật variant an toàn.");
  }
  return candidate as D1BatchDatabaseLike;
}
