"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Grid2X2, List, Search } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { CatalogProductCard } from "@/components/catalog/CatalogProductCard";
import { AdminProductCreateContextualAction } from "@/components/admin/AdminProductCreateContextualAction";
import { DEMO_CATALOG_NOTICE, type CatalogCardView } from "@/components/catalog/catalog-listing";
import { CommerceRail } from "@/components/commerce/CommerceRail";
import { COMMERCE_TYPOGRAPHY } from "@/components/commerce/typography";
import { catalogHref, DEFAULT_CATALOG_PAGE_SIZE, DEFAULT_CATALOG_SORT, DEFAULT_CATALOG_SORT_DIRECTION } from "@/lib/catalog-query";
import type {
  CatalogCategory,
  CatalogFilters,
  CatalogPagination,
  CatalogSort,
  CatalogSortDirection,
} from "@/types/catalog";

interface CatalogListProps {
  cards: CatalogCardView[];
  categories: CatalogCategory[];
  filters: CatalogFilters;
  /** True when the demo fixture answered because the catalog feed was unreachable. */
  isDemoData?: boolean;
  pagination: CatalogPagination;
  /** The captured green title strip owns this on the catalog route. */
  showPageHeading?: boolean;
}

/**
 * The archive's `select.orderby`, mapped onto the sort columns the catalog contract
 * actually allows (`CATALOG_SORTS` in `@/lib/catalog-query`).
 *
 * Two departures from the captured control. Its sixth option orders by a score the
 * current plan forbids this project to carry in any form, so it is dropped rather than
 * mapped onto something else. And its `popularity` has no
 * upstream column here, so the nearest honest thing the feed can order by is how many
 * quy cách a product has — labelled as that rather than as popularity, which would
 * claim a signal this data does not carry.
 */
const CATALOG_ORDERINGS = [
  { direction: "asc", label: "Sắp xếp mặc định", sort: "name", value: "name:asc" },
  {
    direction: "desc",
    label: "Nhiều quy cách nhất",
    sort: "available_variant_count",
    value: "available_variant_count:desc",
  },
  { direction: "desc", label: "Mới nhất", sort: "id", value: "id:desc" },
  { direction: "asc", label: "Giá thấp đến cao", sort: "starting_price", value: "starting_price:asc" },
  { direction: "desc", label: "Giá cao đến thấp", sort: "starting_price", value: "starting_price:desc" },
] as const satisfies readonly {
  direction: CatalogSortDirection;
  label: string;
  sort: CatalogSort;
  value: string;
}[];

/**
 * `/san-pham`, in the shape of the shop archive giacong.vn serves — read from
 * `src/data/pages/san-pham.json`, which is the page this route mirrors.
 *
 * The archive's own order: a white page, an H1 at 35px, the breadcrumb *below* it,
 * and the sort control on the same row at the right. Then a full-width grid with no
 * sidebar — the source markup is `col large-12`, so the 230px filter rail that
 * `SCR-02` drew never existed on the real page.
 *
 * Geometry taken from the captured `pageStyles`: `.archive .shop-page-title`
 * 35px, its `.page-title-inner` 30px bottom padding, the breadcrumb 16px with no
 * uppercasing, `.archive .woocommerce-ordering` 16px with a 5px radius, and
 * `.row.row-small` capped at 1262.5px — narrower than the 1390px chrome rail, which
 * is why the grid gets its own width rather than reusing `CommerceRail`'s.
 *
 * What the archive does not have, and this page keeps: the search box, the category
 * chips and the result count. They are working filters, so they sit in one compact
 * toolbar below the title band rather than being dropped to match.
 *
 * Every filter is URL state. One `updateFilters` path owns the URL, the upstream
 * request and the cache key, so a filtered list is always shareable and the
 * uncommitted search draft rides along with whatever else changes.
 *
 * The compact card grid uses a 1 → 2 → 3 → 4 column responsive ladder.
 */
