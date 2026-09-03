import type {
  AdminProduct,
  AdminProductInput,
  AdminProductVariant,
  AdminProductVariantInput,
  D1DatabaseLike,
  D1PreparedStatementLike,
} from "./admin-data.ts";
import { getAdminProduct, getAdminProductVariant, tableExists } from "./admin-data.ts";
import { isAdminRequestId } from "./admin-request.ts";

export class AdminCatalogWriteConflictError extends Error {}
export class AdminCatalogWriteIdempotencyConflictError extends Error {}
export class AdminCatalogWriteStorageError extends Error {}
export class AdminCatalogWriteValidationError extends Error {}

interface CatalogMutationRow {
  action: "create" | "delete" | "update";
  entity_key: string;
  entity_type: "product" | "variant";
  payload_sha256: string;
  request_id: string;
}

interface BatchResult {
  meta?: { changes?: number };
  results?: unknown[];
}

interface ProductMutationPostcondition {
  action: CatalogMutationRow["action"];
  entityId?: number;
  expectedRevision?: number;
  hasMeta: boolean;
  input?: AdminProductInput;
  payloadSha256: string;
  requestId: string;
}

interface DatabaseWithBatch extends D1DatabaseLike {
  batch(statements: D1PreparedStatementLike[]): Promise<BatchResult[]>;
}

type ProductVariantWriteInput = Omit<AdminProductVariantInput, "revision">;

interface VariantMutationPostcondition {
  action: CatalogMutationRow["action"];
  expectedRevision?: number;
  input?: ProductVariantWriteInput;
  payloadSha256: string;
  productId: number;
  requestId: string;
  variantId?: number;
}

export async function createAdminProductAtomically(
  database: D1DatabaseLike,
  input: AdminProductInput,
  actorSubject: string,
  requestId: string,
): Promise<AdminProduct> {
  const normalizedRequestId = normalizeRequestId(requestId);
  const payloadSha256 = await fingerprint({ entityType: "product", input, operation: "create" });
  await requireAuditTable(database);
  const hasMeta = await tableExists(database, "product_admin_meta");
  const postcondition = createProductMutationPostcondition(normalizedRequestId, "create", payloadSha256, input, undefined, hasMeta);
  const existingMutation = await findMutation(database, normalizedRequestId);
  if (existingMutation) {
    assertMatchingMutation(existingMutation, normalizedRequestId, "create", "product", payloadSha256);
    return ensureProductMutationComplete(database, existingMutation, postcondition);
  }

  const databaseWithBatch = requireBatch(database);
  const insert = database.prepare(`
    INSERT INTO products (
      name, slug, sku, short_description, description, image_url, category_id, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id, revision
  `).bind(
    input.name,
    input.slug,
    input.sku,
    input.shortDescription,
    input.description,
    input.imageUrl,
    input.categoryId,
    input.isActive ? 1 : 0,
  );
  const audit = database.prepare(`
    INSERT INTO admin_audit_log (
      request_id, actor_subject, action, entity_type, entity_key,
      previous_revision, resulting_revision, payload_sha256
    )
    SELECT ?, ?, 'create', 'product', CAST(id AS TEXT), NULL, revision, ?
    FROM products
    WHERE slug = ? AND changes() = 1
    LIMIT 1
    RETURNING request_id
  `).bind(normalizedRequestId, actorSubject, payloadSha256, input.slug);
  const statements: D1PreparedStatementLike[] = [insert, audit];
  if (hasMeta) statements.push(buildProductMetaWrite(database, input, actorSubject, normalizedRequestId));
  statements.push(buildProductPostconditionAssertion(database, postcondition));

  try {
    const results = await databaseWithBatch.batch(statements);
    assertChanged(results[0], "Không ghi được sản phẩm.");
    assertChanged(results[1], "Không ghi được audit sản phẩm.");
    if (hasMeta) assertChanged(results[2], "Không đồng bộ được trạng thái sản phẩm.");
  } catch (error) {
    const racedMutation = await findMutation(database, normalizedRequestId);
    if (racedMutation) {
      assertMatchingMutation(racedMutation, normalizedRequestId, "create", "product", payloadSha256);
      return ensureProductMutationComplete(database, racedMutation, postcondition);
    }
    throw normalizeCatalogBatchError(error);
  }

  const mutation = await findMutation(database, normalizedRequestId);
  if (!mutation) throw new AdminCatalogWriteStorageError("Không đọc lại được audit sản phẩm vừa tạo.");
  return ensureProductMutationComplete(database, mutation, postcondition);
}

