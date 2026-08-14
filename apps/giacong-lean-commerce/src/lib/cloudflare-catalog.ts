import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cache } from "react";

import type {
  CatalogCategory,
  CatalogFilters,
  CatalogOptionGroup,
  CatalogPageSize,
  CatalogProductDetail,
  CatalogProductList,
  CatalogProductParent,
  CatalogSort,
  CatalogSortDirection,
  CatalogTierPrice,
  CatalogVariant,
} from "@/types/catalog";

interface D1Result<T> {
  results: T[];
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}

interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatement;
}

interface CloudflareCatalogEnv {
  GIACONG_VN_CATALOG?: D1DatabaseLike;
}

interface CategoryRow {
  id: number;
  name: string;
  slug: string;
}

interface ProductListRow {
  available_variant_count: number;
  category_id: number | null;
  category_name: string | null;
  category_slug: string | null;
  description: string;
  id: number;
  image_url: string | null;
  name: string;
  short_description: string;
  sku: string;
  slug: string;
  starting_price: number | null;
  variant_count: number;
}

interface ProductDetailRow extends ProductListRow {}

interface VariantRow {
  attribute_code: string;
  attribute_id: number;
  attribute_label: string;
  contact_from_quantity: number;
  id: number;
  image_url: string | null;
  is_available: number;
  moq: number;
  name: string;
  option_id: number;
  option_label: string;
  product_id: number;
  quantity_step: number;
  sku: string;
  sort_order: number;
  unit: string;
}

interface TierRow {
  currency: string;
  min_quantity: number;
  price: number;
  variant_id: number;
}

interface CountRow {
  total: number;
}

export class CatalogDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogDataError";
  }
}

export const getCatalogCategories = cache(async (): Promise<CatalogCategory[]> => {
  const db = getCatalogDatabase();
  const result = await db.prepare(`
    SELECT id, name, slug
    FROM categories
    WHERE is_active = 1
    ORDER BY sort_order ASC, name COLLATE NOCASE ASC, id ASC
  `).all<CategoryRow>();

  return result.results.map(toCategory);
});