export function CatalogList({
  cards,
  categories,
  filters,
  isDemoData = false,
  pagination,
  showPageHeading = true,
}: CatalogListProps) {
  const router = useRouter();
  const queryInputRef = useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isPending, startTransition] = useTransition();
  const pages = paginationPages(pagination.currentPage, pagination.lastPage);
  const resultRangeStart = pagination.total === 0 ? 0 : ((pagination.currentPage - 1) * pagination.perPage) + 1;
  const resultRangeEnd = Math.min(pagination.currentPage * pagination.perPage, pagination.total);
  const committedFilterKey = JSON.stringify([
    filters.query,
    filters.category,
    filters.page,
    pagination.perPage,
  ]);
  const currentQueryDraft = () => (queryInputRef.current?.value ?? filters.query).trim().slice(0, 100);
  /**
   * A `sort`/`direction` pair the ordering table does not list — reachable by hand in
   * the URL, and valid upstream — falls back to the default option rather than
   * leaving the control blank.
   */
  const activeOrdering =
    CATALOG_ORDERINGS.find((option) => option.sort === filters.sort && option.direction === filters.direction)
      ?.value ?? CATALOG_ORDERINGS[0].value;
  /**
   * Every control commits through here so one code path owns the URL, the
   * upstream request and the cache key. The uncommitted search draft rides along
   * with a category change.
   */
  const updateFilters = (overrides: Partial<CatalogFilters>) => {
    const next: CatalogFilters = { ...filters, query: currentQueryDraft(), ...overrides, page: 1 };
    startTransition(() => router.push(catalogHref(next), { scroll: false }));
  };
  /**
   * Whether anything is narrowing the list. Drives the `Xóa bộ lọc` control, which is
   * only meaningful when there is something to clear — matching the sort control's
   * own fallback, a non-default `sort`/`direction` pair counts.
   */
  const hasActiveFilters = Boolean(filters.query)
    || Boolean(filters.category)
    || filters.sort !== DEFAULT_CATALOG_SORT
    || filters.direction !== DEFAULT_CATALOG_SORT_DIRECTION
    || filters.pageSize !== DEFAULT_CATALOG_PAGE_SIZE;
  const clearFilters = () => updateFilters({
    category: "",
    direction: DEFAULT_CATALOG_SORT_DIRECTION,
    pageSize: DEFAULT_CATALOG_PAGE_SIZE,
    query: "",
    sort: DEFAULT_CATALOG_SORT,
  });
  return (
    <div className="bg-white text-commerce-body">
      <CommerceRail className="-mt-6 max-w-4xl pb-12 pt-0">
        {showPageHeading ? (
          <section className="pb-6">
          {showPageHeading ? (
            <header className="min-w-0">
              <h1 className="text-[35px] font-bold leading-tight">Danh sách sản phẩm</h1>
              <nav aria-label="Breadcrumb" className="mt-2 text-base text-commerce-secondary">
                <Link className="underline-offset-4 hover:text-commerce-brand-dark hover:underline" href="/">Trang chủ</Link>
                <span aria-hidden="true"> / </span>
                <span aria-current="page">Danh sách sản phẩm</span>
              </nav>
            </header>
          ) : null}
          </section>
        ) : null}

        <section className="pt-4" aria-label="Điều khiển danh sách sản phẩm">
          {/* The reference leads with categories, then keeps search and display controls compact. */}
          <div className="flex gap-2 overflow-x-auto border-b border-commerce-border pb-3 lg:overflow-visible" data-catalog-category-nav role="group" aria-label="Danh mục nhanh">
            <CategoryChip
              isActive={!filters.category}
              isPending={isPending}
              label="Tất cả"
              onSelect={() => updateFilters({ category: "" })}
            />
            {categories.map((category) => (
              <CategoryChip
                isActive={filters.category === category.slug}
                isPending={isPending}
                key={category.id}
                label={category.name}
                onSelect={() => updateFilters({ category: category.slug })}
              />
            ))}
          </div>

          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
            <form
              className="flex min-w-0 w-full md:flex-1"
              onSubmit={(event) => {
                event.preventDefault();
                updateFilters({ query: String(new FormData(event.currentTarget).get("q") ?? "").trim() });
              }}
            >
              <label className="sr-only" htmlFor="catalog-query">Tìm sản phẩm</label>
              <span className="relative flex min-w-0 flex-1 items-center">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 size-4 text-commerce-secondary" />
                <input
                  aria-busy={isPending}
                  aria-describedby="catalog-result-status"
                  className="min-h-11 w-full rounded-l-[5px] border border-r-0 border-commerce-border bg-white pl-9 pr-3 text-sm font-normal text-commerce-body placeholder:text-commerce-secondary focus-visible:commerce-focus-ring"
                  defaultValue={filters.query}
                  id="catalog-query"
                  key={committedFilterKey}
                  maxLength={100}
                  name="q"
                  placeholder="Tìm kiếm sản phẩm, thương hiệu..."
                  readOnly={isPending}
                  ref={queryInputRef}
                  type="search"
                />
              </span>
              <button
                aria-label="Tìm sản phẩm"
                className="!m-0 !p-0 flex min-h-11 w-11 shrink-0 items-center justify-center rounded-r-[5px] bg-commerce-brand-dark text-white hover:brightness-90 focus-visible:commerce-focus-ring disabled:opacity-45"
                data-catalog-search-submit
                disabled={isPending}
                type="submit"
              >
                <Search aria-hidden="true" className="size-5" />
              </button>
            </form>

            <div className="flex w-full items-center gap-2 md:w-auto">
              <label className="shrink-0 text-sm font-medium text-commerce-secondary" htmlFor="catalog-orderby">Sắp xếp:</label>
              <select
                className="min-h-11 min-w-0 flex-1 rounded-[5px] border border-commerce-border bg-white px-3 text-sm font-semibold text-commerce-body focus-visible:commerce-focus-ring md:w-64 md:flex-none"
                disabled={isPending}
                id="catalog-orderby"
                onChange={(event) => {
                  const option = CATALOG_ORDERINGS.find((entry) => entry.value === event.target.value);
                  if (option) updateFilters({ direction: option.direction, sort: option.sort });
                }}
                value={activeOrdering}
              >
                {CATALOG_ORDERINGS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>

              <div className="flex w-24 shrink-0 overflow-hidden rounded-[5px] border border-commerce-border" data-catalog-view-toggle role="group" aria-label="Chế độ hiển thị">
                <button
                  aria-label="Hiển thị dạng lưới"
                  aria-pressed={viewMode === "grid"}
                  className={`!m-0 !p-0 flex min-h-11 min-w-11 flex-1 items-center justify-center focus-visible:commerce-focus-ring ${viewMode === "grid" ? "bg-commerce-brand-dark text-white" : "bg-white text-commerce-secondary hover:text-commerce-brand-dark"}`}
                  onClick={() => setViewMode("grid")}
                  type="button"
                >
                  <Grid2X2 aria-hidden="true" className="size-4" />
                </button>
                <button
                  aria-label="Hiển thị dạng danh sách"
                  aria-pressed={viewMode === "list"}
                  className={`!m-0 !p-0 flex min-h-11 min-w-11 flex-1 items-center justify-center border-l border-commerce-border focus-visible:commerce-focus-ring ${viewMode === "list" ? "bg-commerce-brand-dark text-white" : "bg-white text-commerce-secondary hover:text-commerce-brand-dark"}`}
                  onClick={() => setViewMode("list")}
                  type="button"
                >
                  <List aria-hidden="true" className="size-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p aria-live="polite" className="!mb-0 text-[11px] text-commerce-secondary" data-catalog-result-count id="catalog-result-status">
                {isPending ? "Đang cập nhật danh mục..." : `Hiển thị ${resultRangeStart}–${resultRangeEnd} trong ${pagination.total} sản phẩm`}
                {isDemoData ? (
                  <span aria-label={DEMO_CATALOG_NOTICE} className="ml-2 text-commerce-secondary" title={DEMO_CATALOG_NOTICE}>· Dữ liệu mẫu</span>
                ) : null}
              </p>
              {hasActiveFilters ? (
                <button
                  className="!m-0 min-h-11 text-sm font-semibold text-commerce-brand-dark underline-offset-4 hover:underline disabled:opacity-45 focus-visible:commerce-focus-ring"
                  disabled={isPending}
                  onClick={clearFilters}
                  type="button"
                >
                  Xóa bộ lọc
                </button>
              ) : null}
            </div>
            <Link
              className="ml-auto flex min-h-11 items-center rounded-commerce-control border border-commerce-brand px-4 text-sm font-bold text-commerce-brand-dark hover:bg-commerce-active-surface focus-visible:commerce-focus-ring"
              data-catalog-request-cart-link
              href="/gui-yeu-cau/"
              prefetch={false}
            >
              Xem yêu cầu báo giá
            </Link>
            <AdminProductCreateContextualAction />
          </div>
        </section>

        <div className="mt-1 min-w-0">
          {cards.length ? (
            <div
              aria-busy={isPending}
              className={`${viewMode === "grid" ? "grid grid-cols-1 gap-3 min-[440px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 lg:gap-5" : "grid grid-cols-1 gap-3"} ${isPending ? "opacity-60" : ""}`}
              data-catalog-grid
            >
              {cards.map((card) => <CatalogProductCard card={card} key={card.id} />)}
            </div>
          ) : isPending ? (
            <div
              aria-busy="true"
              className="grid grid-cols-1 gap-3 min-[440px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 lg:gap-5"
              data-catalog-grid
            >
              {/* One skeleton per column of the widest row, so the grid keeps its shape. */}
              {Array.from({ length: 6 }, (_, index) => (
                <div
                  aria-hidden="true"
                  className="h-[300px] animate-pulse rounded-[10px] bg-commerce-active-surface"
                  data-catalog-skeleton
                  key={index}
                />
              ))}
            </div>
          ) : (
            <div className="commerce-card-surface p-6" role="status">
              <h2 className={COMMERCE_TYPOGRAPHY.sectionTitle}>Chưa tìm thấy sản phẩm phù hợp.</h2>
              <p className="mt-1.5 text-sm text-commerce-secondary">
                Thử một từ khóa khác hoặc xem lại toàn bộ danh mục.
              </p>
              <button
                className="mt-4 min-h-11 rounded-commerce-control bg-commerce-brand-dark px-5 text-sm font-bold text-white hover:brightness-90 focus-visible:commerce-focus-ring"
                onClick={clearFilters}
                type="button"
              >
                Xem toàn bộ sản phẩm
              </button>
            </div>
          )}

          {pagination.lastPage > 1 ? (
            <nav aria-label="Phân trang" className="mt-7 flex flex-wrap gap-2">
              {pages.map((page) => (
                <Link
                  aria-current={page === pagination.currentPage ? "page" : undefined}
                  className={`flex min-h-11 min-w-11 items-center justify-center rounded-commerce-control border px-3 text-sm font-semibold focus-visible:commerce-focus-ring ${
                    page === pagination.currentPage
                      ? "border-commerce-brand-dark bg-commerce-brand-dark text-white"
                      : "border-commerce-border text-commerce-body hover:border-commerce-brand hover:text-commerce-brand-dark"
                  }`}
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

        <aside className="mt-10 flex flex-wrap items-center justify-between gap-3 rounded-commerce-control bg-commerce-support-strip px-5 py-4">
          <p className="text-sm text-commerce-body">
            <strong className="font-bold">Cần báo giá theo sản lượng?</strong>{" "}
            Gửi quy cách và số lượng dự kiến, bộ phận kinh doanh B2B sẽ phản hồi bằng bảng giá chi tiết.
          </p>
          <Link
            className="flex min-h-11 items-center rounded-commerce-control border border-commerce-brand px-4 text-sm font-bold text-commerce-brand-dark hover:bg-white focus-visible:commerce-focus-ring"
            href="/lien-he/"
          >
            Liên hệ tư vấn
          </Link>
        </aside>
      </CommerceRail>
    </div>
  );
}

function CategoryChip({
  isActive,
  isPending,
  label,
  onSelect,
}: {
  isActive: boolean;
  isPending: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      aria-pressed={isActive}
      className={`!m-0 !px-4 !py-0 min-h-11 shrink-0 whitespace-nowrap rounded-full border text-sm font-semibold disabled:opacity-45 focus-visible:commerce-focus-ring ${
        isActive
          ? "border-commerce-brand-dark bg-commerce-brand-dark text-white"
          : "border-commerce-border bg-white text-commerce-body hover:border-commerce-brand hover:text-commerce-brand-dark"
      }`}
      disabled={isPending}
      onClick={onSelect}
      type="button"
    >
      {label}
    </button>
  );
}

function paginationPages(current: number, last: number): number[] {
  const start = Math.max(1, Math.min(current - 2, last - 4));
  const end = Math.min(last, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}
