import type { AdminCategory, AdminProductInput, D1DatabaseLike } from "./admin-data";
import { parseAdminProductPayload } from "./admin-product-input.ts";
import { MAX_ADMIN_PRODUCT_IMPORT_ROWS } from "./admin-product-import-csv.ts";
import type { AdminProductImportRow } from "./admin-product-import-csv.ts";

export {
  ADMIN_PRODUCT_IMPORT_AUDIT_BIND_COUNT,
  ADMIN_PRODUCT_IMPORT_BATCH_STATEMENTS,
  ADMIN_PRODUCT_IMPORT_CHUNK_ROWS,
  ADMIN_PRODUCT_IMPORT_HEADERS,
  ADMIN_PRODUCT_IMPORT_REQUIRED_HEADERS,
  ADMIN_PRODUCT_IMPORT_MARKER_BIND_COUNT,
  ADMIN_PRODUCT_IMPORT_META_BIND_COUNT,
  ADMIN_PRODUCT_IMPORT_PRODUCT_BIND_COUNT,
  MAX_ADMIN_PRODUCT_IMPORT_BYTES,
  MAX_ADMIN_PRODUCT_IMPORT_BIND_VARIABLES,
  MAX_ADMIN_PRODUCT_IMPORT_ROWS,
  getAdminProductImportBindCounts,
  parseProductImportCsv,
  type AdminProductImportBindCounts,
  type AdminProductImportHeader,
  type AdminProductImportRow,
  type ProductImportCsvResult,
} from "./admin-product-import-csv.ts";

export interface AdminProductImportEntry {
  input: AdminProductInput;
  rowNumber: number;
}

export interface AdminProductImportError {
  field: string;
  message: string;
  row: number;
}

export function prepareAdminProductImportRows(
  rows: readonly unknown[],
  categories: readonly AdminCategory[],
): { entries: AdminProductImportEntry[]; errors: AdminProductImportError[] } {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { entries: [], errors: [{ field: "rows", message: "File chưa có sản phẩm nào.", row: 0 }] };
  }
  if (rows.length > MAX_ADMIN_PRODUCT_IMPORT_ROWS) {
    return {
      entries: [],
      errors: [{ field: "rows", message: `File vượt quá ${MAX_ADMIN_PRODUCT_IMPORT_ROWS} sản phẩm mỗi lần nhập.`, row: 0 }],
    };
  }

  const categoryBySlug = new Map(categories.map((category) => [category.slug.trim().toLowerCase(), category]));
  const entries: AdminProductImportEntry[] = [];
  const errors: AdminProductImportError[] = [];
  const seenSlugs = new Map<string, number>();
  const seenSkus = new Map<string, number>();

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    if (!isImportRow(row)) {
      errors.push({ field: "row", message: "Dòng không đúng định dạng.", row: rowNumber });
      continue;
    }

    const categorySlug = row.categorySlug.trim().toLowerCase();
    const category = categorySlug ? categoryBySlug.get(categorySlug) : undefined;
    if (categorySlug && !category) {
      errors.push({ field: "category_slug", message: `Không tìm thấy danh mục “${categorySlug}”.`, row: rowNumber });
    }

    const parsed = parseAdminProductPayload({
      categoryId: category?.id ?? null,
      description: row.description,
      imageUrl: row.imageUrl || null,
      isActive: false,
      leadTimeDays: row.leadTimeDays || null,
      name: row.name,
      shortDescription: row.shortDescription,
      sku: row.sku,
      slug: row.slug,
      status: "draft",
    });

    for (const [field, message] of Object.entries(parsed.fieldErrors)) {
      errors.push({ field: importFieldName(field), message, row: rowNumber });
    }

    const normalizedSlug = row.slug.trim().toLowerCase();
    const normalizedSku = row.sku.trim().toLowerCase();
    if (normalizedSlug && seenSlugs.has(normalizedSlug)) {
      errors.push({ field: "slug", message: `Trùng slug với dòng ${seenSlugs.get(normalizedSlug)}.`, row: rowNumber });
    } else if (normalizedSlug) {
      seenSlugs.set(normalizedSlug, rowNumber);
    }
    if (normalizedSku && seenSkus.has(normalizedSku)) {
      errors.push({ field: "sku", message: `Trùng SKU với dòng ${seenSkus.get(normalizedSku)}.`, row: rowNumber });
    } else if (normalizedSku) {
      seenSkus.set(normalizedSku, rowNumber);
    }

    if (parsed.input && (!categorySlug || category)) entries.push({ input: parsed.input, rowNumber });
  }

  return { entries, errors: sortImportErrors(errors) };
}

