import type { Metadata } from "next";

import { CatalogList } from "@/components/catalog/CatalogList";
import { getCatalogCategories, getCatalogProducts } from "@/lib/bagisto-catalog";
import { parseCatalogFilters } from "@/lib/catalog-query";

export const metadata: Metadata = {
  title: "Sản phẩm | Giacong.vn",
  description: "Danh mục sản phẩm và nguyên liệu dành cho đặt hàng doanh nghiệp.",
};

export default async function CatalogPage({ searchParams }: PageProps<"/san-pham">) {
  const filters = parseCatalogFilters(await searchParams);
  const [categories, result] = await Promise.all([getCatalogCategories(), getCatalogProducts(filters)]);
  return <CatalogList categories={categories} filters={filters} result={result} />;
}
