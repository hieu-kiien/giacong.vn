import Link from "next/link";

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
  const pages = paginationPages(result.pagination.currentPage, result.pagination.lastPage);

  return (
    <main id="catalog-main" className={styles.catalog}>
      <div className={styles.inner}>
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <Link href="/">Trang chủ</Link> <span aria-hidden="true">/</span> Sản phẩm
        </nav>
        <h1 className={styles.title}>Danh mục sản phẩm</h1>
        <p className={styles.intro}>Tìm nguyên liệu và sản phẩm gia công theo nhu cầu đặt hàng doanh nghiệp.</p>

        <form className={styles.filters} action="/san-pham/" method="get">
          <label className={styles.field} htmlFor="catalog-query">
            Tìm sản phẩm
            <input defaultValue={filters.query} id="catalog-query" maxLength={100} name="q" type="search" />
          </label>
          <label className={styles.field} htmlFor="catalog-category">
            Danh mục
            <select defaultValue={filters.category} id="catalog-category" name="category">
              <option value="">Tất cả danh mục</option>
              {categories.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}
            </select>
          </label>
          <button className={styles.button} type="submit">Lọc sản phẩm</button>
        </form>

        <p className={styles.resultCount} aria-live="polite">{result.pagination.total} sản phẩm</p>
        {result.products.length ? (
          <div className={styles.grid}>{result.products.map((product) => <CatalogProductCard key={product.id} product={product} />)}</div>
        ) : (
          <div className={styles.empty}>
            <p>Chưa tìm thấy sản phẩm phù hợp.</p>
            <Link className={styles.button} href="/san-pham/">Xem toàn bộ sản phẩm</Link>
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