export async function updateAdminProductAtomically(
  database: D1DatabaseLike,
  id: number,
  input: AdminProductInput,
  expectedRevision: number,
  actorSubject: string,
  requestId: string,
): Promise<AdminProduct | null> {
  const normalizedRequestId = normalizeRequestId(requestId);
  const payloadSha256 = await fingerprint({ entityType: "product", expectedRevision, id, input, operation: "update" });
  await requireAuditTable(database);
  const hasMeta = await tableExists(database, "product_admin_meta");
  const postcondition = createProductMutationPostcondition(normalizedRequestId, "update", payloadSha256, input, id, hasMeta, expectedRevision);
  const existingMutation = await findMutation(database, normalizedRequestId);
  if (existingMutation) {
    assertMatchingMutation(existingMutation, normalizedRequestId, "update", "product", payloadSha256);
    return ensureProductMutationComplete(database, existingMutation, postcondition);
  }

  const existing = await getAdminProduct(database, id);
  if (!existing) return null;
  assertExpectedRevision(existing.revision, expectedRevision, "Sản phẩm đã thay đổi. Hãy tải lại trước khi lưu.");

  const databaseWithBatch = requireBatch(database);
  const update = database.prepare(`
    UPDATE products
    SET name = ?, slug = ?, sku = ?, short_description = ?, description = ?,
      image_url = ?, category_id = ?, is_active = ?,
      revision = revision + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND revision = ?
    RETURNING id, revision
  `).bind(
    input.name,
    input.slug,
    input.sku,
    input.shortDescription,
    input.description,
    input.imageUrl,
    input.categoryId,
    input.isActive ? 1 : 0,
    id,
    expectedRevision,
  );
  const audit = buildProductAudit(database, normalizedRequestId, actorSubject, "update", id, expectedRevision, payloadSha256);
  const statements: D1PreparedStatementLike[] = [update, audit];
  if (hasMeta) statements.push(buildProductMetaWrite(database, input, actorSubject, normalizedRequestId, id));
  statements.push(buildProductPostconditionAssertion(database, postcondition));

  try {
    const results = await databaseWithBatch.batch(statements);
    if (!hasRows(results[0])) return resolveProductConflict(database, normalizedRequestId, payloadSha256, postcondition);
    assertChanged(results[1], "Không ghi được audit sản phẩm.");
    if (hasMeta) assertChanged(results[2], "Không đồng bộ được trạng thái sản phẩm.");
  } catch (error) {
    const racedMutation = await findMutation(database, normalizedRequestId);
    if (racedMutation) {
      assertMatchingMutation(racedMutation, normalizedRequestId, "update", "product", payloadSha256);
      return ensureProductMutationComplete(database, racedMutation, postcondition);
    }
    throw normalizeCatalogBatchError(error);
  }
  const mutation = await findMutation(database, normalizedRequestId);
  if (!mutation) throw new AdminCatalogWriteStorageError("Không đọc lại được audit sản phẩm vừa cập nhật.");
  return ensureProductMutationComplete(database, mutation, postcondition);
}

export async function archiveAdminProductAtomically(
  database: D1DatabaseLike,
  id: number,
  expectedRevision: number,
  actorSubject: string,
  requestId: string,
): Promise<AdminProduct | null> {
  const normalizedRequestId = normalizeRequestId(requestId);
  const payloadSha256 = await fingerprint({ entityType: "product", expectedRevision, id, operation: "archive" });
  await requireAuditTable(database);
  const hasMeta = await tableExists(database, "product_admin_meta");
  const postcondition = createProductMutationPostcondition(normalizedRequestId, "delete", payloadSha256, undefined, id, hasMeta, expectedRevision);
  const existingMutation = await findMutation(database, normalizedRequestId);
  if (existingMutation) {
    assertMatchingMutation(existingMutation, normalizedRequestId, "delete", "product", payloadSha256);
    return ensureProductMutationComplete(database, existingMutation, postcondition);
  }

  const existing = await getAdminProduct(database, id);
  if (!existing) return null;
  assertExpectedRevision(existing.revision, expectedRevision, "Sản phẩm đã thay đổi. Hãy tải lại trước khi ẩn.");

  const databaseWithBatch = requireBatch(database);
  const update = database.prepare(`
    UPDATE products
    SET is_active = 0, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND revision = ?
    RETURNING id, revision
  `).bind(id, expectedRevision);
  const audit = buildProductAudit(database, normalizedRequestId, actorSubject, "delete", id, expectedRevision, payloadSha256);
  const statements: D1PreparedStatementLike[] = [update, audit];
  if (hasMeta) statements.push(buildProductArchiveMeta(database, id, actorSubject, normalizedRequestId));
  statements.push(buildProductPostconditionAssertion(database, postcondition));

  try {
    const results = await databaseWithBatch.batch(statements);
    if (!hasRows(results[0])) return resolveProductConflict(database, normalizedRequestId, payloadSha256, postcondition);
    assertChanged(results[1], "Không ghi được audit ẩn sản phẩm.");
    if (hasMeta) assertChanged(results[2], "Không đồng bộ được trạng thái sản phẩm.");
  } catch (error) {
    const racedMutation = await findMutation(database, normalizedRequestId);
    if (racedMutation) {
      assertMatchingMutation(racedMutation, normalizedRequestId, "delete", "product", payloadSha256);
      return ensureProductMutationComplete(database, racedMutation, postcondition);
    }
    throw normalizeCatalogBatchError(error);
  }
  const mutation = await findMutation(database, normalizedRequestId);
  if (!mutation) throw new AdminCatalogWriteStorageError("Không đọc lại được audit sản phẩm vừa ẩn.");
  return ensureProductMutationComplete(database, mutation, postcondition);
}

