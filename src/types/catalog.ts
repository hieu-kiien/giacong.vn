export interface CatalogCategory {
  id: number;
  name: string;
  slug: string;
}

export interface CatalogTierPrice {
  minQuantity: number;
  price: number;
}

export interface CatalogProduct {
  id: number;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  imageUrl: string | null;
  minimumOrderQuantity: number;
  quantityStep: number;
  unit: string;
  price: number;
  tierPrices: CatalogTierPrice[];
  category: CatalogCategory | null;
}

export interface CatalogPagination {
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
}

export interface CatalogProductList {
  products: CatalogProduct[];
  pagination: CatalogPagination;
}

export interface CatalogFilters {
  query: string;
  category: string;
  page: number;
}
