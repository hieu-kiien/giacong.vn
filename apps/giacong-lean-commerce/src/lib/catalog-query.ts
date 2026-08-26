import type {
  CatalogFilters,
  CatalogPageSize,
  CatalogSort,
  CatalogSortDirection,
} from "@/types/catalog";

type SearchParameter = string | string[] | undefined;

/**
 * Sort columns the Cloudflare D1 catalog service maps to a physical column. Keeping the
 * allowlist here means an unsupported value degrades to the default instead of
 * reaching the upstream API, so a query parameter can never select a column.
 */
export const CATALOG_SORTS: readonly CatalogSort[] = [
  "available_variant_count",
  "id",
  "name",
  "starting_price",
  "variant_count",
];

export const CATALOG_SORT_DIRECTIONS: readonly CatalogSortDirection[] = ["asc", "desc"];

/** Page sizes the catalog contract accepts, all inside the D1 read-model limit. */
export const CATALOG_PAGE_SIZES: readonly CatalogPageSize[] = [12, 24, 48];

export const DEFAULT_CATALOG_SORT: CatalogSort = "name";
export const DEFAULT_CATALOG_SORT_DIRECTION: CatalogSortDirection = "asc";
export const DEFAULT_CATALOG_PAGE_SIZE: CatalogPageSize = 12;

/**
 * Upper bound on the page number. The catalog is paginated upstream, so an
 * unbounded page number only ever adds cache entries for pages that cannot hold
 * data; clamping keeps the validated cache key space finite.
 */
export const MAX_CATALOG_PAGE = 1_000;

/**
 * Normalises untrusted search parameters into the canonical catalog contract.
 * Every field that changes the upstream query is derived here so the same value
 * feeds the request, the cache key and the URL.
 */
export function parseCatalogFilters(searchParams: Record<string, SearchParameter>): CatalogFilters {
  return {
    category: firstValue(searchParams.category).trim().slice(0, 120),
    direction: allowed(firstValue(searchParams.direction), CATALOG_SORT_DIRECTIONS, DEFAULT_CATALOG_SORT_DIRECTION),
    page: parsePage(firstValue(searchParams.page)),
    pageSize: parsePageSize(firstValue(searchParams.per_page)),
    query: firstValue(searchParams.q).trim().slice(0, 100),
    sort: allowed(firstValue(searchParams.sort), CATALOG_SORTS, DEFAULT_CATALOG_SORT),
  };
}

export function catalogHref(filters: Partial<CatalogFilters>): string {
  const parameters = new URLSearchParams();
  if (filters.query) parameters.set("q", filters.query);
  if (filters.category) parameters.set("category", filters.category);
  if (filters.sort && filters.sort !== DEFAULT_CATALOG_SORT) parameters.set("sort", filters.sort);
  if (filters.direction && filters.direction !== DEFAULT_CATALOG_SORT_DIRECTION) {
    parameters.set("direction", filters.direction);
  }
  if (filters.pageSize && filters.pageSize !== DEFAULT_CATALOG_PAGE_SIZE) {
    parameters.set("per_page", String(filters.pageSize));
  }
  if (filters.page && filters.page > 1) parameters.set("page", String(filters.page));
  const query = parameters.toString();

  return query ? `/san-pham/?${query}` : "/san-pham/";
}

function parsePage(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || !/^\d+$/.test(value.trim())) return 1;
  return Math.min(parsed, MAX_CATALOG_PAGE);
}

function parsePageSize(value: string): CatalogPageSize {
  const parsed = Number.parseInt(value, 10);
  return CATALOG_PAGE_SIZES.find((size) => size === parsed) ?? DEFAULT_CATALOG_PAGE_SIZE;
}

function allowed<T extends string>(value: string, values: readonly T[], fallback: T): T {
  return values.find((candidate) => candidate === value) ?? fallback;
}

function firstValue(value: SearchParameter): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