export async function createAdminProductVariantAtomically(
  database: D1DatabaseLike,
  productId: number,
  input: ProductVariantWriteInput,
  actorSubject: string,
  requestId: string,
): Promise<AdminProductVariant | null> {
  const normalizedRequestId = normalizeRequestId(requestId);
  const payloadSha256 = await fingerprint({ entityType: "variant", input, operation: "create", productId });
  await requireAuditTable(database);
  const postcondition = createVariantMutationPostcondition(normalizedRequestId, "create", payloadSha256, productId, input);
  const existingMutation = await findMutation(database, normalizedRequestId);
  if (existingMutation) {
    assertMatchingMutation(existingMutation, normalizedRequestId, "create", "variant", payloadSha256);
    return ensureVariantMutationComplete(database, existingMutation, postcondition);
  }
  if (!await getAdminProduct(database, productId)) return null;

  const databaseWithBatch = requireBatch(database);
  const insert = buildVariantInsert(database, productId, input);
  const audit = database.prepare(`
    INSERT INTO admin_audit_log (
      request_id, actor_subject, action, entity_type, entity_key,
      previous_revision, resulting_revision, payload_sha256
    )
    SELECT ?, ?, 'create', 'variant', CAST(id AS TEXT), NULL, revision, ?
    FROM product_variants
    WHERE product_id = ? AND sku = ? AND changes() = 1
    LIMIT 1
    RETURNING request_id
  `).bind(normalizedRequestId, actorSubject, payloadSha256, productId, input.sku);
  const statements: D1PreparedStatementLike[] = [insert, audit];
  for (const tier of input.tierPrices) {
    statements.push(buildCreatedVariantTier(database, productId, input.sku, tier, normalizedRequestId));
  }
  statements.push(buildVariantPostconditionAssertion(database, postcondition));

  try {
    await databaseWithBatch.batch(statements);
  } catch (error) {
    const racedMutation = await findMutation(database, normalizedRequestId);
    if (racedMutation) {
      assertMatchingMutation(racedMutation, normalizedRequestId, "create", "variant", payloadSha256);
      return ensureVariantMutationComplete(database, racedMutation, postcondition);
    }
    throw normalizeCatalogBatchError(error);
  }
  const mutation = await findMutation(database, normalizedRequestId);
  if (!mutation) throw new AdminCatalogWriteStorageError("Không đọc lại được audit variant vừa tạo.");
  return ensureVariantMutationComplete(database, mutation, postcondition);
}

export async function updateAdminProductVariantAtomically(
  database: D1DatabaseLike,
  productId: number,
  variantId: number,
  input: ProductVariantWriteInput,
  expectedRevision: number,
  actorSubject: string,
  requestId: string,
): Promise<AdminProductVariant | null> {
  const normalizedRequestId = normalizeRequestId(requestId);
  const payloadSha256 = await fingerprint({ entityType: "variant", expectedRevision, input, operation: "update", productId, variantId });
  await requireAuditTable(database);
  const postcondition = createVariantMutationPostcondition(normalizedRequestId, "update", payloadSha256, productId, input, variantId, expectedRevision);
  const existingMutation = await findMutation(database, normalizedRequestId);
  if (existingMutation) {
    assertMatchingMutation(existingMutation, normalizedRequestId, "update", "variant", payloadSha256);
    return ensureVariantMutationComplete(database, existingMutation, postcondition);
  }

  const existing = await getAdminProductVariant(database, productId, variantId);
  if (!existing) return null;
  assertExpectedRevision(existing.revision, expectedRevision, "Variant đã thay đổi. Hãy tải lại trước khi lưu.");

  const databaseWithBatch = requireBatch(database);
  const update = buildVariantUpdate(database, productId, variantId, input, expectedRevision);
  const audit = buildVariantAudit(database, normalizedRequestId, actorSubject, "update", productId, variantId, expectedRevision, payloadSha256);
  const statements: D1PreparedStatementLike[] = [update, audit, buildTierDelete(database, variantId, normalizedRequestId)];
  for (const tier of input.tierPrices) statements.push(buildVariantTier(database, variantId, tier, normalizedRequestId));
  statements.push(buildVariantPostconditionAssertion(database, postcondition));

  try {
    const results = await databaseWithBatch.batch(statements);
    if (!hasRows(results[0])) return resolveVariantConflict(database, normalizedRequestId, payloadSha256, postcondition);
  } catch (error) {
    const racedMutation = await findMutation(database, normalizedRequestId);
    if (racedMutation) {
      assertMatchingMutation(racedMutation, normalizedRequestId, "update", "variant", payloadSha256);
      return ensureVariantMutationComplete(database, racedMutation, postcondition);
    }
    throw normalizeCatalogBatchError(error);
  }
  const mutation = await findMutation(database, normalizedRequestId);
  if (!mutation) throw new AdminCatalogWriteStorageError("Không đọc lại được audit variant vừa cập nhật.");
  return ensureVariantMutationComplete(database, mutation, postcondition);
}

export async function archiveAdminProductVariantAtomically(
  database: D1DatabaseLike,
  productId: number,
  variantId: number,
  expectedRevision: number,
  actorSubject: string,
  requestId: string,
): Promise<AdminProductVariant | null> {
  const normalizedRequestId = normalizeRequestId(requestId);
  const payloadSha256 = await fingerprint({ entityType: "variant", expectedRevision, operation: "archive", productId, variantId });
  await requireAuditTable(database);
  const postcondition = createVariantMutationPostcondition(normalizedRequestId, "delete", payloadSha256, productId, undefined, variantId, expectedRevision);
  const existingMutation = await findMutation(database, normalizedRequestId);
  if (existingMutation) {
    assertMatchingMutation(existingMutation, normalizedRequestId, "delete", "variant", payloadSha256);
    return ensureVariantMutationComplete(database, existingMutation, postcondition);
  }

  const existing = await getAdminProductVariant(database, productId, variantId);
  if (!existing) return null;
  assertExpectedRevision(existing.revision, expectedRevision, "Variant đã thay đổi. Hãy tải lại trước khi ẩn.");

  const databaseWithBatch = requireBatch(database);
  const update = database.prepare(`
    UPDATE product_variants
    SET is_available = 0, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
    WHERE product_id = ? AND id = ? AND revision = ? AND is_available = 1
    RETURNING id, revision
  `).bind(productId, variantId, expectedRevision);
  const audit = buildVariantAudit(database, normalizedRequestId, actorSubject, "delete", productId, variantId, expectedRevision, payloadSha256);
  try {
    const results = await databaseWithBatch.batch([update, audit, buildVariantPostconditionAssertion(database, postcondition)]);
    if (!hasRows(results[0])) return resolveVariantConflict(database, normalizedRequestId, payloadSha256, postcondition);
  } catch (error) {
    const racedMutation = await findMutation(database, normalizedRequestId);
    if (racedMutation) {
      assertMatchingMutation(racedMutation, normalizedRequestId, "delete", "variant", payloadSha256);
      return ensureVariantMutationComplete(database, racedMutation, postcondition);
    }
    throw normalizeCatalogBatchError(error);
  }
  const mutation = await findMutation(database, normalizedRequestId);
  if (!mutation) throw new AdminCatalogWriteStorageError("Không đọc lại được audit variant vừa ẩn.");
  return ensureVariantMutationComplete(database, mutation, postcondition);
}

