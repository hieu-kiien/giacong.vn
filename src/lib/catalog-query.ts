import type { CatalogFilters } from "@/types/catalog";

type SearchParameter = string | string[] | undefined;

export function parseCatalogFilters(searchParams: Record<string, SearchParameter>): CatalogFilters {
  const query = firstValue(searchParams.q).trim().slice(0, 100);
  const category = firstValue(searchParams.category).trim().slice(0, 120);
  const parsedPage = Number.parseInt(firstValue(searchParams.page), 10);

  return {
    query,
    category,
    page: Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  };
}

export function catalogHref(filters: Partial<CatalogFilters>): string {
  const parameters = new URLSearchParams();
  if (filters.query) parameters.set("q", filters.query);
  if (filters.category) parameters.set("category", filters.category);
  if (filters.page && filters.page > 1) parameters.set("page", String(filters.page));
  const query = parameters.toString();

  return query ? `/san-pham/?${query}` : "/san-pham/";
}

function firstValue(value: SearchParameter): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
