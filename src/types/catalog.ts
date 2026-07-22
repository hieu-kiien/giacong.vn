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
  name: string;
  shortDescription: string;
  sku: string;
  slug: string;
  startingPrice: CatalogStartingPrice;
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

export interface CatalogFilters {
  category: string;
  page: number;
  query: string;
}