async function requireAuditTable(database: D1DatabaseLike): Promise<void> {
  if (!await tableExists(database, "admin_audit_log")) {
    throw new AdminCatalogWriteStorageError("Bảng audit catalog chưa được triển khai.");
  }
}

function requireBatch(database: D1DatabaseLike): DatabaseWithBatch {
  const databaseWithBatch = database as DatabaseWithBatch;
  if (typeof databaseWithBatch.batch !== "function") {
    throw new AdminCatalogWriteStorageError("D1 batch() là bắt buộc cho thao tác catalog an toàn.");
  }
  return databaseWithBatch;
}

async function findMutation(database: D1DatabaseLike, requestId: string): Promise<CatalogMutationRow | null> {
  return database.prepare(`
    SELECT action, entity_key, entity_type, payload_sha256, request_id
    FROM admin_audit_log
    WHERE request_id = ?
    LIMIT 1
  `).bind(requestId).first<CatalogMutationRow>();
}

function assertMatchingMutation(
  mutation: CatalogMutationRow,
  requestId: string,
  action: CatalogMutationRow["action"],
  entityType: CatalogMutationRow["entity_type"],
  payloadSha256: string,
): void {
  if (mutation.request_id !== requestId || mutation.action !== action || mutation.entity_type !== entityType || mutation.payload_sha256 !== payloadSha256) {
    throw new AdminCatalogWriteIdempotencyConflictError("requestId đã được dùng cho một payload khác.");
  }
}

async function readProductMutation(database: D1DatabaseLike, mutation: CatalogMutationRow): Promise<AdminProduct> {
  const id = Number(mutation.entity_key);
  const product = Number.isSafeInteger(id) && id > 0 ? await getAdminProduct(database, id) : null;
  if (!product) throw new AdminCatalogWriteStorageError("Không đọc lại được sản phẩm từ audit.");
  return product;
}

async function readVariantMutation(database: D1DatabaseLike, mutation: CatalogMutationRow): Promise<AdminProductVariant> {
  const id = Number(mutation.entity_key);
  const variant = Number.isSafeInteger(id) && id > 0
    ? await readVariantById(database, id)
    : null;
  if (!variant) throw new AdminCatalogWriteStorageError("Không đọc lại được variant từ audit.");
  return variant;
}

async function readVariantById(database: D1DatabaseLike, variantId: number): Promise<AdminProductVariant | null> {
  const row = await database.prepare("SELECT product_id FROM product_variants WHERE id = ? LIMIT 1")
    .bind(variantId)
    .first<{ product_id: number }>();
  return row ? getAdminProductVariant(database, row.product_id, variantId) : null;
}

function createProductMutationPostcondition(
  requestId: string,
  action: CatalogMutationRow["action"],
  payloadSha256: string,
  input: AdminProductInput | undefined,
  entityId: number | undefined,
  hasMeta: boolean,
  expectedRevision?: number,
): ProductMutationPostcondition {
  return { action, entityId, expectedRevision, hasMeta, input, payloadSha256, requestId };
}

function buildProductPostconditionAssertion(
  database: D1DatabaseLike,
  postcondition: ProductMutationPostcondition,
): D1PreparedStatementLike {
  const commit = buildProductMutationCommitExpression(postcondition);
  const started = buildProductMutationStartedExpression(postcondition);
  return database.prepare(`
    /* catalog-product-postcondition-assert */
    INSERT INTO admin_audit_log (
      request_id, actor_subject, action, entity_type, entity_key,
      previous_revision, resulting_revision, payload_sha256
    )
    SELECT NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
    WHERE (${started.expression}
      OR EXISTS (
        SELECT 1
        FROM admin_audit_log
        WHERE request_id = ?
      ))
      AND NOT (${commit.expression})
  `).bind(...started.values, postcondition.requestId, ...commit.values);
}

async function ensureProductMutationComplete(
  database: D1DatabaseLike,
  mutation: CatalogMutationRow,
  postcondition: ProductMutationPostcondition,
): Promise<AdminProduct> {
  const replay = buildProductMutationReplayExpression(postcondition);
  const row = await database.prepare(`
    /* catalog-product-postcondition-read */
    SELECT CASE WHEN (${replay.expression}) THEN 1 ELSE 0 END AS complete
  `).bind(...replay.values).first<{ complete?: unknown }>();
  if (Number(row?.complete) !== 1) {
    throw new AdminCatalogWriteStorageError(
      "Không thể xác nhận đầy đủ trạng thái sản phẩm và audit; thao tác bị khóa để tránh báo thành công sai.",
    );
  }
  return readProductMutation(database, mutation);
}

