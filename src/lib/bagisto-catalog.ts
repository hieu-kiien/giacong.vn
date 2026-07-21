import "server-only";

import { cache } from "react";

import { fetchBagistoJson, getBagistoApiUrl } from "@/lib/bagisto-api";
import type {
  CatalogCategory,
  CatalogFilters,
  CatalogProduct,
  CatalogProductList,
  CatalogTierPrice,
} from "@/types/catalog";

export class CatalogApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "CatalogApiError";
  }
}

export async function getCatalogProducts(filters: CatalogFilters): Promise<CatalogProductList> {
  const url = getBagistoApiUrl("/api/b2b/catalog/products", true);
  if (filters.query) url.searchParams.set("q", filters.query);
  if (filters.category) url.searchParams.set("category", filters.category);
  url.searchParams.set("page", String(filters.page));
  url.searchParams.set("per_page", "12");
  return parseProductList(await fetchJson(url));
}

export const getCatalogProduct = cache(async (slug: string): Promise<CatalogProduct | null> => {
  const url = getBagistoApiUrl(`/api/b2b/catalog/products/${encodeURIComponent(slug)}`, true);
  const { payload, response } = await catalogJson(url);
  if (response.status === 404) return null;
  return parseProductResponse(responsePayload(response, payload));
});

export const getCatalogCategories = cache(async (): Promise<CatalogCategory[]> => {
  const root = record(await fetchJson(getBagistoApiUrl("/api/b2b/catalog/categories", true)), "Danh mục");
  const data = array(root.data, "Danh mục.data");
  const meta = record(root.meta, "Danh mục.meta");
  string(meta.channel, "Danh mục.meta.channel");
  string(meta.locale, "Danh mục.meta.locale");
  return data.map((item, index) => parseCategory(item, `Danh mục.data[${index}]`));
});

async function fetchJson(url: URL): Promise<unknown> {
  const { payload, response } = await catalogJson(url);
  return responsePayload(response, payload);
}

async function catalogJson(url: URL) {
  try {
    return await fetchBagistoJson(url, { headers: { Accept: "application/json" } });
  } catch (error) {
    if (error instanceof SyntaxError) throw new CatalogApiError("Dịch vụ danh mục trả về JSON không hợp lệ.");
    throw error;
  }
}

function responsePayload(response: Response, payload: unknown): unknown {
  if (!response.ok) throw new CatalogApiError("Không thể tải dữ liệu danh mục.", response.status);
  return payload;
}

function parseProductList(payload: unknown): CatalogProductList {
  const root = record(payload, "Sản phẩm");
  const data = array(root.data, "Sản phẩm.data");
  const meta = record(root.meta, "Sản phẩm.meta");
  validateCatalogMeta(meta, "Sản phẩm.meta");
  const products = data.map((item, index) => parseProduct(item, `Sản phẩm.data[${index}]`));
  return {
    products,
    pagination: {
      currentPage: positiveInteger(meta.current_page, "Sản phẩm.meta.current_page"),
      lastPage: positiveInteger(meta.last_page, "Sản phẩm.meta.last_page"),
      perPage: positiveInteger(meta.per_page, "Sản phẩm.meta.per_page"),
      total: nonNegativeInteger(meta.total, "Sản phẩm.meta.total"),
    },
  };
}

function parseProductResponse(payload: unknown): CatalogProduct {
  const root = record(payload, "Sản phẩm");
  const meta = record(root.meta, "Sản phẩm.meta");
  validateCatalogMeta(meta, "Sản phẩm.meta");
  return parseProduct(root.data, "Sản phẩm.data");
}

function validateCatalogMeta(meta: Record<string, unknown>, label: string) {
  nonEmptyString(meta.channel, `${label}.channel`);
  nonEmptyString(meta.locale, `${label}.locale`);
  if (string(meta.currency, `${label}.currency`) !== "VND") throw invalid(`${label}.currency phải là VND.`);
}

function parseProduct(payload: unknown, label: string): CatalogProduct {
  const value = record(payload, label);
  positiveInteger(value.id, `${label}.id`);
  string(value.sku, `${label}.sku`);
  const categories = array(value.categories, `${label}.categories`)
    .map((item, index) => parseCategory(item, `${label}.categories[${index}]`));
  const tiers = array(value.tier_prices, `${label}.tier_prices`)
    .map((item, index) => parseTier(item, `${label}.tier_prices[${index}]`));
  return {
    id: positiveInteger(value.id, `${label}.id`),
    name: nonEmptyString(value.name, `${label}.name`),
    slug: nonEmptyString(value.slug, `${label}.slug`),
    shortDescription: nullableString(value.description, `${label}.description`) ?? "",
    description: nullableString(value.description, `${label}.description`) ?? "",
    imageUrl: parseImage(value.image, `${label}.image`),
    minimumOrderQuantity: positiveInteger(value.moq, `${label}.moq`),
    quantityStep: positiveInteger(value.quantity_step, `${label}.quantity_step`),
    unit: nonEmptyString(value.unit, `${label}.unit`),
    price: tiers[0]?.price ?? 0,
    tierPrices: tiers,
    category: categories[0] ?? null,
  };
}

function parseCategory(payload: unknown, label: string): CatalogCategory {
  const value = record(payload, label);
  positiveInteger(value.id, `${label}.id`);
  nullableInteger(value.parent_id, `${label}.parent_id`);
  nullableString(value.description, `${label}.description`);
  parseImage(value.image, `${label}.image`);
  return {
    id: positiveInteger(value.id, `${label}.id`),
    name: nonEmptyString(value.name, `${label}.name`),
    slug: nonEmptyString(value.slug, `${label}.slug`),
  };
}

function parseTier(payload: unknown, label: string): CatalogTierPrice {
  const value = record(payload, label);
  if (string(value.currency, `${label}.currency`) !== "VND") throw invalid(`${label}.currency phải là VND.`);
  return {
    minQuantity: positiveInteger(value.min_quantity, `${label}.min_quantity`),
    price: nonNegativeInteger(value.unit_price, `${label}.unit_price`),
  };
}

function parseImage(value: unknown, label: string): string | null {
  if (value === null) return null;
  const image = record(value, label);
  const keys = Object.keys(image).sort();
  if (keys.length !== 2 || keys[0] !== "alt" || keys[1] !== "url") throw invalid(`${label} không đúng định dạng.`);
  const url = nonEmptyString(image.url, `${label}.url`);
  nullableString(image.alt, `${label}.alt`);
  let parsed: URL;
  try {
    parsed = new URL(url, getBagistoApiUrl("/", true));
  } catch {
    throw invalid(`${label}.url không hợp lệ.`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw invalid(`${label}.url không hợp lệ.`);
  return parsed.toString();
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw invalid(`${label} phải là object.`);
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw invalid(`${label} phải là mảng.`);
  return value;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string") throw invalid(`${label} phải là chuỗi.`);
  return value;
}

function nonEmptyString(value: unknown, label: string): string {
  const result = string(value, label).trim();
  if (!result) throw invalid(`${label} không được rỗng.`);
  return result;
}

function nullableString(value: unknown, label: string): string | null {
  return value === null ? null : string(value, label);
}

function positiveInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) throw invalid(`${label} phải là số nguyên dương.`);
  return value;
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) throw invalid(`${label} phải là số nguyên không âm.`);
  return value;
}

function nullableInteger(value: unknown, label: string): number | null {
  return value === null ? null : positiveInteger(value, label);
}

function invalid(message: string): CatalogApiError {
  return new CatalogApiError(`Dữ liệu danh mục không hợp lệ: ${message}`);
}