export async function getCatalogProducts(filters: CatalogFilters): Promise<CatalogProductList> {
  const db = getCatalogDatabase();
  const where: string[] = ["p.is_active = 1"];
  const params: unknown[] = [];

  if (filters.query) {
    const pattern = `%${escapeLike(filters.query.trim())}%`;
    where.push(`(
      p.name LIKE ? ESCAPE '\\' COLLATE NOCASE
      OR p.sku LIKE ? ESCAPE '\\' COLLATE NOCASE
      OR p.short_description LIKE ? ESCAPE '\\' COLLATE NOCASE
    )`);
    params.push(pattern, pattern, pattern);
  }

  if (filters.category) {
    where.push("c.slug = ? AND c.is_active = 1");
    params.push(filters.category);
  }

  const whereSql = where.join(" AND ");
  const count = await db.prepare(`
    SELECT COUNT(*) AS total
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE ${whereSql}
  `).bind(...params).first<CountRow>();
  const total = integer(count?.total ?? 0, "catalog total", true);
  const offset = (filters.page - 1) * filters.pageSize;
  const orderBy = productOrderBy(filters.sort, filters.direction);

  const result = await db.prepare(`
    WITH variant_stats AS (
      SELECT
        p.id AS product_id,
        COUNT(v.id) AS variant_count,
        COALESCE(SUM(CASE WHEN v.is_available = 1 THEN 1 ELSE 0 END), 0) AS available_variant_count,
        MIN(CASE
          WHEN v.is_available = 1 AND tp.min_quantity = v.moq THEN tp.price
          ELSE NULL
        END) AS starting_price
      FROM products p
      LEFT JOIN product_variants v ON v.product_id = p.id
      LEFT JOIN variant_tier_prices tp ON tp.variant_id = v.id
      GROUP BY p.id
    )
    SELECT
      p.id,
      p.name,
      p.slug,
      p.sku,
      p.short_description,
      p.description,
      p.image_url,
      c.id AS category_id,
      c.name AS category_name,
      c.slug AS category_slug,
      COALESCE(vs.variant_count, 0) AS variant_count,
      COALESCE(vs.available_variant_count, 0) AS available_variant_count,
      vs.starting_price
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN variant_stats vs ON vs.product_id = p.id
    WHERE ${whereSql}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).bind(...params, filters.pageSize, offset).all<ProductListRow>();

  const products = result.results.map(toParentProduct);
  return {
    products,
    pagination: {
      currentPage: filters.page,
      lastPage: Math.max(1, Math.ceil(total / filters.pageSize)),
      perPage: filters.pageSize,
      total,
    },
  };
}

export const getCatalogProduct = cache(async (slug: string): Promise<CatalogProductDetail | null> => {
  const cleanSlug = slug.trim();
  if (!cleanSlug) return null;

  const db = getCatalogDatabase();
  const parentRow = await db.prepare(`
    WITH variant_stats AS (
      SELECT
        p.id AS product_id,
        COUNT(v.id) AS variant_count,
        COALESCE(SUM(CASE WHEN v.is_available = 1 THEN 1 ELSE 0 END), 0) AS available_variant_count,
        MIN(CASE
          WHEN v.is_available = 1 AND tp.min_quantity = v.moq THEN tp.price
          ELSE NULL
        END) AS starting_price
      FROM products p
      LEFT JOIN product_variants v ON v.product_id = p.id
      LEFT JOIN variant_tier_prices tp ON tp.variant_id = v.id
      WHERE p.slug = ?
      GROUP BY p.id
    )
    SELECT
      p.id,
      p.name,
      p.slug,
      p.sku,
      p.short_description,
      p.description,
      p.image_url,
      c.id AS category_id,
      c.name AS category_name,
      c.slug AS category_slug,
      COALESCE(vs.variant_count, 0) AS variant_count,
      COALESCE(vs.available_variant_count, 0) AS available_variant_count,
      vs.starting_price
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN variant_stats vs ON vs.product_id = p.id
    WHERE p.slug = ? AND p.is_active = 1
    LIMIT 1
  `).bind(cleanSlug, cleanSlug).first<ProductDetailRow>();

  if (!parentRow) return null;

  const variantRows = await db.prepare(`
    SELECT
      id, product_id, name, sku, option_label, unit, moq, quantity_step,
      contact_from_quantity, is_available, sort_order, attribute_id,
      attribute_code, attribute_label, option_id, image_url
    FROM product_variants
    WHERE product_id = ?
    ORDER BY sort_order ASC, id ASC
  `).bind(parentRow.id).all<VariantRow>();

  if (!variantRows.results.length) {
    throw new CatalogDataError(`Sản phẩm ${cleanSlug} chưa có biến thể.`);
  }

  const tierRows = await db.prepare(`
    SELECT tp.variant_id, tp.min_quantity, tp.price, tp.currency
    FROM variant_tier_prices tp
    INNER JOIN product_variants v ON v.id = tp.variant_id
    WHERE v.product_id = ?
    ORDER BY tp.variant_id ASC, tp.min_quantity ASC
  `).bind(parentRow.id).all<TierRow>();

  const tiersByVariant = new Map<number, CatalogTierPrice[]>();
  for (const row of tierRows.results) {
    if (row.currency !== "VND") throw new CatalogDataError(`Variant ${row.variant_id} có tiền tệ không hợp lệ.`);
    const tier = {
      minQuantity: positiveInteger(row.min_quantity, "tier min_quantity"),
      price: positiveInteger(row.price, "tier price"),
    };
    const tiers = tiersByVariant.get(row.variant_id) ?? [];
    tiers.push(tier);
    tiersByVariant.set(row.variant_id, tiers);
  }

  const variants = variantRows.results.map((row) => toVariant(row, tiersByVariant.get(row.id) ?? []));
  const optionGroups = buildOptionGroups(variantRows.results);
  const variantIndex = Object.fromEntries(variantRows.results.map((row) => [
    String(positiveInteger(row.id, "variant id")),
    { [nonEmptyString(row.attribute_code, "attribute code")]: positiveInteger(row.option_id, "option id") },
  ]));

  return {
    ...toParentProduct(parentRow),
    optionGroups,
    variantIndex,
    variants,
  };
});

function getCatalogDatabase(): D1DatabaseLike {
  try {
    const { env } = getCloudflareContext();
    const db = (env as unknown as CloudflareCatalogEnv).GIACONG_VN_CATALOG;
    if (!db) throw new CatalogDataError("Thiếu binding D1 GIACONG_VN_CATALOG.");
    return db;
  } catch (error) {
    if (error instanceof CatalogDataError) throw error;
    throw new CatalogDataError("Không thể truy cập D1 catalog trong runtime hiện tại.");
  }
}

function toCategory(row: CategoryRow): CatalogCategory {
  return {
    id: positiveInteger(row.id, "category id"),
    name: nonEmptyString(row.name, "category name"),
    slug: nonEmptyString(row.slug, "category slug"),
  };
}

function toParentProduct(row: ProductListRow): CatalogProductParent {
  const variantCount = integer(row.variant_count, "variant_count", true);
  const availableVariantCount = integer(row.available_variant_count, "available_variant_count", true);
  if (availableVariantCount > variantCount) throw new CatalogDataError("available_variant_count vượt variant_count.");

  const category = row.category_id === null
    ? null
    : {
        id: positiveInteger(row.category_id, "category id"),
        name: nonEmptyString(row.category_name, "category name"),
        slug: nonEmptyString(row.category_slug, "category slug"),
      };

  const shortDescription = typeof row.short_description === "string" ? row.short_description : "";
  const description = typeof row.description === "string" ? row.description : shortDescription;

  return {
    availableVariantCount,
    category,
    description,
    id: positiveInteger(row.id, "product id"),
    imageUrl: imageUrl(row.image_url),
    name: nonEmptyString(row.name, "product name"),
    shortDescription,
    sku: nonEmptyString(row.sku, "product sku"),
    slug: nonEmptyString(row.slug, "product slug"),
    startingPrice: row.starting_price === null ? null : {
      currency: "VND",
      price: positiveInteger(row.starting_price, "starting_price"),
    },
    type: "configurable",
    variantCount,
  };
}

function toVariant(row: VariantRow, tierPrices: CatalogTierPrice[]): CatalogVariant {
  const minimumOrderQuantity = positiveInteger(row.moq, "variant moq");
  const quantityStep = positiveInteger(row.quantity_step, "variant quantity_step");
  const contactFromQuantity = positiveInteger(row.contact_from_quantity, "variant contact_from_quantity");

  if (contactFromQuantity <= minimumOrderQuantity || (contactFromQuantity - minimumOrderQuantity) % quantityStep !== 0) {
    throw new CatalogDataError(`Variant ${row.sku} có contact_from_quantity không khớp MOQ/bước số lượng.`);
  }
  if (tierPrices.length && tierPrices[0]?.minQuantity !== minimumOrderQuantity) {
    throw new CatalogDataError(`Variant ${row.sku} thiếu giá tại MOQ.`);
  }
  if (tierPrices.some((tier, index) => (
    tier.minQuantity >= contactFromQuantity
    || (tier.minQuantity - minimumOrderQuantity) % quantityStep !== 0
    || (index > 0 && tier.minQuantity <= tierPrices[index - 1].minQuantity)
  ))) {
    throw new CatalogDataError(`Variant ${row.sku} có bảng giá không khớp quy tắc số lượng.`);
  }

  return {
    contactFromQuantity,
    id: positiveInteger(row.id, "variant id"),
    imageUrl: imageUrl(row.image_url),
    isAvailable: booleanInteger(row.is_available, "variant is_available"),
    minimumOrderQuantity,
    name: nonEmptyString(row.name, "variant name"),
    optionValues: [{
      attributeCode: nonEmptyString(row.attribute_code, "attribute code"),
      attributeId: positiveInteger(row.attribute_id, "attribute id"),
      optionId: positiveInteger(row.option_id, "option id"),
      optionLabel: nonEmptyString(row.option_label, "option label"),
    }],
    quantityStep,
    sku: nonEmptyString(row.sku, "variant sku"),
    tierPrices,
    unit: nonEmptyString(row.unit, "variant unit"),
  };
}

function buildOptionGroups(rows: VariantRow[]): CatalogOptionGroup[] {
  const keys = new Set(rows.map((row) => `${row.attribute_id}\u0000${row.attribute_code}\u0000${row.attribute_label}`));
  if (keys.size !== 1) throw new CatalogDataError("Mỗi sản phẩm Lean V1 phải có đúng một nhóm biến thể.");
  const first = rows[0];
  if (!first) throw new CatalogDataError("Sản phẩm chưa có biến thể.");

  const seenOptionIds = new Set<number>();
  const options = rows.map((row) => {
    const id = positiveInteger(row.option_id, "option id");
    if (seenOptionIds.has(id)) throw new CatalogDataError(`Option ${id} bị trùng trong cùng sản phẩm.`);
    seenOptionIds.add(id);
    return {
      id,
      label: nonEmptyString(row.option_label, "option label"),
      variantIds: [positiveInteger(row.id, "variant id")],
    };
  });

  return [{
    attributeId: positiveInteger(first.attribute_id, "attribute id"),
    code: nonEmptyString(first.attribute_code, "attribute code"),
    label: nonEmptyString(first.attribute_label, "attribute label"),
    options,
  }];
}

function productOrderBy(sort: CatalogSort, direction: CatalogSortDirection): string {
  const dir = direction === "desc" ? "DESC" : "ASC";
  switch (sort) {
    case "available_variant_count":
      return `vs.available_variant_count ${dir}, p.id ASC`;
    case "id":
      return `p.id ${dir}`;
    case "name":
      return `p.name COLLATE NOCASE ${dir}, p.id ASC`;
    case "starting_price":
      return `(vs.starting_price IS NULL) ASC, vs.starting_price ${dir}, p.id ASC`;
    case "variant_count":
      return `vs.variant_count ${dir}, p.id ASC`;
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function imageUrl(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new CatalogDataError("image_url phải là chuỗi hoặc null.");
  const result = value.trim();
  if (!result) return null;
  if (result.startsWith("/")) return result;
  let parsed: URL;
  try {
    parsed = new URL(result);
  } catch {
    throw new CatalogDataError("image_url không hợp lệ.");
  }
  if (parsed.protocol !== "https:") throw new CatalogDataError("image_url ngoài hệ thống phải dùng HTTPS.");
  return parsed.toString();
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new CatalogDataError(`${label} không hợp lệ.`);
  return value.trim();
}

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) throw new CatalogDataError(`${label} phải là số nguyên dương.`);
  return value;
}

function integer(value: unknown, label: string, allowZero = false): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < (allowZero ? 0 : 1)) {
    throw new CatalogDataError(`${label} không hợp lệ.`);
  }
  return value;
}

function booleanInteger(value: unknown, label: string): boolean {
  if (value !== 0 && value !== 1) throw new CatalogDataError(`${label} phải là 0 hoặc 1.`);
  return value === 1;
}