function buildProductMutationReplayExpression(
  postcondition: ProductMutationPostcondition,
): { expression: string; values: unknown[] } {
  const revision = postcondition.expectedRevision === undefined
    ? { sql: "marker.previous_revision IS NULL AND marker.resulting_revision = 1", values: [] }
    : {
        sql: "marker.previous_revision = ? AND marker.resulting_revision = ?",
        values: [postcondition.expectedRevision, postcondition.expectedRevision + 1],
      };
  const entity = postcondition.entityId === undefined
    ? { sql: "", values: [] }
    : { sql: "AND product_row.id = ?", values: [postcondition.entityId] };
  const parts = [`EXISTS (
    SELECT 1
    FROM admin_audit_log marker
    JOIN products product_row ON product_row.id = CAST(marker.entity_key AS INTEGER)
    WHERE marker.request_id = ?
      AND marker.action = ?
      AND marker.entity_type = 'product'
      AND marker.payload_sha256 = ?
      ${entity.sql}
      AND ${revision.sql}
  )`];
  const values: unknown[] = [
    postcondition.requestId,
    postcondition.action,
    postcondition.payloadSha256,
    ...entity.values,
    ...revision.values,
  ];
  if (postcondition.hasMeta) {
    parts.push(`EXISTS (
      SELECT 1
      FROM product_admin_meta meta
      JOIN admin_audit_log marker
        ON marker.request_id = ?
       AND meta.product_id = CAST(marker.entity_key AS INTEGER)
      WHERE meta.updated_by IS NOT NULL
    )`);
    values.push(postcondition.requestId);
  }
  return { expression: parts.join("\n AND "), values };
}

function buildProductMutationStartedExpression(
  postcondition: ProductMutationPostcondition,
): { expression: string; values: unknown[] } {
  const input = postcondition.input;
  if (postcondition.entityId === undefined && input) {
    return {
      expression: `EXISTS (
        SELECT 1
        FROM products
        WHERE name = ?
          AND slug = ?
          AND sku = ?
          AND short_description = ?
          AND description = ?
          AND image_url IS ?
          AND category_id IS ?
          AND is_active = ?
          AND revision = 1
      )`,
      values: productInputValues(input),
    };
  }
  if (postcondition.entityId !== undefined && input) {
    return {
      expression: `EXISTS (
        SELECT 1
        FROM products
        WHERE id = ?
          AND revision = ?
          AND name = ?
          AND slug = ?
          AND sku = ?
          AND short_description = ?
          AND description = ?
          AND image_url IS ?
          AND category_id IS ?
          AND is_active = ?
      )`,
      values: [postcondition.entityId, (postcondition.expectedRevision ?? 0) + 1, ...productInputValues(input)],
    };
  }
  return {
    expression: `EXISTS (
      SELECT 1
      FROM products
      WHERE id = ?
        AND revision = ?
        AND is_active = 0
    )`,
    values: [postcondition.entityId, (postcondition.expectedRevision ?? 0) + 1],
  };
}

function buildProductMutationCommitExpression(
  postcondition: ProductMutationPostcondition,
): { expression: string; values: unknown[] } {
  const input = postcondition.input;
  const markerRevision = postcondition.expectedRevision === undefined
    ? { sql: "marker.previous_revision IS NULL AND marker.resulting_revision = 1", values: [] }
    : {
        sql: "marker.previous_revision = ? AND marker.resulting_revision = ?",
        values: [postcondition.expectedRevision, postcondition.expectedRevision + 1],
      };
  const productState = postcondition.entityId === undefined && input
    ? {
        sql: `product_row.name = ?
          AND product_row.slug = ?
          AND product_row.sku = ?
          AND product_row.short_description = ?
          AND product_row.description = ?
          AND product_row.image_url IS ?
          AND product_row.category_id IS ?
          AND product_row.is_active = ?
          AND product_row.revision = 1`,
        values: productInputValues(input),
      }
    : input
      ? {
          sql: `product_row.id = ?
            AND product_row.revision = ?
            AND product_row.name = ?
            AND product_row.slug = ?
            AND product_row.sku = ?
            AND product_row.short_description = ?
            AND product_row.description = ?
            AND product_row.image_url IS ?
            AND product_row.category_id IS ?
            AND product_row.is_active = ?`,
          values: [postcondition.entityId, (postcondition.expectedRevision ?? 0) + 1, ...productInputValues(input)],
        }
      : {
          sql: `product_row.id = ?
            AND product_row.revision = ?
            AND product_row.is_active = 0`,
          values: [postcondition.entityId, (postcondition.expectedRevision ?? 0) + 1],
        };
  const parts = [`EXISTS (
    SELECT 1
    FROM admin_audit_log marker
    JOIN products product_row ON product_row.id = CAST(marker.entity_key AS INTEGER)
    WHERE marker.request_id = ?
      AND marker.action = ?
      AND marker.entity_type = 'product'
      AND marker.payload_sha256 = ?
      AND ${markerRevision.sql}
      AND ${productState.sql}
  )`];
  const values: unknown[] = [
    postcondition.requestId,
    postcondition.action,
    postcondition.payloadSha256,
    ...markerRevision.values,
    ...productState.values,
  ];
  if (postcondition.hasMeta) {
    const status = input?.status ?? "archived";
    parts.push(input
      ? `EXISTS (
          SELECT 1
          FROM product_admin_meta meta
          JOIN admin_audit_log marker
            ON marker.request_id = ?
           AND meta.product_id = CAST(marker.entity_key AS INTEGER)
          WHERE meta.status = ?
            AND meta.lead_time_days IS ?
            AND meta.updated_by IS NOT NULL
        )`
      : `EXISTS (
          SELECT 1
          FROM product_admin_meta meta
          JOIN admin_audit_log marker
            ON marker.request_id = ?
           AND meta.product_id = CAST(marker.entity_key AS INTEGER)
          WHERE meta.status = ?
            AND meta.updated_by IS NOT NULL
        )`);
    values.push(postcondition.requestId, status);
    if (input) values.push(input.leadTimeDays);
  }
  return { expression: parts.join("\n AND "), values };
}

