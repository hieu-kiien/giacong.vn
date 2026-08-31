import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import type { AdminCategoryInput } from "./admin-category-input";
import type { AdminNewsDraftInput } from "./admin-news-input";

export type AdminRole = "owner" | "content_manager" | "catalog_manager" | "sales_manager" | "viewer";
export type AdminPublishStatus = "draft" | "review" | "published" | "archived";
export type LeadStatus =
  | "new"
  | "qualified"
  | "contacted"
  | "quotation_sent"
  | "sampling"
  | "negotiation"
  | "won"
  | "lost"
  | "spam";

interface D1Result<T> {
  results: T[];
}

export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
}

interface CatalogEnv {
  GIACONG_VN_CATALOG?: D1DatabaseLike;
}

export interface AdminMember {
  id: string;
  accessSubject: string;
  email: string | null;
  displayName: string;
  role: AdminRole;
}

export interface AdminProduct {
  id: number;
  name: string;
  slug: string;
  sku: string;
  categoryId: number | null;
  categoryName: string | null;
  shortDescription: string;
  description: string;
  imageUrl: string | null;
  isActive: boolean;
  status: AdminPublishStatus;
  leadTimeDays: number | null;
  revision: number;
  updatedAt: string | null;
}

export interface AdminCategory {
  id: number;
  name: string;
  slug: string;
}

export interface AdminProductInput {
  categoryId: number | null;
  description: string;
  imageUrl: string | null;
  isActive: boolean;
  leadTimeDays: number | null;
  name: string;
  shortDescription: string;
  sku: string;
  slug: string;
  status: AdminPublishStatus;
}

export interface AdminTierPrice {
  currency: "VND";
  id: number;
  minQuantity: number;
  price: number;
}

export interface AdminProductVariant {
  attributeCode: string;
  attributeId: number;
  attributeLabel: string;
  contactFromQuantity: number;
  id: number;
  imageUrl: string | null;
  isAvailable: boolean;
  moq: number;
  name: string;
  optionId: number;
  optionLabel: string;
  productId: number;
  quantityStep: number;
  revision: number;
  sku: string;
  sortOrder: number;
  tierPrices: AdminTierPrice[];
  unit: string;
}

export interface AdminProductVariantInput {
  attributeCode: string;
  attributeId: number;
  attributeLabel: string;
  contactFromQuantity: number;
  imageUrl: string | null;
  isAvailable: boolean;
  moq: number;
  name: string;
  optionId: number;
  optionLabel: string;
  quantityStep: number;
  revision?: number;
  sku: string;
  sortOrder: number;
  tierPrices: Array<{ currency: "VND"; minQuantity: number; price: number }>;
  unit: string;
}

export interface AdminService {
  id: number;
  name: string;
  slug: string;
  summary: string;
  description: string;
  imageUrl: string | null;
  isActive: boolean;
  status: AdminPublishStatus;
  leadTimeDays: number | null;
  moqSummary: string | null;
  updatedAt: string | null;
}

export interface AdminServiceInput {
  description: string;
  imageUrl: string | null;
  isActive: boolean;
  leadTimeDays: number | null;
  moqSummary: string | null;
  name: string;
  slug: string;
  status: AdminPublishStatus;
  summary: string;
}

export interface AdminLead {
  id: string;
  status: LeadStatus;
  fullName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  message: string | null;
  source: string;
  deliveryStatus: "pending" | "queued" | "delivered" | "failed";
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export class AdminDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminDataError";
  }
}

export function getAdminDatabase(): D1DatabaseLike {
  try {
    const { env } = getCloudflareContext();
    const database = (env as unknown as CatalogEnv).GIACONG_VN_CATALOG;
    if (!database) throw new AdminDataError("Thiếu binding D1 GIACONG_VN_CATALOG.");
    return database;
  } catch (error) {
    if (error instanceof AdminDataError) throw error;
    throw new AdminDataError("Không thể truy cập D1 catalog trong runtime hiện tại.");
  }
}

export async function findAdminMember(
  database: D1DatabaseLike,
  accessSubject: string,
  email?: string,
): Promise<AdminMember | null> {
  const normalizedEmail = email?.trim().toLowerCase() ?? "";
  const query = normalizedEmail
    ? `
      SELECT id, access_subject, email, display_name, role
      FROM admin_members
      WHERE is_active = 1
        AND (access_subject = ? OR lower(email) = lower(?))
      LIMIT 1
    `
    : `
    SELECT id, access_subject, email, display_name, role
    FROM admin_members
    WHERE access_subject = ? AND is_active = 1
    LIMIT 1
  `;
  const row = await database.prepare(query).bind(
    ...(normalizedEmail ? [accessSubject, normalizedEmail] : [accessSubject]),
  ).first<{
    id: string;
    access_subject: string;
    email: string | null;
    display_name: string;
    role: AdminRole;
  }>();

  if (!row) return null;
  return {
    accessSubject: row.access_subject,
    displayName: row.display_name,
    email: row.email,
    id: row.id,
    role: row.role,
  };
}

