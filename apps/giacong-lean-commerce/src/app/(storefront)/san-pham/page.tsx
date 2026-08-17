import type { Metadata } from "next";

import { CatalogList } from "@/components/catalog/CatalogList";
import { CapturedNewsFrame } from "@/components/CapturedNewsFrame";
import {
  buildCatalogCards,
  demoCatalogCategories,
  demoCatalogList,
} from "@/components/catalog/catalog-listing";
import { getCatalogCategories, getCatalogProducts } from "@/lib/cloudflare-catalog";
import { enrichCatalogProductsWithPrimaryMedia } from "@/lib/catalog-product-media";
import { parseCatalogFilters } from "@/lib/catalog-query";
import { demoCatalogFallbackAllowed, demoCatalogForced, waitForDemoCatalogFallback } from "@/lib/demo-catalog-policy";
import type { CatalogCategory, CatalogFilters, CatalogPagination, CatalogProductParent } from "@/types/catalog";

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
 * Cloudflare D1 is the canonical catalog source. Only an explicitly permitted
 * non-production environment may fall back to the isolated demo fixture.
 * Production never invents prices or product imagery when D1/R2 data is absent.
 */
async function loadCatalog(filters: CatalogFilters): Promise<CatalogPageData> {
  if (demoCatalogForced(process.env)) return demoCatalogData(filters);

  try {
    const [categories, result] = await waitForDemoCatalogFallback(
      Promise.all([getCatalogCategories(), getCatalogProducts(filters)]),
      process.env,
    );
    const products = await enrichMediaFailSoft(result.products);
    return {
      cards: buildCatalogCards(products),
      categories,
      isDemoData: false,
      pagination: result.pagination,
    };
  } catch (error) {
    if (!demoCatalogFallbackAllowed(process.env)) throw error;
    console.warn("D1 catalog unavailable; serving the isolated demo fixture.", error);
    return demoCatalogData(filters);
  }
}

async function enrichMediaFailSoft(products: readonly CatalogProductParent[]): Promise<CatalogProductParent[]> {
  try {
    return await enrichCatalogProductsWithPrimaryMedia(products);
  } catch (error) {
    console.warn("Catalog media unavailable; rendering catalog without media fallbacks.", error);
    return [...products];
  }
}

function demoCatalogData(filters: CatalogFilters): CatalogPageData {
  const demo = demoCatalogList(filters);
  return {
    cards: buildCatalogCards(demo.products, { demoImageFallback: true }),
    categories: demoCatalogCategories(),
    isDemoData: true,
    pagination: demo.pagination,
  };
}