function productInputValues(input: AdminProductInput): unknown[] {
  return [
    input.name,
    input.slug,
    input.sku,
    input.shortDescription,
    input.description,
    input.imageUrl,
    input.categoryId,
    input.isActive ? 1 : 0,
  ];
}

function createVariantMutationPostcondition(
  requestId: string,
  action: CatalogMutationRow["action"],
  payloadSha256: string,
  productId: number,
  input: ProductVariantWriteInput | undefined,
  variantId?: number,
  expectedRevision?: number,
): VariantMutationPostcondition {
  return { action, expectedRevision, input, payloadSha256, productId, requestId, variantId };
}

function buildVariantPostconditionAssertion(
  database: D1DatabaseLike,
  postcondition: VariantMutationPostcondition,
): D1PreparedStatementLike {
  const commit = buildVariantMutationCommitExpression(postcondition);
  const started = buildVariantMutationStartedExpression(postcondition);
  return database.prepare(`
    /* catalog-variant-postcondition-assert */
    INSERT INTO admin_audit_log (
      request_id, actor_subject, action, entity_type, entity_key,
      previous_revision, resulting_revision, payload_sha256
    )
    SELECT NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
    WHERE (${started.expression}
      OR EXISTS (
        SELECT 1
        FROM admin_audit_log
        WHERE request_id = ?
      ))
      AND NOT (${commit.expression})
  `).bind(...started.values, postcondition.requestId, ...commit.values);
}

async function ensureVariantMutationComplete(
  database: D1DatabaseLike,
  mutation: CatalogMutationRow,
  postcondition: VariantMutationPostcondition,
): Promise<AdminProductVariant> {
  const replay = buildVariantMutationReplayExpression(postcondition);
  const row = await database.prepare(`
    /* catalog-variant-postcondition-read */
    SELECT CASE WHEN (${replay.expression}) THEN 1 ELSE 0 END AS complete
  `).bind(...replay.values).first<{ complete?: unknown }>();
  if (Number(row?.complete) !== 1) {
    throw new AdminCatalogWriteStorageError(
      "Không thể xác nhận đầy đủ trạng thái variant, tier và audit; thao tác bị khóa để tránh báo thành công sai.",
    );
  }
  return readVariantMutation(database, mutation);
}

function buildVariantMutationReplayExpression(
  postcondition: VariantMutationPostcondition,
): { expression: string; values: unknown[] } {
  const revision = postcondition.expectedRevision === undefined
    ? { sql: "marker.previous_revision IS NULL AND marker.resulting_revision = 1", values: [] }
    : {
        sql: "marker.previous_revision = ? AND marker.resulting_revision = ?",
        values: [postcondition.expectedRevision, postcondition.expectedRevision + 1],
      };
  const variantId = postcondition.variantId === undefined
    ? { sql: "", values: [] }
    : { sql: "AND variant_row.id = ?", values: [postcondition.variantId] };
  return {
    expression: `EXISTS (
      SELECT 1
      FROM admin_audit_log marker
      JOIN product_variants variant_row ON variant_row.id = CAST(marker.entity_key AS INTEGER)
      WHERE marker.request_id = ?
        AND marker.action = ?
        AND marker.entity_type = 'variant'
        AND marker.payload_sha256 = ?
        AND variant_row.product_id = ?
        ${variantId.sql}
        AND ${revision.sql}
    )`,
    values: [
      postcondition.requestId,
      postcondition.action,
      postcondition.payloadSha256,
      postcondition.productId,
      ...variantId.values,
      ...revision.values,
    ],
  };
}

function buildVariantMutationStartedExpression(
  postcondition: VariantMutationPostcondition,
): { expression: string; values: unknown[] } {
  const state = buildVariantStateExpression(postcondition, "variant_row");
  const tiers = buildVariantTierChecks("variant_row", postcondition.input);
  return {
    expression: `EXISTS (
      SELECT 1
      FROM product_variants variant_row
      WHERE ${state.expression}
        ${tiers.expression}
    )`,
    values: [...state.values, ...tiers.values],
  };
}

function buildVariantMutationCommitExpression(
  postcondition: VariantMutationPostcondition,
): { expression: string; values: unknown[] } {
  const revision = postcondition.expectedRevision === undefined
    ? { sql: "marker.previous_revision IS NULL AND marker.resulting_revision = 1", values: [] }
    : {
        sql: "marker.previous_revision = ? AND marker.resulting_revision = ?",
        values: [postcondition.expectedRevision, postcondition.expectedRevision + 1],
      };
  const state = buildVariantStateExpression(postcondition, "variant_row");
  const tiers = buildVariantTierChecks("variant_row", postcondition.input);
  return {
    expression: `EXISTS (
      SELECT 1
      FROM admin_audit_log marker
      JOIN product_variants variant_row ON variant_row.id = CAST(marker.entity_key AS INTEGER)
      WHERE marker.request_id = ?
        AND marker.action = ?
        AND marker.entity_type = 'variant'
        AND marker.payload_sha256 = ?
        AND ${revision.sql}
        AND ${state.expression}
        ${tiers.expression}
    )`,
    values: [
      postcondition.requestId,
      postcondition.action,
      postcondition.payloadSha256,
      ...revision.values,
      ...state.values,
      ...tiers.values,
    ],
  };
}