export async function tableExists(database: D1DatabaseLike, tableName: string): Promise<boolean> {
  const row = await database.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name = ?
    LIMIT 1
  `).bind(tableName).first<{ name: string }>();
  return row?.name === tableName;
}

export async function listAdminCategories(database: D1DatabaseLike): Promise<AdminCategory[]> {
  const rows = await database.prepare(`
    SELECT id, name, slug
    FROM categories
    WHERE is_active = 1
    ORDER BY sort_order ASC, name COLLATE NOCASE ASC, id ASC
    LIMIT 100
  `).all<AdminCategory>();
  return rows.results;
}

export async function getAdminOverview(database: D1DatabaseLike) {
  const [products, services, leads, members, metaTables, news, draftProducts, recentLeads] = await Promise.all([
    countRows(database, "products"),
    countRows(database, "services"),
    countRows(database, "leads"),
    countRows(database, "admin_members"),
    Promise.all([
      tableExists(database, "product_admin_meta"),
      tableExists(database, "service_admin_meta"),
      tableExists(database, "audit_logs"),
    ]),
    tableExists(database, "news_posts").then((ready) => (
      ready ? countRows(database, "news_posts") : Promise.resolve({ count: 0, ready: false })
    )),
    countRows(database, "products", "is_active = 1").catch(() => ({ count: 0, ready: false })),
    database.prepare(`
      SELECT id, full_name, status, created_at
      FROM leads
      ORDER BY created_at DESC
      LIMIT 5
    `).all<{ created_at: string; full_name: string; id: string; status: string }>().then(
      (result) => result.results,
      () => [],
    ),
  ]);

  return {
    dataReadiness: {
      adminMembersTable: members.ready,
      auditLogsTable: metaTables[2],
      leadsTable: leads.ready,
      productMetaTable: metaTables[0],
      serviceMetaTable: metaTables[1],
    },
    counts: {
      activeProducts: products.ready ? await countRows(database, "products", "is_active = 1").then((result) => result.count) : 0,
      activeServices: services.ready ? await countRows(database, "services", "is_active = 1").then((result) => result.count) : 0,
      draftProducts: draftProducts.count,
      leads: leads.ready ? leads.count : 0,
      news: news.count,
      newLeads: leads.ready
        ? await countRows(database, "leads", "status = 'new'").then((result) => result.count)
        : 0,
      products: products.count,
      services: services.count,
    },
    recentLeads: recentLeads.map((row) => ({
      createdAt: row.created_at,
      fullName: row.full_name,
      id: row.id,
      status: row.status,
    })),
  };
}

export async function listAdminProducts(
  database: D1DatabaseLike,
  input: { page: number; pageSize: number; query?: string },
): Promise<{ products: AdminProduct[]; total: number }> {
  const hasMeta = await tableExists(database, "product_admin_meta");
  const where: string[] = [];
  const params: unknown[] = [];
  if (input.query?.trim()) {
    const pattern = `%${escapeLike(input.query.trim())}%`;
    where.push("(p.name LIKE ? ESCAPE '\\' COLLATE NOCASE OR p.sku LIKE ? ESCAPE '\\' COLLATE NOCASE OR p.slug LIKE ? ESCAPE '\\' COLLATE NOCASE)");
    params.push(pattern, pattern, pattern);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const count = await database.prepare(`
    SELECT COUNT(*) AS total
    FROM products p
    ${whereSql}
  `).bind(...params).first<{ total: number }>();
  const rows = await database.prepare(`
    SELECT
      p.id, p.name, p.slug, p.sku, p.category_id, c.name AS category_name,
      p.short_description, p.description, p.image_url, p.is_active, p.revision,
      (SELECT COUNT(*) FROM product_variants v WHERE v.product_id = p.id) AS variant_count,
      (SELECT MIN(v.moq) FROM product_variants v WHERE v.product_id = p.id) AS minimum_order_quantity,
      (SELECT MIN(tp.price) FROM variant_tier_prices tp
        INNER JOIN product_variants v2 ON v2.id = tp.variant_id
        WHERE v2.product_id = p.id) AS starting_price
      ${hasMeta ? ", m.status, m.lead_time_days, m.updated_at AS meta_updated_at" : ""}
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    ${hasMeta ? "LEFT JOIN product_admin_meta m ON m.product_id = p.id" : ""}
    ${whereSql}
    ORDER BY p.id DESC
    LIMIT ? OFFSET ?
  `).bind(...params, input.pageSize, (input.page - 1) * input.pageSize).all<{
    id: number;
    name: string;
    slug: string;
    sku: string;
    category_id: number | null;
    category_name: string | null;
    short_description: string;
    description: string;
    image_url: string | null;
    is_active: number;
    revision: number;
    minimum_order_quantity: number | null;
    starting_price: number | null;
    variant_count: number | null;
    status?: AdminPublishStatus;
    lead_time_days?: number | null;
    meta_updated_at?: string | null;
  }>();

  return {
    products: rows.results.map((row) => ({
      categoryId: row.category_id,
      categoryName: row.category_name,
      description: row.description,
      id: row.id,
      imageUrl: row.image_url,
      isActive: row.is_active === 1,
      leadTimeDays: row.lead_time_days ?? null,
      minimumOrderQuantity: row.minimum_order_quantity,
      name: row.name,
      revision: row.revision,
      shortDescription: row.short_description,
      sku: row.sku,
      slug: row.slug,
      startingPrice: row.starting_price,
      status: row.status ?? (row.is_active === 1 ? "published" : "archived"),
      updatedAt: row.meta_updated_at ?? null,
      variantCount: row.variant_count,
    })),
    total: integer(count?.total ?? 0),
  };
}

export async function getAdminProduct(
  database: D1DatabaseLike,
  id: number,
): Promise<AdminProduct | null> {
  const hasMeta = await tableExists(database, "product_admin_meta");
  const row = await database.prepare(`
    SELECT
      p.id, p.name, p.slug, p.sku, p.category_id, c.name AS category_name,
      p.short_description, p.description, p.image_url, p.is_active, p.revision
      ${hasMeta ? ", m.status, m.lead_time_days, m.updated_at AS meta_updated_at" : ""}
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    ${hasMeta ? "LEFT JOIN product_admin_meta m ON m.product_id = p.id" : ""}
    WHERE p.id = ?
    LIMIT 1
  `).bind(id).first<ProductRow>();

  return row ? toAdminProduct(row) : null;
}

export interface AdminVariantValidation {
  invalidVariants: number;
  totalVariants: number;
  valid: boolean;
}

/**
 * The public detail reader validates every variant and its optional tier
 * prices. Keep the publish gate aligned with those runtime invariants so an
 * admin cannot make a product public and immediately break its detail page.
 */
export async function validateAdminProductVariants(
  database: D1DatabaseLike,
  productId: number,
): Promise<AdminVariantValidation> {
  const row = await database.prepare(`
    WITH variant_check AS (
      SELECT
        v.id,
        CASE WHEN
          v.id > 0
          AND v.name IS NOT NULL AND TRIM(v.name) <> ''
          AND v.sku IS NOT NULL AND TRIM(v.sku) <> ''
          AND v.unit IS NOT NULL AND TRIM(v.unit) <> ''
          AND v.option_label IS NOT NULL AND TRIM(v.option_label) <> ''
          AND v.attribute_code IS NOT NULL AND TRIM(v.attribute_code) <> ''
          AND v.attribute_label IS NOT NULL AND TRIM(v.attribute_label) <> ''
          AND v.attribute_id > 0
          AND v.option_id > 0
          AND v.is_available IN (0, 1)
          AND v.moq > 0
          AND v.quantity_step > 0
          AND v.contact_from_quantity > v.moq
          AND (v.contact_from_quantity - v.moq) % v.quantity_step = 0
          AND (
            v.image_url IS NULL
            OR TRIM(v.image_url) = ''
            OR v.image_url LIKE '/%'
            OR v.image_url LIKE 'https://%'
          )
          AND NOT EXISTS (
            SELECT 1
            FROM variant_tier_prices tp
            WHERE tp.variant_id = v.id
              AND (
                tp.min_quantity < v.moq
                OR tp.min_quantity >= v.contact_from_quantity
                OR tp.min_quantity <= 0
                OR tp.price <= 0
                OR tp.currency <> 'VND'
                OR (tp.min_quantity - v.moq) % v.quantity_step <> 0
              )
          )
          AND (
            NOT EXISTS (SELECT 1 FROM variant_tier_prices tp WHERE tp.variant_id = v.id)
            OR (
              EXISTS (
                SELECT 1 FROM variant_tier_prices tp
                WHERE tp.variant_id = v.id AND tp.min_quantity = v.moq
              )
              AND (
                SELECT COUNT(*) FROM variant_tier_prices tp
                WHERE tp.variant_id = v.id
              ) = (
                SELECT COUNT(DISTINCT tp.min_quantity) FROM variant_tier_prices tp
                WHERE tp.variant_id = v.id
              )
            )
          )
        THEN 1 ELSE 0 END AS is_valid
      FROM product_variants v
      WHERE v.product_id = ?
    )
    SELECT
      COUNT(*) AS total_variants,
      COALESCE(SUM(CASE WHEN is_valid = 0 THEN 1 ELSE 0 END), 0) AS invalid_variants
    FROM variant_check
  `).bind(productId).first<{ total_variants: number; invalid_variants: number }>();

  const totalVariants = Number(row?.total_variants ?? 0);
  const invalidVariants = Number(row?.invalid_variants ?? 0);
  return {
    invalidVariants,
    totalVariants,
    valid: totalVariants > 0 && invalidVariants === 0,
  };
}

export async function listAdminProductVariants(
  database: D1DatabaseLike,
  productId: number,
): Promise<AdminProductVariant[]> {
  const rows = await database.prepare(`
    SELECT id, product_id, name, sku, option_label, unit, moq, quantity_step,
      contact_from_quantity, is_available, sort_order, attribute_id,
      attribute_code, attribute_label, option_id, image_url, revision
    FROM product_variants
    WHERE product_id = ?
    ORDER BY sort_order ASC, id ASC
    LIMIT 100
  `).bind(productId).all<VariantRow>();
  if (rows.results.length === 0) return [];

  const tiers = await database.prepare(`
    SELECT id, variant_id, min_quantity, price, currency
    FROM variant_tier_prices
    WHERE variant_id IN (${rows.results.map(() => "?").join(", ")})
    ORDER BY variant_id ASC, min_quantity ASC
  `).bind(...rows.results.map((row) => row.id)).all<VariantTierRow>();
  const tiersByVariant = groupVariantTiers(tiers.results);
  return rows.results.map((row) => toAdminVariant(row, tiersByVariant.get(row.id) ?? []));
}

export async function getAdminProductVariant(
  database: D1DatabaseLike,
  productId: number,
  variantId: number,
): Promise<AdminProductVariant | null> {
  const row = await database.prepare(`
    SELECT id, product_id, name, sku, option_label, unit, moq, quantity_step,
      contact_from_quantity, is_available, sort_order, attribute_id,
      attribute_code, attribute_label, option_id, image_url, revision
    FROM product_variants
    WHERE product_id = ? AND id = ?
    LIMIT 1
  `).bind(productId, variantId).first<VariantRow>();
  if (!row) return null;
  const tiers = await database.prepare(`
    SELECT id, variant_id, min_quantity, price, currency
    FROM variant_tier_prices
    WHERE variant_id = ?
    ORDER BY min_quantity ASC
  `).bind(variantId).all<VariantTierRow>();
  return toAdminVariant(row, tiers.results);
}

export async function createAdminProductVariant(
  database: D1DatabaseLike,
  productId: number,
  input: AdminProductVariantInput,
  actorSubject: string,
): Promise<AdminProductVariant> {
  await database.prepare(`
    INSERT INTO product_variants (
      product_id, name, sku, option_label, unit, moq, quantity_step,
      contact_from_quantity, is_available, sort_order, attribute_id,
      attribute_code, attribute_label, option_id, image_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
  ).run();
  const created = await database.prepare("SELECT id FROM product_variants WHERE sku = ? LIMIT 1")
    .bind(input.sku)
    .first<{ id: number }>();
  if (!created) throw new AdminDataError("Không đọc lại được variant vừa tạo.");
  await replaceVariantTiers(database, created.id, input.tierPrices);
  await writeAuditLog(database, actorSubject, "variant.created", "variant", String(created.id), {
    productId,
    input,
  });
  const variant = await getAdminProductVariant(database, productId, created.id);
  if (!variant) throw new AdminDataError("Không đọc lại được variant vừa tạo.");
  return variant;
}

