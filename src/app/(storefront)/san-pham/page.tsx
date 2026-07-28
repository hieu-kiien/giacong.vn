import type { Metadata } from "next";

import { CatalogList } from "@/components/catalog/CatalogList";
import { CapturedNewsFrame } from "@/components/CapturedNewsFrame";
import {
  buildCatalogCards,
  demoCatalogCategories,
  demoCatalogList,
} from "@/components/catalog/catalog-listing";
import { getCatalogCategories, getCatalogProducts } from "@/lib/bagisto-catalog";
import { parseCatalogFilters } from "@/lib/catalog-query";
import { demoCatalogFallbackAllowed, waitForDemoCatalogFallback } from "@/lib/demo-catalog-policy";
import type { CatalogCategory, CatalogFilters, CatalogPagination } from "@/types/catalog";

export const metadata: Metadata = {
  title: "Sản phẩm | Giacong.vn",
  description: "Danh mục sản phẩm và nguyên liệu dành cho đặt hàng doanh nghiệp.",
};

interface CatalogPageData {
  cards: ReturnType<typeof buildCatalogCards>;
  categories: CatalogCategory[];
  isDemoData: boolean;
  pagination: CatalogPagination;
}

export default async function CatalogPage({ searchParams }: PageProps<"/san-pham">) {
  const filters = parseCatalogFilters(await searchParams);
  const data = await loadCatalog(filters);

  return (
    <CapturedNewsFrame activePath="/san-pham" title="Sản phẩm">
      <CatalogList
        cards={data.cards}
        categories={data.categories}
        filters={filters}
        isDemoData={data.isDemoData}
        pagination={data.pagination}
        showPageHeading={false}
      />
    </CapturedNewsFrame>
  );
}

/**
 * The real Bagisto feed is always attempted first. Only when it fails *and* the
 * environment permits it does the isolated demo fixture answer, with the UI
 * saying so — `demoCatalogFallbackAllowed` is off in production, so a live outage shows
 * the error boundary rather than prices nobody can order against.
 *
 * The demo fixture carries variants, so its cards can offer a direct add. Rows
 * from the real list contract carry none, so those cards route to detail instead
 * of inventing a variant key.
 */
async function loadCatalog(filters: CatalogFilters): Promise<CatalogPageData> {
  try {
    const [categories, result] = await waitForDemoCatalogFallback(
      Promise.all([getCatalogCategories(), getCatalogProducts(filters)]),
      process.env,
    );
    return {
      cards: buildCatalogCards(result.products),
      categories,
      isDemoData: false,
      pagination: result.pagination,
    };
  } catch (error) {
    if (!demoCatalogFallbackAllowed(process.env)) throw error;
    console.warn("Catalog feed unavailable; serving the isolated demo fixture.", error);
    const demo = demoCatalogList(filters);
    return {
      cards: buildCatalogCards(demo.products),
      categories: demoCatalogCategories(),
      isDemoData: true,
      pagination: demo.pagination,
    };
  }
}