function buildVariantStateExpression(
  postcondition: VariantMutationPostcondition,
  alias: string,
): { expression: string; values: unknown[] } {
  if (postcondition.input) {
    const id = postcondition.variantId === undefined
      ? { sql: "", values: [] }
      : { sql: `${alias}.id = ? AND`, values: [postcondition.variantId] };
    return {
      expression: `${alias}.product_id = ?
        AND ${id.sql}
        ${alias}.name = ?
        AND ${alias}.sku = ?
        AND ${alias}.option_label = ?
        AND ${alias}.unit = ?
        AND ${alias}.moq = ?
        AND ${alias}.quantity_step = ?
        AND ${alias}.contact_from_quantity = ?
        AND ${alias}.is_available = ?
        AND ${alias}.sort_order = ?
        AND ${alias}.attribute_id = ?
        AND ${alias}.attribute_code = ?
        AND ${alias}.attribute_label = ?
        AND ${alias}.option_id = ?
        AND ${alias}.image_url IS ?
        AND ${alias}.revision = ?`,
      values: [
        postcondition.productId,
        ...id.values,
        ...variantInputValues(postcondition.input),
        postcondition.expectedRevision === undefined ? 1 : postcondition.expectedRevision + 1,
      ],
    };
  }
  return {
    expression: `${alias}.product_id = ?
      AND ${alias}.id = ?
      AND ${alias}.revision = ?
      AND ${alias}.is_available = 0`,
    values: [postcondition.productId, postcondition.variantId, (postcondition.expectedRevision ?? 0) + 1],
  };
}

function buildVariantTierChecks(
  alias: string,
  input: ProductVariantWriteInput | undefined,
): { expression: string; values: unknown[] } {
  if (!input) return { expression: "", values: [] };
  const expressions = [
    `(SELECT COUNT(*) FROM variant_tier_prices tier WHERE tier.variant_id = ${alias}.id) = ?`,
    ...input.tierPrices.map(() => `EXISTS (
      SELECT 1
      FROM variant_tier_prices tier
      WHERE tier.variant_id = ${alias}.id
        AND tier.min_quantity = ?
        AND tier.price = ?
        AND tier.currency = ?
    )`),
  ];
  return {
    expression: expressions.map((expression) => `AND ${expression}`).join("\n        "),
    values: [
      input.tierPrices.length,
      ...input.tierPrices.flatMap((tier) => [tier.minQuantity, tier.price, tier.currency]),
    ],
  };
}

function variantInputValues(input: ProductVariantWriteInput): unknown[] {
  return [
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
  ];
}

async function resolveProductConflict(
  database: D1DatabaseLike,
  requestId: string,
  payloadSha256: string,
  postcondition: ProductMutationPostcondition,
): Promise<AdminProduct> {
  const mutation = await findMutation(database, requestId);
  if (mutation) {
    assertMatchingMutation(mutation, requestId, postcondition.action, "product", payloadSha256);
    return ensureProductMutationComplete(database, mutation, postcondition);
  }
  throw new AdminCatalogWriteConflictError("Sản phẩm đã thay đổi ở phiên khác. Hãy tải lại rồi thử lại.");
}

async function resolveVariantConflict(
  database: D1DatabaseLike,
  requestId: string,
  payloadSha256: string,
  postcondition: VariantMutationPostcondition,
): Promise<AdminProductVariant> {
  const mutation = await findMutation(database, requestId);
  if (mutation) {
    assertMatchingMutation(mutation, requestId, postcondition.action, "variant", payloadSha256);
    return ensureVariantMutationComplete(database, mutation, postcondition);
  }
  throw new AdminCatalogWriteConflictError("Variant đã thay đổi ở phiên khác. Hãy tải lại rồi thử lại.");
}

function buildProductAudit(
  database: D1DatabaseLike,
  requestId: string,
  actorSubject: string,
  action: "delete" | "update",
  id: number,
  expectedRevision: number,
  payloadSha256: string,
): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO admin_audit_log (
      request_id, actor_subject, action, entity_type, entity_key,
      previous_revision, resulting_revision, payload_sha256
    )
    SELECT ?, ?, '${action}', 'product', CAST(id AS TEXT), ?, revision, ?
    FROM products
    WHERE id = ? AND revision = ? AND changes() = 1
    LIMIT 1
    RETURNING request_id
  `).bind(requestId, actorSubject, expectedRevision, payloadSha256, id, expectedRevision + 1);
}

function buildVariantAudit(
  database: D1DatabaseLike,
  requestId: string,
  actorSubject: string,
  action: "delete" | "update",
  productId: number,
  variantId: number,
  expectedRevision: number,
  payloadSha256: string,
): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO admin_audit_log (
      request_id, actor_subject, action, entity_type, entity_key,
      previous_revision, resulting_revision, payload_sha256
    )
    SELECT ?, ?, '${action}', 'variant', CAST(id AS TEXT), ?, revision, ?
    FROM product_variants
    WHERE product_id = ? AND id = ? AND revision = ? AND changes() = 1
    LIMIT 1
    RETURNING request_id
  `).bind(requestId, actorSubject, expectedRevision, payloadSha256, productId, variantId, expectedRevision + 1);
}