export async function updateAdminProductVariant(
  database: D1DatabaseLike,
  productId: number,
  variantId: number,
  input: AdminProductVariantInput,
  actorSubject: string,
): Promise<AdminProductVariant | null> {
  const existing = await getAdminProductVariant(database, productId, variantId);
  if (!existing) return null;
  if (input.revision !== undefined && input.revision !== existing.revision) {
    throw new AdminDataError("Dữ liệu variant đã thay đổi. Hãy tải lại trước khi lưu.");
  }

  await database.prepare(`
    UPDATE product_variants
    SET name = ?, sku = ?, option_label = ?, unit = ?, moq = ?, quantity_step = ?,
      contact_from_quantity = ?, is_available = ?, sort_order = ?, attribute_id = ?,
      attribute_code = ?, attribute_label = ?, option_id = ?, image_url = ?,
      revision = revision + 1, updated_at = CURRENT_TIMESTAMP
    WHERE product_id = ? AND id = ?
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
  ).run();
  await replaceVariantTiers(database, variantId, input.tierPrices);
  await writeAuditLog(database, actorSubject, "variant.updated", "variant", String(variantId), {
    before: existing,
    after: input,
  });
  return getAdminProductVariant(database, productId, variantId);
}

export async function archiveAdminProductVariant(
  database: D1DatabaseLike,
  productId: number,
  variantId: number,
  actorSubject: string,
): Promise<AdminProductVariant | null> {
  const existing = await getAdminProductVariant(database, productId, variantId);
  if (!existing) return null;
  await database.prepare(`
    UPDATE product_variants
    SET is_available = 0, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
    WHERE product_id = ? AND id = ?
  `).bind(productId, variantId).run();
  await writeAuditLog(database, actorSubject, "variant.archived", "variant", String(variantId), {
    before: existing,
  });
  return getAdminProductVariant(database, productId, variantId);
}

export async function createAdminProduct(
  database: D1DatabaseLike,
  input: AdminProductInput,
  actorSubject: string,
): Promise<AdminProduct> {
  await database.prepare(`
    INSERT INTO products (
      name, slug, sku, short_description, description, image_url, category_id, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    input.name,
    input.slug,
    input.sku,
    input.shortDescription,
    input.description,
    input.imageUrl,
    input.categoryId,
    input.isActive ? 1 : 0,
  ).run();

  const created = await database.prepare("SELECT id FROM products WHERE slug = ? LIMIT 1")
    .bind(input.slug)
    .first<{ id: number }>();
  if (!created) throw new AdminDataError("Không đọc lại được sản phẩm vừa tạo.");

  await syncProductMeta(database, created.id, input, actorSubject);
  await writeAuditLog(database, actorSubject, "product.created", "product", String(created.id), input);
  const product = await getAdminProduct(database, created.id);
  if (!product) throw new AdminDataError("Không đọc lại được sản phẩm vừa tạo.");
  return product;
}

export async function updateAdminProduct(
  database: D1DatabaseLike,
  id: number,
  input: AdminProductInput,
  actorSubject: string,
): Promise<AdminProduct | null> {
  const existing = await getAdminProduct(database, id);
  if (!existing) return null;

  await database.prepare(`
    UPDATE products
    SET name = ?, slug = ?, sku = ?, short_description = ?, description = ?,
      image_url = ?, category_id = ?, is_active = ?
    WHERE id = ?
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
  ).run();

  await syncProductMeta(database, id, input, actorSubject);
  await writeAuditLog(database, actorSubject, "product.updated", "product", String(id), {
    before: existing,
    after: input,
  });
  return getAdminProduct(database, id);
}

/**
 * Product deletion is intentionally a soft archive. Public catalog reads only
 * active products, so this removes the item from the storefront without
 * destroying variants, prices, or historical lead references.
 */
export async function archiveAdminProduct(
  database: D1DatabaseLike,
  id: number,
  actorSubject: string,
): Promise<AdminProduct | null> {
  const existing = await getAdminProduct(database, id);
  if (!existing) return null;

  await database.prepare("UPDATE products SET is_active = 0 WHERE id = ?").bind(id).run();
  if (await tableExists(database, "product_admin_meta")) {
    await database.prepare(`
      INSERT INTO product_admin_meta (product_id, status, updated_by, updated_at)
      VALUES (?, 'archived', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(product_id) DO UPDATE SET
        status = 'archived',
        updated_by = excluded.updated_by,
        updated_at = CURRENT_TIMESTAMP
    `).bind(id, actorSubject).run();
  }
  await writeAuditLog(database, actorSubject, "product.archived", "product", String(id), { before: existing });
  return getAdminProduct(database, id);
}

export async function listAdminServices(
  database: D1DatabaseLike,
  input: { page: number; pageSize: number; query?: string },
): Promise<{ services: AdminService[]; total: number }> {
  const hasMeta = await tableExists(database, "service_admin_meta");
  const where: string[] = [];
  const params: unknown[] = [];
  if (input.query?.trim()) {
    const pattern = `%${escapeLike(input.query.trim())}%`;
    where.push("(s.name LIKE ? ESCAPE '\\' COLLATE NOCASE OR s.slug LIKE ? ESCAPE '\\' COLLATE NOCASE OR s.summary LIKE ? ESCAPE '\\' COLLATE NOCASE)");
    params.push(pattern, pattern, pattern);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const count = await database.prepare(`
    SELECT COUNT(*) AS total
    FROM services s
    ${whereSql}
  `).bind(...params).first<{ total: number }>();
  const rows = await database.prepare(`
    SELECT
      s.id, s.name, s.slug, s.summary, s.description, s.is_active, s.image_url
      ${hasMeta ? ", m.status, m.lead_time_days, m.moq_summary, m.updated_at AS meta_updated_at" : ""}
    FROM services s
    ${hasMeta ? "LEFT JOIN service_admin_meta m ON m.service_id = s.id" : ""}
    ${whereSql}
    ORDER BY s.id ASC
    LIMIT ? OFFSET ?
  `).bind(...params, input.pageSize, (input.page - 1) * input.pageSize).all<{
    id: number;
    name: string;
    slug: string;
    summary: string;
    description: string;
    is_active: number;
    image_url?: string | null;
    status?: AdminPublishStatus;
    lead_time_days?: number | null;
    moq_summary?: string | null;
    meta_updated_at?: string | null;
  }>();

  return {
    services: rows.results.map((row) => ({
      description: row.description,
      id: row.id,
      imageUrl: row.image_url ?? null,
      isActive: row.is_active === 1,
      leadTimeDays: row.lead_time_days ?? null,
      moqSummary: row.moq_summary ?? null,
      name: row.name,
      slug: row.slug,
      status: row.status ?? (row.is_active === 1 ? "published" : "archived"),
      summary: row.summary,
      updatedAt: row.meta_updated_at ?? null,
    })),
    total: integer(count?.total ?? 0),
  };
}

export async function getAdminService(
  database: D1DatabaseLike,
  id: number,
): Promise<AdminService | null> {
  const hasMeta = await tableExists(database, "service_admin_meta");
  const row = await database.prepare(`
    SELECT
      s.id, s.name, s.slug, s.summary, s.description, s.is_active, s.image_url
      ${hasMeta ? ", m.status, m.lead_time_days, m.moq_summary, m.updated_at AS meta_updated_at" : ""}
    FROM services s
    ${hasMeta ? "LEFT JOIN service_admin_meta m ON m.service_id = s.id" : ""}
    WHERE s.id = ?
    LIMIT 1
  `).bind(id).first<ServiceRow>();

  return row ? toAdminService(row) : null;
}

export async function createAdminService(
  database: D1DatabaseLike,
  input: AdminServiceInput,
  actorSubject: string,
): Promise<AdminService> {
  await database.prepare(`
    INSERT INTO services (slug, name, summary, description, image_url, meta_title, is_active)
    VALUES (?, ?, ?, ?, ?, '', ?)
  `).bind(
    input.slug,
    input.name,
    input.summary,
    input.description,
    input.imageUrl,
    input.isActive ? 1 : 0,
  ).run();

  const created = await database.prepare("SELECT id FROM services WHERE slug = ? LIMIT 1")
    .bind(input.slug)
    .first<{ id: number }>();
  if (!created) throw new AdminDataError("Không đọc lại được dịch vụ vừa tạo.");

  await syncServiceMeta(database, created.id, input, actorSubject);
  await writeAuditLog(database, actorSubject, "service.created", "service", String(created.id), input);
  const service = await getAdminService(database, created.id);
  if (!service) throw new AdminDataError("Không đọc lại được dịch vụ vừa tạo.");
  return service;
}

export async function updateAdminService(
  database: D1DatabaseLike,
  id: number,
  input: AdminServiceInput,
  actorSubject: string,
): Promise<AdminService | null> {
  const existing = await getAdminService(database, id);
  if (!existing) return null;

  await database.prepare(`
    UPDATE services
    SET slug = ?, name = ?, summary = ?, description = ?, image_url = ?,
      is_active = ?, updated_at = CURRENT_TIMESTAMP, revision = revision + 1
    WHERE id = ?
  `).bind(
    input.slug,
    input.name,
    input.summary,
    input.description,
    input.imageUrl,
    input.isActive ? 1 : 0,
    id,
  ).run();

  await syncServiceMeta(database, id, input, actorSubject);
  await writeAuditLog(database, actorSubject, "service.updated", "service", String(id), {
    before: existing,
    after: input,
  });
  return getAdminService(database, id);
}

export async function archiveAdminService(
  database: D1DatabaseLike,
  id: number,
  actorSubject: string,
): Promise<AdminService | null> {
  const existing = await getAdminService(database, id);
  if (!existing) return null;

  await database.prepare(`
    UPDATE services
    SET is_active = 0, updated_at = CURRENT_TIMESTAMP, revision = revision + 1
    WHERE id = ?
  `).bind(id).run();
  if (await tableExists(database, "service_admin_meta")) {
    await database.prepare(`
      INSERT INTO service_admin_meta (service_id, status, updated_by, updated_at)
      VALUES (?, 'archived', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(service_id) DO UPDATE SET
        status = 'archived',
        updated_by = excluded.updated_by,
        updated_at = CURRENT_TIMESTAMP
    `).bind(id, actorSubject).run();
  }
  await writeAuditLog(database, actorSubject, "service.archived", "service", String(id), { before: existing });
  return getAdminService(database, id);
}

export async function listAdminLeads(
  database: D1DatabaseLike,
  input: { page: number; pageSize: number; query?: string; status?: LeadStatus },
): Promise<{ leads: AdminLead[]; total: number }> {
  const conditions: string[] = [];
  const params: Array<string | number> = [];
  if (input.status) {
    conditions.push("status = ?");
    params.push(input.status);
  }
  const trimmedQuery = input.query?.trim() ?? "";
  if (trimmedQuery) {
    const pattern = `%${trimmedQuery.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
    conditions.push(
      "(full_name LIKE ? ESCAPE '\\' OR company_name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\')",
    );
    params.push(pattern, pattern, pattern, pattern);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const count = await database.prepare(`
    SELECT COUNT(*) AS total FROM leads ${where}
  `).bind(...params).first<{ total: number }>();
  const rows = await database.prepare(`
    SELECT id, status, full_name, company_name, email, phone, country, message,
      source, delivery_status, assigned_to, created_at, updated_at
    FROM leads
    ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).bind(...params, input.pageSize, (input.page - 1) * input.pageSize).all<{
    id: string;
    status: LeadStatus;
    full_name: string;
    company_name: string | null;
    email: string | null;
    phone: string | null;
    country: string | null;
    message: string | null;
    source: string;
    delivery_status: AdminLead["deliveryStatus"];
    assigned_to: string | null;
    created_at: string;
    updated_at: string;
  }>();

  return {
    leads: rows.results.map((row) => ({
      assignedTo: row.assigned_to,
      companyName: row.company_name,
      country: row.country,
      createdAt: row.created_at,
      deliveryStatus: row.delivery_status,
      email: row.email,
      fullName: row.full_name,
      id: row.id,
      message: row.message,
      phone: row.phone,
      source: row.source,
      status: row.status,
      updatedAt: row.updated_at,
    })),
    total: integer(count?.total ?? 0),
  };
}

export async function updateAdminLeadStatus(
  database: D1DatabaseLike,
  leadId: string,
  status: LeadStatus,
  actorSubject: string,
): Promise<AdminLead | null> {
  const existing = await readAdminLead(database, leadId);
  if (!existing) return null;
  if (existing.status === status) return existing;

  await database.prepare(`
    UPDATE leads
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(status, leadId).run();
  await database.prepare(`
    INSERT INTO lead_events (id, lead_id, actor_subject, event_type, message)
    VALUES (?, ?, ?, 'status_changed', ?)
  `).bind(
    crypto.randomUUID(),
    leadId,
    actorSubject,
    JSON.stringify({ from: existing.status, to: status }),
  ).run();
  await writeAuditLog(database, actorSubject, "lead.status_updated", "lead", leadId, {
    from: existing.status,
    to: status,
  });
  return readAdminLead(database, leadId);
}

async function readAdminLead(database: D1DatabaseLike, leadId: string): Promise<AdminLead | null> {
  const row = await database.prepare(`
    SELECT id, status, full_name, company_name, email, phone, country, message,
      source, delivery_status, assigned_to, created_at, updated_at
    FROM leads
    WHERE id = ?
    LIMIT 1
  `).bind(leadId).first<AdminLeadRow>();
  return row ? toAdminLead(row) : null;
}

type ProductRow = {
  id: number;
  name: string;
  slug: string;
  sku: string;
  category_id: number | null;
  category_name: string | null;
  short_description: string;
  description: string;
  image_url: string | null;
  is_active: number;
  revision: number;
  status?: AdminPublishStatus;
  lead_time_days?: number | null;
  meta_updated_at?: string | null;
};

type AdminLeadRow = {
  id: string;
  status: LeadStatus;
  full_name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  message: string | null;
  source: string;
  delivery_status: AdminLead["deliveryStatus"];
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
};

type ServiceRow = {
  id: number;
  name: string;
  slug: string;
  summary: string;
  description: string;
  is_active: number;
  image_url?: string | null;
  status?: AdminPublishStatus;
  lead_time_days?: number | null;
  moq_summary?: string | null;
  meta_updated_at?: string | null;
};

type VariantRow = {
  id: number;
  product_id: number;
  name: string;
  sku: string;
  option_label: string;
  unit: string;
  moq: number;
  quantity_step: number;
  contact_from_quantity: number;
  is_available: number;
  sort_order: number;
  attribute_id: number;
  attribute_code: string;
  attribute_label: string;
  option_id: number;
  image_url: string | null;
  revision: number;
};

type VariantTierRow = {
  id: number;
  variant_id: number;
  min_quantity: number;
  price: number;
  currency: "VND";
};

async function syncProductMeta(
  database: D1DatabaseLike,
  productId: number,
  input: AdminProductInput,
  actorSubject: string,
): Promise<void> {
  if (!await tableExists(database, "product_admin_meta")) return;
  await database.prepare(`
    INSERT INTO product_admin_meta (product_id, status, lead_time_days, updated_by, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(product_id) DO UPDATE SET
      status = excluded.status,
      lead_time_days = excluded.lead_time_days,
      updated_by = excluded.updated_by,
      updated_at = CURRENT_TIMESTAMP
  `).bind(productId, input.status, input.leadTimeDays, actorSubject).run();
}

async function syncServiceMeta(
  database: D1DatabaseLike,
  serviceId: number,
  input: AdminServiceInput,
  actorSubject: string,
): Promise<void> {
  if (!await tableExists(database, "service_admin_meta")) return;
  await database.prepare(`
    INSERT INTO service_admin_meta (service_id, status, lead_time_days, moq_summary, updated_by, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(service_id) DO UPDATE SET
      status = excluded.status,
      lead_time_days = excluded.lead_time_days,
      moq_summary = excluded.moq_summary,
      updated_by = excluded.updated_by,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    serviceId,
    input.status,
    input.leadTimeDays,
    input.moqSummary,
    actorSubject,
  ).run();
}

async function writeAuditLog(
  database: D1DatabaseLike,
  actorSubject: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: unknown,
): Promise<void> {
  if (!await tableExists(database, "audit_logs")) return;
  await database.prepare(`
    INSERT INTO audit_logs (id, actor_subject, action, entity_type, entity_id, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    actorSubject,
    action,
    entityType,
    entityId,
    JSON.stringify(metadata),
  ).run();
}

function toAdminProduct(row: ProductRow): AdminProduct {
  return {
    categoryId: row.category_id,
    categoryName: row.category_name,
    description: row.description,
    id: row.id,
    imageUrl: row.image_url,
    isActive: row.is_active === 1,
    leadTimeDays: row.lead_time_days ?? null,
    name: row.name,
    revision: row.revision,
    shortDescription: row.short_description,
    sku: row.sku,
    slug: row.slug,
    status: row.status ?? (row.is_active === 1 ? "published" : "archived"),
    updatedAt: row.meta_updated_at ?? null,
  };
}

function toAdminService(row: ServiceRow): AdminService {
  return {
    description: row.description,
    id: row.id,
    imageUrl: row.image_url ?? null,
    isActive: row.is_active === 1,
    leadTimeDays: row.lead_time_days ?? null,
    moqSummary: row.moq_summary ?? null,
    name: row.name,
    slug: row.slug,
    status: row.status ?? (row.is_active === 1 ? "published" : "archived"),
    summary: row.summary,
    updatedAt: row.meta_updated_at ?? null,
  };
}

function toAdminVariant(row: VariantRow, tiers: VariantTierRow[]): AdminProductVariant {
  return {
    attributeCode: row.attribute_code,
    attributeId: row.attribute_id,
    attributeLabel: row.attribute_label,
    contactFromQuantity: row.contact_from_quantity,
    id: row.id,
    imageUrl: row.image_url,
    isAvailable: row.is_available === 1,
    moq: row.moq,
    name: row.name,
    optionId: row.option_id,
    optionLabel: row.option_label,
    productId: row.product_id,
    quantityStep: row.quantity_step,
    revision: row.revision,
    sku: row.sku,
    sortOrder: row.sort_order,
    tierPrices: tiers.map((tier) => ({
      currency: tier.currency,
      id: tier.id,
      minQuantity: tier.min_quantity,
      price: tier.price,
    })),
    unit: row.unit,
  };
}

function groupVariantTiers(rows: VariantTierRow[]): Map<number, VariantTierRow[]> {
  const grouped = new Map<number, VariantTierRow[]>();
  for (const row of rows) grouped.set(row.variant_id, [...(grouped.get(row.variant_id) ?? []), row]);
  return grouped;
}

async function replaceVariantTiers(
  database: D1DatabaseLike,
  variantId: number,
  tiers: Array<{ currency: "VND"; minQuantity: number; price: number }>,
): Promise<void> {
  await database.prepare("DELETE FROM variant_tier_prices WHERE variant_id = ?").bind(variantId).run();
  for (const tier of tiers) {
    await database.prepare(`
      INSERT INTO variant_tier_prices (variant_id, min_quantity, price, currency)
      VALUES (?, ?, ?, ?)
    `).bind(variantId, tier.minQuantity, tier.price, tier.currency).run();
  }
}

function toAdminLead(row: AdminLeadRow): AdminLead {
  return {
    assignedTo: row.assigned_to,
    companyName: row.company_name,
    country: row.country,
    createdAt: row.created_at,
    deliveryStatus: row.delivery_status,
    email: row.email,
    fullName: row.full_name,
    id: row.id,
    message: row.message,
    phone: row.phone,
    source: row.source,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

async function countRows(
  database: D1DatabaseLike,
  tableName: string,
  where?: string,
): Promise<{ count: number; ready: boolean }> {
  try {
    const exists = await tableExists(database, tableName);
    if (!exists) return { count: 0, ready: false };
    const row = await database.prepare(`SELECT COUNT(*) AS total FROM ${tableName}${where ? ` WHERE ${where}` : ""}`).first<{ total: number }>();
    return { count: integer(row?.total ?? 0), ready: true };
  } catch {
    return { count: 0, ready: false };
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function integer(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}
// ---------------------------------------------------------------------------
// Categories CRUD (contract locked 2026-08-23; UI may only build on these)
// ---------------------------------------------------------------------------

export interface AdminCategoryDetail {
  description: string;
  id: number;
  imageUrl: string | null;
  isActive: boolean;
  name: string;
  revision: number;
  slug: string;
  sortOrder: number;
}

interface CategoryDetailRow {
  description: string;
  id: number;
  image_url: string | null;
  is_active: number;
  name: string;
  revision: number;
  slug: string;
  sort_order: number;
}

function toCategoryDetail(row: CategoryDetailRow): AdminCategoryDetail {
  return {
    description: typeof row.description === "string" ? row.description : "",
    id: row.id,
    imageUrl: row.image_url ?? null,
    isActive: row.is_active === 1,
    name: row.name,
    revision: row.revision,
    slug: row.slug,
    sortOrder: row.sort_order,
  };
}

export async function getAdminCategory(
  database: D1DatabaseLike,
  id: number,
): Promise<AdminCategoryDetail | null> {
  const row = await database.prepare(`
    SELECT id, name, slug, description, image_url, sort_order, is_active, revision
    FROM categories
    WHERE id = ?
    LIMIT 1
  `).bind(id).first<CategoryDetailRow>();
  return row ? toCategoryDetail(row) : null;
}

export async function listAdminCategoryDetails(database: D1DatabaseLike): Promise<AdminCategoryDetail[]> {
  const result = await database.prepare(`
    SELECT id, name, slug, description, image_url, sort_order, is_active, revision
    FROM categories
    ORDER BY sort_order ASC, name COLLATE NOCASE ASC, id ASC
    LIMIT 100
  `).all<CategoryDetailRow>();
  return result.results.map(toCategoryDetail);
}

export async function createAdminCategory(
  database: D1DatabaseLike,
  input: AdminCategoryInput,
  actorSubject: string,
): Promise<AdminCategoryDetail> {
  await database.prepare(`
    INSERT INTO categories (name, slug, description, image_url, sort_order, is_active)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(input.name, input.slug, input.description, input.imageUrl, input.sortOrder, input.isActive ? 1 : 0).run();

  const created = await database.prepare("SELECT id FROM categories WHERE slug = ? LIMIT 1")
    .bind(input.slug)
    .first<{ id: number }>();
  if (!created) throw new AdminDataError("Không thể đọc lại danh mục vừa tạo.");

  await writeAuditLog(database, actorSubject, "category.created", "category", String(created.id), input);
  const detail = await getAdminCategory(database, created.id);
  if (!detail) throw new AdminDataError("Không thể đọc lại danh mục vừa tạo.");
  return detail;
}

export async function updateAdminCategory(
  database: D1DatabaseLike,
  id: number,
  input: AdminCategoryInput,
  expectedRevision: number,
  actorSubject: string,
): Promise<AdminCategoryDetail | null> {
  const existing = await getAdminCategory(database, id);
  if (!existing) return null;
  if (existing.revision !== expectedRevision) {
    throw new AdminDataError("Dữ liệu danh mục đã thay đổi. Hãy tải lại trước khi lưu.");
  }

  await database.prepare(`
    UPDATE categories
    SET name = ?, slug = ?, description = ?, image_url = ?, sort_order = ?, is_active = ?,
      updated_at = CURRENT_TIMESTAMP, revision = revision + 1
    WHERE id = ?
  `).bind(input.name, input.slug, input.description, input.imageUrl, input.sortOrder, input.isActive ? 1 : 0, id).run();

  await writeAuditLog(database, actorSubject, "category.updated", "category", String(id), input);
  return getAdminCategory(database, id);
}

// ---------------------------------------------------------------------------
// News posts CRUD (draft/published contract locked 2026-08-28; storefront
// reads only the published snapshot).
// ---------------------------------------------------------------------------

export interface AdminNewsSnapshot {
  content: string;
  coverImageUrl: string | null;
  excerpt: string;
  slug: string;
  title: string;
}

export interface AdminNewsPost extends AdminNewsSnapshot {
  draft: AdminNewsSnapshot;
  id: number;
  isPublished: boolean;
  published: AdminNewsSnapshot | null;
  publishedAt: string | null;
  revision: number;
  updatedAt: string;
}

export interface AdminNewsListItem {
  excerpt: string;
  id: number;
  isPublished: boolean;
  publishedAt: string | null;
  revision: number;
  slug: string;
  title: string;
  updatedAt: string;
}

interface NewsRow {
  content: string;
  cover_image_url: string | null;
  draft_content: string;
  draft_cover_image_url: string | null;
  draft_excerpt: string;
  draft_slug: string;
  draft_title: string;
  excerpt: string;
  id: number;
  is_published: number;
  published_at: string | null;
  published_content: string | null;
  published_cover_image_url: string | null;
  published_excerpt: string | null;
  published_slug: string | null;
  published_title: string | null;
  revision: number;
  slug: string;
  title: string;
  updated_at: string;
}

function toNewsPost(row: NewsRow): AdminNewsPost {
  const draft: AdminNewsSnapshot = {
    content: row.draft_content,
    coverImageUrl: row.draft_cover_image_url ?? null,
    excerpt: row.draft_excerpt,
    slug: row.draft_slug,
    title: row.draft_title,
  };
  const published = row.published_slug
    ? {
        content: row.published_content ?? "",
        coverImageUrl: row.published_cover_image_url ?? null,
        excerpt: row.published_excerpt ?? "",
        slug: row.published_slug,
        title: row.published_title ?? "",
      }
    : null;
  return {
    ...draft,
    draft,
    id: row.id,
    isPublished: row.is_published === 1 && published !== null,
    published,
    publishedAt: row.published_at ?? null,
    revision: row.revision,
    updatedAt: row.updated_at,
  };
}

export class AdminNewsConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminNewsConflictError";
  }
}

export class AdminNewsIdempotencyConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminNewsIdempotencyConflictError";
  }
}

export class AdminNewsStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminNewsStorageError";
  }
}

export class AdminNewsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminNewsValidationError";
  }
}

export async function getAdminNewsPost(database: D1DatabaseLike, id: number): Promise<AdminNewsPost | null> {
  const row = await database.prepare(`
    SELECT id, slug, title, excerpt, content, cover_image_url,
      draft_slug, draft_title, draft_excerpt, draft_content, draft_cover_image_url,
      published_slug, published_title, published_excerpt, published_content, published_cover_image_url,
      is_published, published_at, revision, updated_at
    FROM news_posts
    WHERE id = ?
    LIMIT 1
  `).bind(id).first<NewsRow>();
  return row ? toNewsPost(row) : null;
}

export async function listAdminNewsPosts(
  database: D1DatabaseLike,
  input: { page: number; pageSize: number },
): Promise<{ posts: AdminNewsListItem[]; total: number }> {
  const count = await database.prepare("SELECT COUNT(*) AS total FROM news_posts").first<{ total: number }>();
  const rows = await database.prepare(`
    SELECT id, slug, title, excerpt, content, cover_image_url,
      draft_slug, draft_title, draft_excerpt, draft_content, draft_cover_image_url,
      published_slug, published_title, published_excerpt, published_content, published_cover_image_url,
      is_published, published_at, revision, updated_at
    FROM news_posts
    ORDER BY updated_at DESC, id DESC
    LIMIT ? OFFSET ?
  `).bind(input.pageSize, (input.page - 1) * input.pageSize).all<NewsRow & { content: string }>();
  return {
    posts: rows.results.map((row) => ({
      excerpt: row.draft_excerpt,
      id: row.id,
      isPublished: row.is_published === 1 && Boolean(row.published_slug),
      publishedAt: row.published_at ?? null,
      revision: row.revision,
      slug: row.draft_slug,
      title: row.draft_title,
      updatedAt: row.updated_at,
    })),
    total: count?.total ?? 0,
  };
}

export async function createAdminNewsPost(
  database: D1DatabaseLike,
  input: AdminNewsDraftInput,
  actorSubject: string,
  requestId: string,
): Promise<AdminNewsPost> {
  const normalizedRequestId = normalizeNewsRequestId(requestId);
  const payloadSha256 = await fingerprintNewsMutation({ input, operation: "draft" });
  const existingMutation = await findNewsMutation(database, normalizedRequestId);
  if (existingMutation) {
    assertMatchingNewsMutation(existingMutation, "draft", payloadSha256);
    return readNewsPostFromMutation(database, existingMutation);
  }

  const databaseWithBatch = requireNewsBatch(database);
  const insert = database.prepare(`
    INSERT INTO news_posts (
      slug, title, excerpt, content, cover_image_url, is_published, published_at,
      draft_slug, draft_title, draft_excerpt, draft_content, draft_cover_image_url,
      last_request_id
    ) VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, ?, ?, ?)
  `).bind(
    input.slug,
    input.title,
    input.excerpt,
    input.content,
    input.coverImageUrl,
    input.slug,
    input.title,
    input.excerpt,
    input.content,
    input.coverImageUrl,
    normalizedRequestId,
  );
  const audit = database.prepare(`
    INSERT INTO admin_news_audit (
      request_id, actor_subject, action, operation, entity_type, entity_key,
      previous_revision, resulting_revision, payload_sha256
    )
    SELECT ?, ?, 'create', 'draft', 'news_post', CAST(id AS TEXT), NULL, revision, ?
    FROM news_posts
    WHERE last_request_id = ? AND draft_slug = ?
    LIMIT 1
  `).bind(normalizedRequestId, actorSubject, payloadSha256, normalizedRequestId, input.slug);

  try {
    const results = await databaseWithBatch.batch([insert, audit]);
    assertNewsBatchResult(results, 2);
    if (!hasChanged(results[0]) || !hasChanged(results[1])) {
      throw new AdminNewsStorageError("News create chưa ghi được audit đồng bộ.");
    }
  } catch (error) {
    const racedMutation = await findNewsMutation(database, normalizedRequestId);
    if (racedMutation) {
      assertMatchingNewsMutation(racedMutation, "draft", payloadSha256);
      return readNewsPostFromMutation(database, racedMutation);
    }
    throw error;
  }

  const created = await database.prepare("SELECT id FROM news_posts WHERE last_request_id = ? LIMIT 1")
    .bind(normalizedRequestId)
    .first<{ id: number }>();
  if (!created) throw new AdminNewsStorageError("Không thể đọc lại bài viết vừa tạo.");
  const post = await getAdminNewsPost(database, created.id);
  if (!post) throw new AdminNewsStorageError("Không thể đọc lại bài viết vừa tạo.");
  return post;
}

export async function updateAdminNewsPost(
  database: D1DatabaseLike,
  id: number,
  input: AdminNewsDraftInput,
  expectedRevision: number,
  actorSubject: string,
  requestId: string,
): Promise<AdminNewsPost | null> {
  const normalizedRequestId = normalizeNewsRequestId(requestId);
  const payloadSha256 = await fingerprintNewsMutation({
    expectedRevision,
    id,
    input,
    operation: "draft",
  });
  const existingMutation = await findNewsMutation(database, normalizedRequestId);
  if (existingMutation) {
    assertMatchingNewsMutation(existingMutation, "draft", payloadSha256);
    return readNewsPostFromMutation(database, existingMutation);
  }

  const existing = await getAdminNewsPost(database, id);
  if (!existing) return null;
  if (existing.revision !== expectedRevision) {
    throw new AdminNewsConflictError("Bài viết đã thay đổi. Hãy tải lại trước khi lưu.");
  }

  const databaseWithBatch = requireNewsBatch(database);
  const update = database.prepare(`
    UPDATE news_posts
    SET slug = ?, title = ?, excerpt = ?, content = ?, cover_image_url = ?,
      draft_slug = ?, draft_title = ?, draft_excerpt = ?, draft_content = ?, draft_cover_image_url = ?,
      updated_at = CURRENT_TIMESTAMP, revision = revision + 1, last_request_id = ?
    WHERE id = ? AND revision = ?
  `).bind(
    input.slug,
    input.title,
    input.excerpt,
    input.content,
    input.coverImageUrl,
    input.slug,
    input.title,
    input.excerpt,
    input.content,
    input.coverImageUrl,
    normalizedRequestId,
    id,
    expectedRevision,
  );
  const audit = database.prepare(`
    INSERT INTO admin_news_audit (
      request_id, actor_subject, action, operation, entity_type, entity_key,
      previous_revision, resulting_revision, payload_sha256
    )
    SELECT ?, ?, 'update', 'draft', 'news_post', CAST(id AS TEXT), ?, revision, ?
    FROM news_posts
    WHERE id = ? AND revision = ? AND last_request_id = ?
  `).bind(
    normalizedRequestId,
    actorSubject,
    expectedRevision,
    payloadSha256,
    id,
    expectedRevision + 1,
    normalizedRequestId,
  );
  try {
    const results = await databaseWithBatch.batch([update, audit]);
    assertNewsBatchResult(results, 2);
    if (!hasChanged(results[0])) return resolveNewsConflict(database, normalizedRequestId, payloadSha256, "draft");
    if (!hasChanged(results[1])) throw new AdminNewsStorageError("News draft chưa ghi được audit đồng bộ.");
  } catch (error) {
    const racedMutation = await findNewsMutation(database, normalizedRequestId);
    if (racedMutation) {
      assertMatchingNewsMutation(racedMutation, "draft", payloadSha256);
      return readNewsPostFromMutation(database, racedMutation);
    }
    throw error;
  }
  return getAdminNewsPost(database, id);
}

export async function deleteAdminNewsPost(
  database: D1DatabaseLike,
  id: number,
  expectedRevision: number,
  actorSubject: string,
  requestId: string,
): Promise<boolean> {
  const normalizedRequestId = normalizeNewsRequestId(requestId);
  const payloadSha256 = await fingerprintNewsMutation({ expectedRevision, id, operation: "delete" });
  const existingMutation = await findNewsMutation(database, normalizedRequestId);
  if (existingMutation) {
    assertMatchingNewsMutation(existingMutation, "delete", payloadSha256);
    return true;
  }

  const existing = await getAdminNewsPost(database, id);
  if (!existing) return false;
  if (existing.revision !== expectedRevision) {
    throw new AdminNewsConflictError("Bài viết đã thay đổi. Hãy tải lại trước khi xóa.");
  }

  const databaseWithBatch = requireNewsBatch(database);
  const audit = database.prepare(`
    INSERT INTO admin_news_audit (
      request_id, actor_subject, action, operation, entity_type, entity_key,
      previous_revision, resulting_revision, payload_sha256
    )
    SELECT ?, ?, 'delete', 'delete', 'news_post', CAST(id AS TEXT), revision, NULL, ?
    FROM news_posts
    WHERE id = ? AND revision = ?
  `).bind(normalizedRequestId, actorSubject, payloadSha256, id, expectedRevision);
  const deletion = database.prepare("DELETE FROM news_posts WHERE id = ? AND revision = ?")
    .bind(id, expectedRevision);
  try {
    const results = await databaseWithBatch.batch([audit, deletion]);
    assertNewsBatchResult(results, 2);
    if (!hasChanged(results[0]) || !hasChanged(results[1])) {
      throw new AdminNewsConflictError("Bài viết đã thay đổi. Hãy tải lại trước khi xóa.");
    }
  } catch (error) {
    const racedMutation = await findNewsMutation(database, normalizedRequestId);
    if (racedMutation) {
      assertMatchingNewsMutation(racedMutation, "delete", payloadSha256);
      return true;
    }
    throw error;
  }
  return true;
}

export async function publishAdminNewsPost(
  database: D1DatabaseLike,
  id: number,
  expectedRevision: number,
  actorSubject: string,
  requestId: string,
): Promise<AdminNewsPost | null> {
  return setAdminNewsPublication(database, id, expectedRevision, actorSubject, requestId, true);
}

export async function unpublishAdminNewsPost(
  database: D1DatabaseLike,
  id: number,
  expectedRevision: number,
  actorSubject: string,
  requestId: string,
): Promise<AdminNewsPost | null> {
  return setAdminNewsPublication(database, id, expectedRevision, actorSubject, requestId, false);
}

export type NewsBatchSkipReason = "not_found" | "stale" | "validation";

export interface AdminNewsBatchItem {
  expectedRevision: number;
  id: number;
}

export interface AdminNewsBatchResult {
  changed: AdminNewsPost[];
  changedCount: number;
  selectedCount: number;
  skipped: Array<{ id: number; reason: NewsBatchSkipReason }>;
}

export async function batchAdminNewsPublication(
  database: D1DatabaseLike,
  input: {
    actorSubject: string;
    items: AdminNewsBatchItem[];
    publish: boolean;
    requestId: string;
  },
): Promise<AdminNewsBatchResult> {
  if (input.items.length > 100) throw new AdminNewsValidationError("Mỗi lần chỉ được xử lý tối đa 100 bài viết.");
  const items = [...input.items].sort((left, right) => left.id - right.id);
  if (items.some((item) => !Number.isInteger(item.id) || item.id < 1 || !Number.isInteger(item.expectedRevision) || item.expectedRevision < 1)) {
    throw new AdminNewsValidationError("Danh sách bài viết hoặc revision không hợp lệ.");
  }
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    throw new AdminNewsValidationError("Danh sách bài viết không được chứa lựa chọn trùng.");
  }

  const requestId = normalizeNewsRequestId(input.requestId);
  const operation = input.publish ? "publish" : "unpublish";
  const payloadSha256 = await fingerprintNewsMutation({ items, operation: "status_batch", publish: input.publish });
  const existingMutation = await findNewsBulkMutation(database, requestId);
  if (existingMutation) {
    assertMatchingNewsBulkMutation(existingMutation, payloadSha256);
    return readNewsBulkResult(database, requestId, existingMutation, items, input.publish);
  }

  const snapshots = await Promise.all(items.map(async (item) => ({
    item,
    post: await getAdminNewsPost(database, item.id),
  })));
  const eligible = snapshots.filter(({ item, post }) => post && post.revision === item.expectedRevision && (!input.publish || Boolean(post.draft.excerpt.trim())));
  const databaseWithBatch = requireNewsBatch(database);
  const statements: D1PreparedStatementLike[] = [database.prepare(`
    INSERT INTO admin_news_bulk_audit (
      request_id, actor_subject, action, operation, payload_sha256,
      selected_count, changed_count
    ) VALUES (?, ?, 'update', 'status_batch', ?, ?, 0)
  `).bind(requestId, input.actorSubject, payloadSha256, items.length)];

  for (const { item } of eligible) {
    const childRequestId = crypto.randomUUID();
    const childPayloadSha256 = await fingerprintNewsMutation({
      expectedRevision: item.expectedRevision,
      id: item.id,
      operation,
    });
    const update = input.publish
      ? database.prepare(`
        UPDATE news_posts
        SET published_slug = draft_slug, published_title = draft_title,
          published_excerpt = draft_excerpt, published_content = draft_content,
          published_cover_image_url = draft_cover_image_url,
          is_published = 1, published_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP, revision = revision + 1, last_request_id = ?
        WHERE id = ? AND revision = ?
      `).bind(childRequestId, item.id, item.expectedRevision)
      : database.prepare(`
        UPDATE news_posts
        SET is_published = 0, updated_at = CURRENT_TIMESTAMP,
          revision = revision + 1, last_request_id = ?
        WHERE id = ? AND revision = ?
      `).bind(childRequestId, item.id, item.expectedRevision);
    const audit = database.prepare(`
      INSERT INTO admin_news_audit (
        request_id, actor_subject, action, operation, entity_type, entity_key,
        previous_revision, resulting_revision, payload_sha256, bulk_request_id
      )
      SELECT ?, ?, 'update', ?, 'news_post', CAST(id AS TEXT), ?, revision, ?, ?
      FROM news_posts
      WHERE id = ? AND revision = ? AND last_request_id = ?
    `).bind(
      childRequestId,
      input.actorSubject,
      operation,
      item.expectedRevision,
      childPayloadSha256,
      requestId,
      item.id,
      item.expectedRevision + 1,
      childRequestId,
    );
    statements.push(update, audit);
  }
  statements.push(database.prepare(`
    UPDATE admin_news_bulk_audit
    SET changed_count = (
      SELECT COUNT(*) FROM admin_news_audit WHERE bulk_request_id = ?
    )
    WHERE request_id = ?
  `).bind(requestId, requestId));

  try {
    const results = await databaseWithBatch.batch(statements);
    assertNewsBatchResult(results, statements.length);
    if (!hasChanged(results[0]) || !hasChanged(results.at(-1))) {
      throw new AdminNewsStorageError("News bulk chưa ghi được audit envelope.");
    }
    for (let index = 1; index < results.length - 1; index += 2) {
      if (hasChanged(results[index]) !== hasChanged(results[index + 1])) {
        throw new AdminNewsStorageError("News bulk có bài viết thiếu audit đồng bộ.");
      }
    }
  } catch (error) {
    const racedMutation = await findNewsBulkMutation(database, requestId);
    if (racedMutation) {
      assertMatchingNewsBulkMutation(racedMutation, payloadSha256);
      return readNewsBulkResult(database, requestId, racedMutation, items, input.publish);
    }
    throw error;
  }
  const mutation = await findNewsBulkMutation(database, requestId);
  if (!mutation) throw new AdminNewsStorageError("Không đọc lại được audit news bulk.");
  return readNewsBulkResult(database, requestId, mutation, items, input.publish);
}

async function setAdminNewsPublication(
  database: D1DatabaseLike,
  id: number,
  expectedRevision: number,
  actorSubject: string,
  requestId: string,
  publish: boolean,
): Promise<AdminNewsPost | null> {
  const operation = publish ? "publish" : "unpublish";
  const normalizedRequestId = normalizeNewsRequestId(requestId);
  const payloadSha256 = await fingerprintNewsMutation({ expectedRevision, id, operation });
  const existingMutation = await findNewsMutation(database, normalizedRequestId);
  if (existingMutation) {
    assertMatchingNewsMutation(existingMutation, operation, payloadSha256);
    return readNewsPostFromMutation(database, existingMutation);
  }

  const existing = await getAdminNewsPost(database, id);
  if (!existing) return null;
  if (existing.revision !== expectedRevision) {
    throw new AdminNewsConflictError("Bài viết đã thay đổi. Hãy tải lại trước khi phát hành.");
  }
  if (publish && !existing.draft.excerpt.trim()) {
    throw new AdminNewsValidationError("Bài viết cần tóm tắt trước khi phát hành.");
  }

  const databaseWithBatch = requireNewsBatch(database);
  const update = publish
    ? database.prepare(`
      UPDATE news_posts
      SET published_slug = draft_slug, published_title = draft_title,
        published_excerpt = draft_excerpt, published_content = draft_content,
        published_cover_image_url = draft_cover_image_url,
        is_published = 1, published_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP, revision = revision + 1, last_request_id = ?
      WHERE id = ? AND revision = ?
    `).bind(normalizedRequestId, id, expectedRevision)
    : database.prepare(`
      UPDATE news_posts
      SET is_published = 0, updated_at = CURRENT_TIMESTAMP,
        revision = revision + 1, last_request_id = ?
      WHERE id = ? AND revision = ?
    `).bind(normalizedRequestId, id, expectedRevision);
  const audit = database.prepare(`
    INSERT INTO admin_news_audit (
      request_id, actor_subject, action, operation, entity_type, entity_key,
      previous_revision, resulting_revision, payload_sha256
    )
    SELECT ?, ?, 'update', ?, 'news_post', CAST(id AS TEXT), ?, revision, ?
    FROM news_posts
    WHERE id = ? AND revision = ? AND last_request_id = ?
  `).bind(
    normalizedRequestId,
    actorSubject,
    operation,
    expectedRevision,
    payloadSha256,
    id,
    expectedRevision + 1,
    normalizedRequestId,
  );
  try {
    const results = await databaseWithBatch.batch([update, audit]);
    assertNewsBatchResult(results, 2);
    if (!hasChanged(results[0])) {
      return resolveNewsConflict(database, normalizedRequestId, payloadSha256, operation);
    }
    if (!hasChanged(results[1])) throw new AdminNewsStorageError("News publication chưa ghi được audit đồng bộ.");
  } catch (error) {
    const racedMutation = await findNewsMutation(database, normalizedRequestId);
    if (racedMutation) {
      assertMatchingNewsMutation(racedMutation, operation, payloadSha256);
      return readNewsPostFromMutation(database, racedMutation);
    }
    throw error;
  }
  return getAdminNewsPost(database, id);
}

interface NewsMutationRow {
  action: "create" | "delete" | "update";
  entity_key: string;
  operation: "delete" | "draft" | "publish" | "unpublish";
  payload_sha256: string;
}

interface NewsBulkMutationRow {
  changed_count: number;
  operation: "status_batch";
  payload_sha256: string;
  selected_count: number;
}

interface D1DatabaseWithBatch extends D1DatabaseLike {
  batch(statements: D1PreparedStatementLike[]): Promise<unknown[]>;
}

async function findNewsMutation(database: D1DatabaseLike, requestId: string): Promise<NewsMutationRow | null> {
  return database.prepare(`
    SELECT action, operation, entity_key, payload_sha256
    FROM admin_news_audit
    WHERE request_id = ?
    LIMIT 1
  `).bind(requestId).first<NewsMutationRow>();
}

async function findNewsBulkMutation(database: D1DatabaseLike, requestId: string): Promise<NewsBulkMutationRow | null> {
  return database.prepare(`
    SELECT operation, payload_sha256, selected_count, changed_count
    FROM admin_news_bulk_audit
    WHERE request_id = ?
    LIMIT 1
  `).bind(requestId).first<NewsBulkMutationRow>();
}

function assertMatchingNewsMutation(
  mutation: NewsMutationRow,
  operation: NewsMutationRow["operation"],
  payloadSha256: string,
): void {
  if (mutation.operation !== operation || mutation.payload_sha256 !== payloadSha256) {
    throw new AdminNewsIdempotencyConflictError("requestId đã được dùng cho một payload khác.");
  }
}

function assertMatchingNewsBulkMutation(mutation: NewsBulkMutationRow, payloadSha256: string): void {
  if (mutation.operation !== "status_batch" || mutation.payload_sha256 !== payloadSha256) {
    throw new AdminNewsIdempotencyConflictError("requestId đã được dùng cho một bulk payload khác.");
  }
}

async function readNewsBulkResult(
  database: D1DatabaseLike,
  requestId: string,
  mutation: NewsBulkMutationRow,
  items: AdminNewsBatchItem[],
  publish: boolean,
): Promise<AdminNewsBatchResult> {
  const auditRows = await database.prepare(`
    SELECT entity_key
    FROM admin_news_audit
    WHERE bulk_request_id = ?
    ORDER BY id ASC
  `).bind(requestId).all<{ entity_key: string }>();
  if (auditRows.results.length !== mutation.changed_count) {
    throw new AdminNewsStorageError("News bulk audit không khớp số bài đã xử lý.");
  }
  const changedIds = new Set(
    auditRows.results
      .map((row) => Number(row.entity_key))
      .filter((id) => Number.isInteger(id) && id > 0),
  );
  const currentPosts = await Promise.all(items.map(async (item) => ({
    item,
    post: await getAdminNewsPost(database, item.id),
  })));
  const changed = currentPosts
    .filter(({ item }) => changedIds.has(item.id))
    .map(({ post }) => post)
    .filter((post): post is AdminNewsPost => Boolean(post));
  const skipped = currentPosts
    .filter(({ item }) => !changedIds.has(item.id))
    .map(({ item, post }) => ({ id: item.id, reason: newsBatchSkipReason(post, publish) }));
  return {
    changed,
    changedCount: mutation.changed_count,
    selectedCount: mutation.selected_count,
    skipped,
  };
}

function newsBatchSkipReason(
  post: AdminNewsPost | null,
  publish: boolean,
): NewsBatchSkipReason {
  if (!post) return "not_found";
  if (publish && !post.draft.excerpt.trim()) return "validation";
  return "stale";
}

async function readNewsPostFromMutation(database: D1DatabaseLike, mutation: NewsMutationRow): Promise<AdminNewsPost> {
  const id = Number(mutation.entity_key);
  const post = Number.isInteger(id) && id > 0 ? await getAdminNewsPost(database, id) : null;
  if (!post) throw new AdminNewsStorageError("Không đọc lại được kết quả news từ audit.");
  return post;
}

async function resolveNewsConflict(
  database: D1DatabaseLike,
  requestId: string,
  payloadSha256: string,
  operation: NewsMutationRow["operation"],
): Promise<AdminNewsPost> {
  const mutation = await findNewsMutation(database, requestId);
  if (mutation) {
    assertMatchingNewsMutation(mutation, operation, payloadSha256);
    return readNewsPostFromMutation(database, mutation);
  }
  throw new AdminNewsConflictError("Bài viết đã thay đổi ở phiên khác. Hãy tải lại rồi thử lại.");
}

function requireNewsBatch(database: D1DatabaseLike): D1DatabaseWithBatch {
  const databaseWithBatch = database as D1DatabaseWithBatch;
  if (typeof databaseWithBatch.batch !== "function") {
    throw new AdminNewsStorageError("D1 atomic batch chưa sẵn sàng cho news write.");
  }
  return databaseWithBatch;
}

function assertNewsBatchResult(results: unknown[], expectedLength: number): void {
  if (results.length !== expectedLength) throw new AdminNewsStorageError("D1 news batch trả về kết quả không hợp lệ.");
}

function hasChanged(result: unknown): boolean {
  if (typeof result !== "object" || result === null) return true;
  const meta = (result as { meta?: { changes?: unknown } }).meta;
  return meta?.changes === undefined || Number(meta.changes) > 0;
}

function normalizeNewsRequestId(value: string): string {
  const requestId = value.trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(requestId)) {
    throw new AdminNewsValidationError("requestId phải là UUID hợp lệ.");
  }
  return requestId;
}

async function fingerprintNewsMutation(input: Record<string, unknown>): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(input));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