export async function findAdminProductImportConflicts(
  database: D1DatabaseLike,
  entries: readonly AdminProductImportEntry[],
): Promise<AdminProductImportError[]> {
  if (entries.length === 0) return [];
  const slugs = unique(entries.map((entry) => entry.input.slug.toLowerCase()));
  const skus = unique(entries.map((entry) => entry.input.sku.toLowerCase()));
  const slugPlaceholders = slugs.map(() => "?").join(", ");
  const skuPlaceholders = skus.map(() => "?").join(", ");
  const result = await database.prepare(`
    SELECT slug, sku
    FROM products
    WHERE lower(slug) IN (${slugPlaceholders})
       OR lower(sku) IN (${skuPlaceholders})
  `).bind(...slugs, ...skus).all<{ slug: string; sku: string }>();
  const existingSlugs = new Set(result.results.map((row) => row.slug.toLowerCase()));
  const existingSkus = new Set(result.results.map((row) => row.sku.toLowerCase()));

  return sortImportErrors(entries.flatMap((entry) => {
    const errors: AdminProductImportError[] = [];
    if (existingSlugs.has(entry.input.slug.toLowerCase())) {
      errors.push({ field: "slug", message: "Slug đã tồn tại trong catalog.", row: entry.rowNumber });
    }
    if (existingSkus.has(entry.input.sku.toLowerCase())) {
      errors.push({ field: "sku", message: "SKU đã tồn tại trong catalog.", row: entry.rowNumber });
    }
    return errors;
  }));
}

export function importErrorsToFieldErrors(errors: readonly AdminProductImportError[]): Record<string, string> {
  return Object.fromEntries(errors.map((error) => [
    error.row > 0 ? `row_${error.row}_${error.field}` : error.field,
    error.message,
  ]));
}

export function canonicalizeAdminProductImport(entries: readonly AdminProductImportEntry[]): string {
  return JSON.stringify(entries.map(({ input, rowNumber }) => ({
    row: rowNumber,
    categoryId: input.categoryId,
    description: input.description,
    imageUrl: input.imageUrl,
    isActive: false,
    leadTimeDays: input.leadTimeDays,
    name: input.name,
    shortDescription: input.shortDescription,
    sku: input.sku,
    slug: input.slug,
    status: "draft",
  })));
}

export async function fingerprintAdminProductImport(entries: readonly AdminProductImportEntry[]): Promise<string> {
  return fingerprintCanonicalValue(canonicalizeAdminProductImport(entries));
}

export async function fingerprintAdminProductImportRows(rows: readonly unknown[]): Promise<string> {
  return fingerprintCanonicalValue(canonicalizeJsonValue(rows));
}

async function fingerprintCanonicalValue(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function canonicalizeJsonValue(value: unknown): string {
  return JSON.stringify(value, (_key, nested) => {
    if (typeof nested !== "object" || nested === null || Array.isArray(nested)) return nested;
    return Object.fromEntries(Object.entries(nested).sort(([left], [right]) => left.localeCompare(right)));
  });
}

function importFieldName(field: string): string {
  return {
    categoryId: "category_slug",
    description: "description",
    imageUrl: "image_url",
    leadTimeDays: "lead_time_days",
    name: "name",
    shortDescription: "short_description",
    sku: "sku",
    slug: "slug",
    status: "status",
  }[field] ?? field;
}

function isImportRow(value: unknown): value is AdminProductImportRow {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return [
    "categorySlug",
    "description",
    "imageUrl",
    "leadTimeDays",
    "name",
    "shortDescription",
    "sku",
    "slug",
  ].every((key) => typeof row[key] === "string");
}

function sortImportErrors(errors: AdminProductImportError[]): AdminProductImportError[] {
  return errors.sort((left, right) => left.row - right.row || left.field.localeCompare(right.field));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
