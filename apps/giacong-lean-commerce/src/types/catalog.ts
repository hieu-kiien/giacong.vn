export interface CatalogCategory {
  id: number;
  name: string;
  slug: string;
}

export interface CatalogTierPrice {
  minQuantity: number;
  price: number;
}

export interface CatalogStartingPrice {
  currency: "VND";
  price: number;
}

export interface CatalogProductParent {
  availableVariantCount: number;
  category: CatalogCategory | null;
  description: string;
  id: number;
  imageUrl: string | null;
  /** Lowest MOQ across active variants; null when the source has no variants. */
  minimumOrderQuantity: number | null;
  name: string;
  shortDescription: string;
  sku: string;
  slug: string;
  /** Null when the D1 product is available for consultation but has no price yet. */
  startingPrice: CatalogStartingPrice | null;
  type: "configurable";
  variantCount: number;
}

export interface CatalogOptionValue {
  attributeCode: string;
  attributeId: number;
  optionId: number;
  optionLabel: string;
}

export interface CatalogVariant {
  contactFromQuantity: number;
  id: number;
  imageUrl: string | null;
  isAvailable: boolean;
  minimumOrderQuantity: number;
  name: string;
  optionValues: CatalogOptionValue[];
  quantityStep: number;
  sku: string;
  tierPrices: CatalogTierPrice[];
  unit: string;
}

export interface CatalogOption {
  id: number;
  label: string;
  variantIds: number[];
}

export interface CatalogOptionGroup {
  attributeId: number;
  code: string;
  label: string;
  options: CatalogOption[];
}

export interface CatalogProductDetail extends CatalogProductParent {
  optionGroups: CatalogOptionGroup[];
  variantIndex: Record<string, Record<string, number>>;
  variants: CatalogVariant[];
}

export interface CatalogPagination {
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
}

export interface CatalogProductList {
  pagination: CatalogPagination;
  products: CatalogProductParent[];
}

/** Sort columns the Cloudflare catalog service exposes, by contract. */
export type CatalogSort = "available_variant_count" | "id" | "name" | "starting_price" | "variant_count";

export type CatalogSortDirection = "asc" | "desc";

/** Page sizes the catalog contract accepts; anything else falls back to the default. */
export type CatalogPageSize = 12 | 24 | 48;

export interface CatalogFilters {
  category: string;
  direction: CatalogSortDirection;
  page: number;
  pageSize: CatalogPageSize;
  query: string;
  sort: CatalogSort;
}
