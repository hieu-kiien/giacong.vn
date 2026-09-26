import type { Metadata } from "next";

import { CatalogList } from "@/components/catalog/CatalogList";
import { CapturedNewsFrame } from "@/components/CapturedNewsFrame";
import {
  buildCatalogCards,
  demoCatalogCategories,
  demoCatalogList,
} from "@/components/catalog/catalog-listing";
import { getCatalogCategories, getCatalogProducts } from "@/lib/cloudflare-catalog";
import { parseCatalogFilters } from "@/lib/catalog-query";
import { demoCatalogFallbackAllowed, demoCatalogForced, waitForDemoCatalogFallback } from "@/lib/demo-catalog-policy";
import { canonicalMetadata } from "@/lib/seo";
import { getPublishedSiteSettings } from "@/lib/site-settings";
import type { CatalogCategory, CatalogFilters, CatalogPagination } from "@/types/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublishedSiteSettings();
  return {
    ...canonicalMetadata("/san-pham/"),
    title: `Sản phẩm | ${settings.brand_name}`,
    description: "Danh mục sản phẩm và nguyên liệu dành cho đặt hàng doanh nghiệp.",
    icons: settings.favicon_url ? { icon: settings.favicon_url } : undefined,
  };
}

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
 * Production never invents prices when D1 is unavailable.
 */
async function loadCatalog(filters: CatalogFilters): Promise<CatalogPageData> {
  if (demoCatalogForced(process.env)) return demoCatalogData(filters);

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
    console.warn("D1 catalog unavailable; serving the isolated demo fixture.", error);
    return demoCatalogData(filters);
  }
}

function demoCatalogData(filters: CatalogFilters): CatalogPageData {
  const demo = demoCatalogList(filters);
  return {
    cards: buildCatalogCards(demo.products, true),
    categories: demoCatalogCategories(),
    isDemoData: true,
    pagination: demo.pagination,
  };
}
