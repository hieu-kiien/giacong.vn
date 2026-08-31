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

interface DatabaseWithBatch extends D1DatabaseLike {
  batch(statements: D1PreparedStatementLike[]): Promise<BatchResult[]>;
}

type ProductVariantWriteInput = Omit<AdminProductVariantInput, "revision">;

export async function createAdminProductAtomically(
  database: D1DatabaseLike,
  input: AdminProductInput,
  actorSubject: string,
  requestId: string,
): Promise<AdminProduct> {
  const normalizedRequestId = normalizeRequestId(requestId);
  const payloadSha256 = await fingerprint({ entityType: "product", input, operation: "create" });
  await requireAuditTable(database);
  const existingMutation = await findMutation(database, normalizedRequestId);
  if (existingMutation) {
    assertMatchingMutation(existingMutation, normalizedRequestId, "create", "product", payloadSha256);
    return readProductMutation(database, existingMutation);
  }

  const databaseWithBatch = requireBatch(database);
  const hasMeta = await tableExists(database, "product_admin_meta");
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

  try {
    const results = await databaseWithBatch.batch(statements);
    assertChanged(results[0], "Không ghi được sản phẩm.");
    assertChanged(results[1], "Không ghi được audit sản phẩm.");
    if (hasMeta) assertChanged(results[2], "Không đồng bộ được trạng thái sản phẩm.");
  } catch (error) {
    const racedMutation = await findMutation(database, normalizedRequestId);
    if (racedMutation) {
      assertMatchingMutation(racedMutation, normalizedRequestId, "create", "product", payloadSha256);
      return readProductMutation(database, racedMutation);
    }
    throw error;
  }

  const mutation = await findMutation(database, normalizedRequestId);
  if (!mutation) throw new AdminCatalogWriteStorageError("Không đọc lại được audit sản phẩm vừa tạo.");
  return readProductMutation(database, mutation);
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
  const existingMutation = await findMutation(database, normalizedRequestId);
  if (existingMutation) {
    assertMatchingMutation(existingMutation, normalizedRequestId, "update", "product", payloadSha256);
    return readProductMutation(database, existingMutation);
  }

  const existing = await getAdminProduct(database, id);
  if (!existing) return null;
  assertExpectedRevision(existing.revision, expectedRevision, "Sản phẩm đã thay đổi. Hãy tải lại trước khi lưu.");

  const databaseWithBatch = requireBatch(database);
  const hasMeta = await tableExists(database, "product_admin_meta");
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

  try {
    const results = await databaseWithBatch.batch(statements);
    if (!hasRows(results[0])) return resolveProductConflict(database, normalizedRequestId, payloadSha256);
    assertChanged(results[1], "Không ghi được audit sản phẩm.");
    if (hasMeta) assertChanged(results[2], "Không đồng bộ được trạng thái sản phẩm.");
  } catch (error) {
    const racedMutation = await findMutation(database, normalizedRequestId);
    if (racedMutation) {
      assertMatchingMutation(racedMutation, normalizedRequestId, "update", "product", payloadSha256);
      return readProductMutation(database, racedMutation);
    }
    throw error;
  }
  return getAdminProduct(database, id);
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
  const existingMutation = await findMutation(database, normalizedRequestId);
  if (existingMutation) {
    assertMatchingMutation(existingMutation, normalizedRequestId, "delete", "product", payloadSha256);
    return readProductMutation(database, existingMutation);
  }

  const existing = await getAdminProduct(database, id);
  if (!existing) return null;
  assertExpectedRevision(existing.revision, expectedRevision, "Sản phẩm đã thay đổi. Hãy tải lại trước khi ẩn.");

  const databaseWithBatch = requireBatch(database);
  const hasMeta = await tableExists(database, "product_admin_meta");
  const update = database.prepare(`
    UPDATE products
    SET is_active = 0, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND revision = ?
    RETURNING id, revision
  `).bind(id, expectedRevision);
  const audit = buildProductAudit(database, normalizedRequestId, actorSubject, "delete", id, expectedRevision, payloadSha256);
  const statements: D1PreparedStatementLike[] = [update, audit];
  if (hasMeta) statements.push(buildProductArchiveMeta(database, id, actorSubject, normalizedRequestId));

  try {
    const results = await databaseWithBatch.batch(statements);
    if (!hasRows(results[0])) return resolveProductConflict(database, normalizedRequestId, payloadSha256);
    assertChanged(results[1], "Không ghi được audit ẩn sản phẩm.");
    if (hasMeta) assertChanged(results[2], "Không đồng bộ được trạng thái sản phẩm.");
  } catch (error) {
    const racedMutation = await findMutation(database, normalizedRequestId);
    if (racedMutation) {
      assertMatchingMutation(racedMutation, normalizedRequestId, "delete", "product", payloadSha256);
      return readProductMutation(database, racedMutation);
    }
    throw error;
  }
  return getAdminProduct(database, id);
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
  const existingMutation = await findMutation(database, normalizedRequestId);
  if (existingMutation) {
    assertMatchingMutation(existingMutation, normalizedRequestId, "create", "variant", payloadSha256);
    return readVariantMutation(database, existingMutation);
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

  try {
    const results = await databaseWithBatch.batch(statements);
    assertChanged(results[0], "Không ghi được variant.");
    assertChanged(results[1], "Không ghi được audit variant.");
    for (const result of results.slice(2)) assertChanged(result, "Không ghi được tier price variant.");
  } catch (error) {
    const racedMutation = await findMutation(database, normalizedRequestId);
    if (racedMutation) {
      assertMatchingMutation(racedMutation, normalizedRequestId, "create", "variant", payloadSha256);
      return readVariantMutation(database, racedMutation);
    }
    throw error;
  }
  const mutation = await findMutation(database, normalizedRequestId);
  if (!mutation) throw new AdminCatalogWriteStorageError("Không đọc lại được audit variant vừa tạo.");
  return readVariantMutation(database, mutation);
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
  const existingMutation = await findMutation(database, normalizedRequestId);
  if (existingMutation) {
    assertMatchingMutation(existingMutation, normalizedRequestId, "update", "variant", payloadSha256);
    return readVariantMutation(database, existingMutation);
  }

  const existing = await getAdminProductVariant(database, productId, variantId);
  if (!existing) return null;
  assertExpectedRevision(existing.revision, expectedRevision, "Variant đã thay đổi. Hãy tải lại trước khi lưu.");

  const databaseWithBatch = requireBatch(database);
  const update = buildVariantUpdate(database, productId, variantId, input, expectedRevision);
  const audit = buildVariantAudit(database, normalizedRequestId, actorSubject, "update", productId, variantId, expectedRevision, payloadSha256);
  const statements: D1PreparedStatementLike[] = [update, audit, buildTierDelete(database, variantId, normalizedRequestId)];
  for (const tier of input.tierPrices) statements.push(buildVariantTier(database, variantId, tier, normalizedRequestId));

  try {
    const results = await databaseWithBatch.batch(statements);
    if (!hasRows(results[0])) return resolveVariantConflict(database, normalizedRequestId, payloadSha256);
    assertChanged(results[1], "Không ghi được audit variant.");
    for (const result of results.slice(3)) {
      if (!hasRows(result) && !hasChanged(result)) throw new AdminCatalogWriteStorageError("Không cập nhật được tier price variant.");
    }
  } catch (error) {
    const racedMutation = await findMutation(database, normalizedRequestId);
    if (racedMutation) {
      assertMatchingMutation(racedMutation, normalizedRequestId, "update", "variant", payloadSha256);
      return readVariantMutation(database, racedMutation);
    }
    throw error;
  }
  return getAdminProductVariant(database, productId, variantId);
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
  const existingMutation = await findMutation(database, normalizedRequestId);
  if (existingMutation) {
    assertMatchingMutation(existingMutation, normalizedRequestId, "delete", "variant", payloadSha256);
    return readVariantMutation(database, existingMutation);
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
    const results = await databaseWithBatch.batch([update, audit]);
    if (!hasRows(results[0])) return resolveVariantConflict(database, normalizedRequestId, payloadSha256);
    assertChanged(results[1], "Không ghi được audit ẩn variant.");
  } catch (error) {
    const racedMutation = await findMutation(database, normalizedRequestId);
    if (racedMutation) {
      assertMatchingMutation(racedMutation, normalizedRequestId, "delete", "variant", payloadSha256);
      return readVariantMutation(database, racedMutation);
    }
    throw error;
  }
  return getAdminProductVariant(database, productId, variantId);
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

async function resolveProductConflict(database: D1DatabaseLike, requestId: string, payloadSha256: string): Promise<AdminProduct> {
  const mutation = await findMutation(database, requestId);
  if (mutation) {
    assertMatchingMutation(mutation, requestId, mutation.action, "product", payloadSha256);
    return readProductMutation(database, mutation);
  }
  throw new AdminCatalogWriteConflictError("Sản phẩm đã thay đổi ở phiên khác. Hãy tải lại rồi thử lại.");
}

async function resolveVariantConflict(database: D1DatabaseLike, requestId: string, payloadSha256: string): Promise<AdminProductVariant> {
  const mutation = await findMutation(database, requestId);
  if (mutation) {
    assertMatchingMutation(mutation, requestId, mutation.action, "variant", payloadSha256);
    return readVariantMutation(database, mutation);
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
  return result.meta?.changes === undefined || Number(result.meta.changes) > 0;
}

function hasRows(result: BatchResult | undefined): boolean {
  return Boolean(result && Array.isArray(result.results) && result.results.length > 0);
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
