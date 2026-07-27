"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgePercent, FileCheck2, MessagesSquare, Package, Search } from "lucide-react";
import { useRef, useTransition } from "react";

import { CatalogProductCard } from "@/components/catalog/CatalogProductCard";
import {
  CATALOG_TRUST_BENEFITS,
  DEMO_CATALOG_NOTICE,
  type CatalogCardView,
  type CatalogTrustIcon,
} from "@/components/catalog/catalog-listing";
import { CommerceRail } from "@/components/commerce/CommerceRail";
import { COMMERCE_TYPOGRAPHY } from "@/components/commerce/typography";
import {
  catalogHref,
  DEFAULT_CATALOG_PAGE_SIZE,
  DEFAULT_CATALOG_SORT,
  DEFAULT_CATALOG_SORT_DIRECTION,
} from "@/lib/catalog-query";
import type { CatalogCategory, CatalogFilters, CatalogPagination } from "@/types/catalog";

interface CatalogListProps {
  cards: CatalogCardView[];
  categories: CatalogCategory[];
  filters: CatalogFilters;
  /** True when the demo fixture answered because the catalog feed was unreachable. */
  isDemoData?: boolean;
  pagination: CatalogPagination;
}

const TRUST_ICONS: Record<CatalogTrustIcon, typeof BadgePercent> = {
  document: FileCheck2,
  moq: Package,
  support: MessagesSquare,
  tier: BadgePercent,
};

/**
 * `/san-pham`, following `SCR-02-product-list`: breadcrumb, heading with the
 * trust row beside it, search and category chips, the result count, then a
 * full-width product grid and the B2B support strip last.
 *
 * Every filter is URL state. One `updateFilters` path owns the URL, the upstream
 * request and the cache key, so a filtered list is always shareable and the
 * uncommitted search draft rides along with whatever else changes.
 *
 * Grid columns follow the approved responsive table: one at 320, two from 360
 * (covering 390 and 768), and four from 1024.
 */
export function CatalogList({
  cards,
  categories,
  filters,
  isDemoData = false,
  pagination,
}: CatalogListProps) {
  const router = useRouter();
  const queryInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const pages = paginationPages(pagination.currentPage, pagination.lastPage);
  const committedFilterKey = JSON.stringify([
    filters.query,
    filters.category,
    filters.page,
    pagination.perPage,
  ]);
  const currentQueryDraft = () => (queryInputRef.current?.value ?? filters.query).trim().slice(0, 100);
  /**
   * Every control commits through here so one code path owns the URL, the
   * upstream request and the cache key. The uncommitted search draft rides along
   * with a category change.
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
  return (
    <div className="bg-[#f7f8f4] text-commerce-body">
      <CommerceRail className="pb-12 pt-5 lg:pt-7">
        <nav aria-label="Breadcrumb" className="mb-3 text-[13px] text-commerce-secondary">
          <Link className="underline-offset-4 hover:text-commerce-brand-dark hover:underline" href="/">Trang chủ</Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">Sản phẩm</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
          <header className="max-w-[560px]">
            <h1 className={COMMERCE_TYPOGRAPHY.pageTitle}>Danh sách sản phẩm</h1>
            <p className="mt-1.5 text-sm leading-6 text-commerce-secondary">
              Nguyên liệu và bao bì cho đơn hàng doanh nghiệp, có sẵn quy cách và giá theo số lượng.
            </p>
          </header>
          <ul className="grid gap-x-6 gap-y-1.5 max-md:grid-cols-1 md:grid-cols-2">
            {CATALOG_TRUST_BENEFITS.map((benefit) => {
              const Icon = TRUST_ICONS[benefit.icon];
              return (
                <li className="flex items-center gap-2 text-[13px] text-commerce-body" key={benefit.label}>
                  <Icon aria-hidden="true" className="size-4 shrink-0 text-commerce-brand" />
                  {benefit.label}
                </li>
              );
            })}
          </ul>
        </div>

        {isDemoData ? (
          <p className="mt-5 rounded-commerce-control border border-commerce-border bg-white px-4 py-3 text-[13px] text-commerce-body" role="status">
            {DEMO_CATALOG_NOTICE}
          </p>
        ) : null}

        <form
          className="mt-5"
          onSubmit={(event) => {
            event.preventDefault();
            updateFilters({ query: String(new FormData(event.currentTarget).get("q") ?? "").trim() });
          }}
        >
          <label className="grid max-w-[520px] gap-1.5 text-sm font-bold text-commerce-body" htmlFor="catalog-query">
            Tìm sản phẩm
            <span className="relative flex items-center">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 size-4 text-commerce-secondary" />
              <input
                aria-busy={isPending}
                aria-describedby="catalog-result-status"
                className="min-h-11 w-full rounded-commerce-control border border-commerce-border bg-white pl-9 pr-3 text-sm font-normal text-commerce-body placeholder:text-commerce-secondary focus-visible:commerce-focus-ring"
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

        {/*
          Category chips scroll horizontally rather than wrapping into a tall block,
          per the responsive note in the catalog specification.
        */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Danh mục nhanh">
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

        <div className="mt-4 border-b border-commerce-border pb-4">
          <p aria-live="polite" className="text-sm font-bold text-commerce-body" id="catalog-result-status">
            {isPending ? "Đang cập nhật danh mục..." : `${pagination.total} dòng sản phẩm`}
          </p>
        </div>

        <div className="mt-6 min-w-0">
          {cards.length ? (
            <div
              aria-busy={isPending}
              className={`grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-[18px] ${isPending ? "opacity-60" : ""}`}
              data-catalog-grid
            >
              {cards.map((card) => <CatalogProductCard card={card} key={card.id} />)}
            </div>
          ) : isPending ? (
            <div
              aria-busy="true"
              className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-[18px]"
              data-catalog-grid
            >
              {Array.from({ length: 4 }, (_, index) => (
                <div
                  aria-hidden="true"
                  className="commerce-card-surface h-[340px] animate-pulse"
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
                className="mt-4 min-h-11 rounded-commerce-control bg-commerce-brand px-5 text-sm font-bold text-white hover:bg-commerce-brand-dark focus-visible:commerce-focus-ring"
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
                      ? "border-commerce-brand bg-commerce-brand text-white"
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
      className={`min-h-11 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-semibold disabled:opacity-45 focus-visible:commerce-focus-ring ${
        isActive
          ? "border-commerce-brand bg-commerce-brand text-white"
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
