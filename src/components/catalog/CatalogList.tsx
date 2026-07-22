"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";

import { catalogHref } from "@/lib/catalog-query";
import { CatalogProductCard } from "@/components/catalog/CatalogProductCard";
import styles from "@/components/catalog/catalog.module.css";
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

  const updateFilters = (nextFilters: CatalogFilters) => {
    const normalized = { ...nextFilters, page: 1 };
    startTransition(() => router.push(catalogHref(normalized), { scroll: false }));
  };
  const currentQueryDraft = () => (queryInputRef.current?.value ?? filters.query).trim().slice(0, 100);

  return (
    <main id="catalog-main" className={styles.catalog}>
      <div className={styles.inner}>
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <Link href="/">Trang chủ</Link> <span aria-hidden="true">/</span> Sản phẩm
        </nav>
        <header className={styles.heading}>
          <h1 className={styles.title}>Sản phẩm</h1>
          <p className={styles.intro}>Xem các dòng sản phẩm đang có trong danh mục B2B, rồi chọn phiên bản phù hợp ở trang chi tiết.</p>
        </header>

        <form className={styles.filters} onSubmit={(event) => {
          event.preventDefault();
          const query = String(new FormData(event.currentTarget).get("q") ?? "").trim();
          updateFilters({ ...filters, query });
        }}>
          <label className={styles.field} htmlFor="catalog-query">
            Tìm sản phẩm
            <input
              aria-busy={isPending}
              aria-describedby="catalog-result-status"
              id="catalog-query"
              defaultValue={filters.query}
              key={committedFilterKey}
              maxLength={100}
              name="q"
              readOnly={isPending}
              ref={queryInputRef}
              type="search"
            />
          </label>
          <fieldset className={styles.categoryFilters}>
            <legend>Danh mục</legend>
            <div className={styles.chips}>
              <button aria-pressed={!filters.category} className={styles.chip} disabled={isPending} onClick={() => updateFilters({ ...filters, category: "", query: currentQueryDraft() })} type="button">Tất cả</button>
              {categories.map((category) => (
                <button
                  aria-pressed={filters.category === category.slug}
                  className={styles.chip}
                  disabled={isPending}
                  key={category.id}
                  onClick={() => updateFilters({ ...filters, category: category.slug, query: currentQueryDraft() })}
                  type="button"
                >
                  {category.name}
                </button>
              ))}
            </div>
          </fieldset>
        </form>

        <p className={styles.resultCount} aria-live="polite" id="catalog-result-status">{isPending ? "Đang cập nhật danh mục..." : `${result.pagination.total} dòng sản phẩm`}</p>
        {result.products.length ? (
          <div aria-busy={isPending} className={styles.grid} data-catalog-grid>{result.products.map((product) => <CatalogProductCard key={product.id} product={product} />)}</div>
        ) : (
          <div className={styles.empty} role="status">
            <h2>Chưa tìm thấy sản phẩm phù hợp.</h2>
            <p>Thử một từ khóa khác hoặc xem lại toàn bộ danh mục.</p>
            <button className={styles.button} onClick={() => updateFilters({ category: "", page: 1, query: "" })} type="button">Xem toàn bộ sản phẩm</button>
          </div>
        )}

        {result.pagination.lastPage > 1 ? (
          <nav className={styles.pagination} aria-label="Phân trang">
            {pages.map((page) => (
              <Link
                aria-current={page === result.pagination.currentPage ? "page" : undefined}
                className={`${styles.pageLink} ${page === result.pagination.currentPage ? styles.activePage : ""}`}
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
    </main>
  );
}

function paginationPages(current: number, last: number): number[] {
  const start = Math.max(1, Math.min(current - 2, last - 4));
  const end = Math.min(last, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}
