"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useRef, useTransition } from "react";

import { CatalogFilterDrawer } from "@/components/catalog/CatalogFilterDrawer";
import { CatalogFilterPanel } from "@/components/catalog/CatalogFilterPanel";
import { CatalogProductCard } from "@/components/catalog/CatalogProductCard";
import {
  catalogHref,
  DEFAULT_CATALOG_PAGE_SIZE,
  DEFAULT_CATALOG_SORT,
  DEFAULT_CATALOG_SORT_DIRECTION,
} from "@/lib/catalog-query";
import type { CatalogCategory, CatalogFilters, CatalogProductList } from "@/types/catalog";

interface CatalogListProps {
  categories: CatalogCategory[];
  filters: CatalogFilters;
  result: CatalogProductList;
}

export function CatalogList({ categories, filters, result }: CatalogListProps) {
  const router = useRouter();
  const queryInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const pages = paginationPages(result.pagination.currentPage, result.pagination.lastPage);
  const committedFilterKey = JSON.stringify([
    filters.query,
    filters.category,
    filters.page,
    result.pagination.perPage,
  ]);
  const activeFilterCount = [
    Boolean(filters.category),
    filters.sort !== DEFAULT_CATALOG_SORT || filters.direction !== DEFAULT_CATALOG_SORT_DIRECTION,
    filters.pageSize !== DEFAULT_CATALOG_PAGE_SIZE,
  ].filter(Boolean).length;

  const currentQueryDraft = () => (queryInputRef.current?.value ?? filters.query).trim().slice(0, 100);
  /**
   * Every control commits through here so one code path owns the URL, the
   * upstream request and the cache key. The uncommitted search draft rides along
   * with any other filter change; `overrides` wins so "Xóa bộ lọc" can clear it.
   */
  const updateFilters = (overrides: Partial<CatalogFilters>) => {
    const next: CatalogFilters = { ...filters, query: currentQueryDraft(), ...overrides, page: 1 };
    startTransition(() => router.push(catalogHref(next), { scroll: false }));
  };
  const clearFilters = () => updateFilters({
    category: "",
    direction: DEFAULT_CATALOG_SORT_DIRECTION,
    pageSize: DEFAULT_CATALOG_PAGE_SIZE,
    query: "",
    sort: DEFAULT_CATALOG_SORT,
  });
  const filterPanel = (
    <CatalogFilterPanel
      categories={categories}
      filters={filters}
      isPending={isPending}
      onClear={clearFilters}
      onUpdate={updateFilters}
    />
  );

  return (
    <main className="bg-white text-ink" id="catalog-main">
      <div className="mx-auto w-full max-w-[1280px] px-4 py-6 md:px-5 lg:px-6 lg:py-8">
        <nav aria-label="Breadcrumb" className="mb-3 text-[13px] text-ink-soft">
          <Link className="underline-offset-3 hover:text-brand-800" href="/">Trang chủ</Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">Sản phẩm</span>
        </nav>

        <header className="max-w-[720px]">
          <h1 className="text-[28px] leading-tight font-bold tracking-tight text-brand-800 lg:text-[36px]">
            Danh sách sản phẩm
          </h1>
          <p className="mt-2 leading-relaxed text-ink-soft">
            Xem các dòng sản phẩm đang có trong danh mục B2B, rồi chọn phiên bản phù hợp ở trang chi tiết.
          </p>
        </header>

        <form
          className="mt-6"
          onSubmit={(event) => {
            event.preventDefault();
            updateFilters({ query: String(new FormData(event.currentTarget).get("q") ?? "").trim() });
          }}
        >
          <label className="grid max-w-[560px] gap-2 text-sm font-bold text-brand-800" htmlFor="catalog-query">
            Tìm sản phẩm
            <span className="relative flex items-center">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 size-4 text-ink-muted" />
              <input
                aria-busy={isPending}
                aria-describedby="catalog-result-status"
                className="min-h-11 w-full rounded-md border border-hairline-strong bg-white pr-3 pl-9 text-sm font-normal text-ink placeholder:text-ink-muted focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
                defaultValue={filters.query}
                id="catalog-query"
                key={committedFilterKey}
                maxLength={100}
                name="q"
                placeholder="Tên sản phẩm hoặc dòng sản phẩm"
                readOnly={isPending}
                ref={queryInputRef}
                type="search"
              />
            </span>
          </label>
        </form>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4">
          <p aria-live="polite" className="text-sm font-bold text-brand-800" id="catalog-result-status">
            {isPending ? "Đang cập nhật danh mục..." : `${result.pagination.total} dòng sản phẩm`}
          </p>
          <CatalogFilterDrawer activeFilterCount={activeFilterCount}>{filterPanel}</CatalogFilterDrawer>
        </div>

        <div className="mt-6 grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside aria-label="Bộ lọc sản phẩm" className="max-lg:hidden">{filterPanel}</aside>
          <div className="min-w-0">
            {result.products.length ? (
              <div
                aria-busy={isPending}
                className={`grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${isPending ? "opacity-60" : ""}`}
                data-catalog-grid
              >
                {result.products.map((product) => <CatalogProductCard key={product.id} product={product} />)}
              </div>
            ) : (
              <div className="rounded-lg border border-hairline bg-surface-tinted p-6" role="status">
                <h2 className="text-xl font-bold text-brand-800">Chưa tìm thấy sản phẩm phù hợp.</h2>
                <p className="mt-2 text-ink-soft">Thử một từ khóa khác hoặc xem lại toàn bộ danh mục.</p>
                <button
                  className="mt-4 min-h-11 rounded-md bg-brand-700 px-5 text-sm font-bold text-white hover:bg-brand-800 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  onClick={clearFilters}
                  type="button"
                >
                  Xem toàn bộ sản phẩm
                </button>
              </div>
            )}

            {result.pagination.lastPage > 1 ? (
              <nav aria-label="Phân trang" className="mt-7 flex flex-wrap gap-2">
                {pages.map((page) => (
                  <Link
                    aria-current={page === result.pagination.currentPage ? "page" : undefined}
                    className={`flex min-h-11 min-w-11 items-center justify-center rounded-md border px-3 text-sm font-semibold ${
                      page === result.pagination.currentPage
                        ? "border-brand-700 bg-brand-700 text-white"
                        : "border-hairline-strong text-ink hover:border-brand-700 hover:text-brand-800"
                    } focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus`}
                    href={catalogHref({ ...filters, page })}
                    key={page}
                    prefetch={false}
                  >
                    {page}
                  </Link>
                ))}
              </nav>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}

function paginationPages(current: number, last: number): number[] {
  const start = Math.max(1, Math.min(current - 2, last - 4));
  const end = Math.min(last, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}