function buildProductMetaWrite(
  database: D1DatabaseLike,
  input: AdminProductInput,
  actorSubject: string,
  requestId: string,
  productId?: number,
): D1PreparedStatementLike {
  const id = productId === undefined ? null : productId;
  return database.prepare(`
    INSERT INTO product_admin_meta (product_id, status, lead_time_days, updated_by, updated_at)
    SELECT COALESCE(?, (SELECT CAST(entity_key AS INTEGER) FROM admin_audit_log WHERE request_id = ?)), ?, ?, ?, CURRENT_TIMESTAMP
    WHERE EXISTS (SELECT 1 FROM admin_audit_log WHERE request_id = ?)
    ON CONFLICT(product_id) DO UPDATE SET
      status = excluded.status,
      lead_time_days = excluded.lead_time_days,
      updated_by = excluded.updated_by,
      updated_at = CURRENT_TIMESTAMP
    RETURNING product_id
  `).bind(id, requestId, input.status, input.leadTimeDays, actorSubject, requestId);
}

function buildProductArchiveMeta(
  database: D1DatabaseLike,
  productId: number,
  actorSubject: string,
  requestId: string,
): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO product_admin_meta (product_id, status, updated_by, updated_at)
    SELECT ?, 'archived', ?, CURRENT_TIMESTAMP
    WHERE EXISTS (SELECT 1 FROM admin_audit_log WHERE request_id = ?)
    ON CONFLICT(product_id) DO UPDATE SET
      status = 'archived',
      updated_by = excluded.updated_by,
      updated_at = CURRENT_TIMESTAMP
    RETURNING product_id
  `).bind(productId, actorSubject, requestId);
}

function buildVariantInsert(
  database: D1DatabaseLike,
  productId: number,
  input: ProductVariantWriteInput,
): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO product_variants (
      product_id, name, sku, option_label, unit, moq, quantity_step,
      contact_from_quantity, is_available, sort_order, attribute_id,
      attribute_code, attribute_label, option_id, image_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id, revision
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
  );
}

function buildVariantUpdate(
  database: D1DatabaseLike,
  productId: number,
  variantId: number,
  input: ProductVariantWriteInput,
  expectedRevision: number,
): D1PreparedStatementLike {
  return database.prepare(`
    UPDATE product_variants
    SET name = ?, sku = ?, option_label = ?, unit = ?, moq = ?, quantity_step = ?,
      contact_from_quantity = ?, is_available = ?, sort_order = ?, attribute_id = ?,
      attribute_code = ?, attribute_label = ?, option_id = ?, image_url = ?,
      revision = revision + 1, updated_at = CURRENT_TIMESTAMP
    WHERE product_id = ? AND id = ? AND revision = ?
    RETURNING id, revision
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
  );
}

function buildTierDelete(database: D1DatabaseLike, variantId: number, requestId: string): D1PreparedStatementLike {
  return database.prepare(`
    DELETE FROM variant_tier_prices
    WHERE variant_id = ?
      AND EXISTS (SELECT 1 FROM admin_audit_log WHERE request_id = ?)
    RETURNING id
  `).bind(variantId, requestId);
}

function buildVariantTier(
  database: D1DatabaseLike,
  variantId: number,
  tier: { currency: "VND"; minQuantity: number; price: number },
  requestId: string,
): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO variant_tier_prices (variant_id, min_quantity, price, currency)
    SELECT ?, ?, ?, ?
    WHERE EXISTS (SELECT 1 FROM admin_audit_log WHERE request_id = ?)
    RETURNING id
  `).bind(variantId, tier.minQuantity, tier.price, tier.currency, requestId);
}

function buildCreatedVariantTier(
  database: D1DatabaseLike,
  productId: number,
  sku: string,
  tier: { currency: "VND"; minQuantity: number; price: number },
  requestId: string,
): D1PreparedStatementLike {
  return database.prepare(`
    INSERT INTO variant_tier_prices (variant_id, min_quantity, price, currency)
    SELECT v.id, ?, ?, ?
    FROM product_variants v
    WHERE v.product_id = ? AND v.sku = ?
      AND EXISTS (SELECT 1 FROM admin_audit_log WHERE request_id = ?)
    RETURNING id
  `).bind(tier.minQuantity, tier.price, tier.currency, productId, sku, requestId);
}

function assertExpectedRevision(actual: number, expected: number, message: string): void {
  if (!Number.isSafeInteger(expected) || expected < 1 || actual !== expected) {
    throw new AdminCatalogWriteConflictError(message);
  }
}

function assertChanged(result: BatchResult | undefined, message: string): void {
  if (!hasChanged(result)) throw new AdminCatalogWriteStorageError(message);
}

function hasChanged(result: BatchResult | undefined): boolean {
  if (!result) return false;
  if (Array.isArray(result.results)) return result.results.length > 0;
  const changes = result.meta?.changes;
  return changes !== undefined && Number(changes) > 0;
}

function hasRows(result: BatchResult | undefined): boolean {
  return Boolean(result && Array.isArray(result.results) && result.results.length > 0);
}

function normalizeCatalogBatchError(error: unknown): unknown {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("catalog product write postcondition failed")
    || message.includes("catalog variant write postcondition failed")
    || (message.includes("admin_audit_log") && message.toLowerCase().includes("constraint failed"))) {
    return new AdminCatalogWriteStorageError(
      "Không ghi đồng bộ được sản phẩm và audit; hệ thống đã rollback để tránh trạng thái dở dang.",
    );
  }
  return error;
}

function normalizeRequestId(value: string): string {
  const requestId = value.trim().toLowerCase();
  if (!isAdminRequestId(requestId)) throw new AdminCatalogWriteValidationError("requestId phải là UUID hợp lệ.");
  return requestId;
}

async function fingerprint(input: Record<string, unknown>): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(input)));
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}
