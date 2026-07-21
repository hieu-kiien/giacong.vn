import "server-only";

import { cache } from "react";

import type {
  CatalogCategory,
  CatalogFilters,
  CatalogProduct,
  CatalogProductList,
  CatalogTierPrice,
} from "@/types/catalog";

const DEFAULT_API_ORIGIN = "http://127.0.0.1:8000";

export class CatalogApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "CatalogApiError";
  }
}

export async function getCatalogProducts(filters: CatalogFilters): Promise<CatalogProductList> {
  const url = catalogUrl("/api/b2b/catalog/products");
  if (filters.query) url.searchParams.set("q", filters.query);
  if (filters.category) url.searchParams.set("category", filters.category);
  url.searchParams.set("page", String(filters.page));
  url.searchParams.set("per_page", "12");

  return parseProductList(await fetchCatalog(url));
}

export const getCatalogProduct = cache(async (slug: string): Promise<CatalogProduct | null> => {
  const url = catalogUrl(`/api/b2b/catalog/products/${encodeURIComponent(slug)}`);
  const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
  if (response.status === 404) return null;
  return parseProduct(await responseBody(response));
});

export const getCatalogCategories = cache(async (): Promise<CatalogCategory[]> => {
  const url = catalogUrl("/api/b2b/catalog/categories");
  const payload = await fetchCatalog(url);
  const data = objectValue(payload).data;
  const values = Array.isArray(data) ? data : Array.isArray(payload) ? payload : [];

  return values.map(parseCategory).filter((category): category is CatalogCategory => category !== null);
});

async function fetchCatalog(url: URL): Promise<unknown> {
  const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
  return responseBody(response);
}

async function responseBody(response: Response): Promise<unknown> {
  if (!response.ok) throw new CatalogApiError("Không thể tải dữ liệu danh mục.", response.status);
  return response.json() as Promise<unknown>;
}

function catalogUrl(pathname: string): URL {
  const configuredOrigin = process.env.BAGISTO_API_URL?.trim() || DEFAULT_API_ORIGIN;
  try {
    return new URL(pathname, withTrailingSlash(configuredOrigin));
  } catch {
    throw new CatalogApiError("BAGISTO_API_URL không hợp lệ.");
  }
}

function withTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function parseProductList(payload: unknown): CatalogProductList {
  const root = objectValue(payload);
  const productValues = Array.isArray(root.data) ? root.data : Array.isArray(payload) ? payload : [];
  const paginationValue = objectValue(root.meta ?? root.pagination);
  const products = productValues.map(parseProduct).filter((product): product is CatalogProduct => product !== null);

  return {
    products,
    pagination: {
      currentPage: positiveNumber(paginationValue.current_page ?? paginationValue.currentPage, 1),
      lastPage: positiveNumber(paginationValue.last_page ?? paginationValue.lastPage, 1),
      perPage: positiveNumber(paginationValue.per_page ?? paginationValue.perPage, products.length || 1),
      total: nonNegativeNumber(paginationValue.total, products.length),
    },
  };
}

function parseProduct(payload: unknown): CatalogProduct | null {
  const value = objectValue(payload);
  const source = objectValue(value.data ?? value.product ?? payload);
  const id = positiveNumber(source.id, 0);
  const name = stringValue(source.name);
  const slug = stringValue(source.slug);
  if (!id || !name || !slug) return null;

  const categoryValues = source.categories;
  const categories = Array.isArray(categoryValues)
    ? categoryValues.map(parseCategory).filter((item): item is CatalogCategory => item !== null)
    : [];
  const tierValues = source.tier_prices ?? source.tierPrices;
  const tiers = Array.isArray(tierValues)
    ? tierValues.map(parseTier).filter((tier): tier is CatalogTierPrice => tier !== null)
    : [];

  return {
    id,
    name,
    slug,
    shortDescription: stringValue(source.short_description ?? source.shortDescription ?? source.description),
    description: stringValue(source.description),
    imageUrl: imageUrl(source.image_url ?? source.imageUrl ?? source.image),
    minimumOrderQuantity: positiveNumber(source.minimum_order_quantity ?? source.minimumOrderQuantity ?? source.moq, 1),
    quantityStep: positiveNumber(source.quantity_step ?? source.quantityStep, 1),
    unit: stringValue(source.unit) || "sản phẩm",
    price: tiers[0]?.price ?? nonNegativeNumber(source.price ?? source.final_price ?? source.finalPrice, 0),
    tierPrices: tiers,
    category: categories[0] ?? null,
  };
}

function parseCategory(payload: unknown): CatalogCategory | null {
  const value = objectValue(payload);
  const id = positiveNumber(value.id, 0);
  const name = stringValue(value.name);
  const slug = stringValue(value.slug);
  return id && name && slug ? { id, name, slug } : null;
}

function parseTier(payload: unknown): CatalogTierPrice | null {
  const value = objectValue(payload);
  const minQuantity = positiveNumber(value.min_quantity ?? value.minQuantity ?? value.qty, 0);
  const price = nonNegativeNumber(value.price ?? value.unit_price ?? value.unitPrice, -1);
  return minQuantity && price >= 0 ? { minQuantity, price } : null;
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function imageUrl(value: unknown): string | null {
  const string = typeof value === "object" && value !== null
    ? stringValue(objectValue(value).url)
    : stringValue(value);
  if (!string) return null;

  try {
    const url = new URL(string, catalogUrl("/"));
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function positiveNumber(value: unknown, fallback: number): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function nonNegativeNumber(value: unknown, fallback: number): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}
