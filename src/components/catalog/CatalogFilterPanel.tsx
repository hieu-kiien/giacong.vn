"use client";

import {
  CATALOG_PAGE_SIZES,
  DEFAULT_CATALOG_PAGE_SIZE,
  DEFAULT_CATALOG_SORT,
  DEFAULT_CATALOG_SORT_DIRECTION,
} from "@/lib/catalog-query";
import type { CatalogCategory, CatalogFilters, CatalogPageSize } from "@/types/catalog";

interface CatalogFilterPanelProps {
  /** Per-category product counts when the source publishes them; the sidebar in
   * `SCR-02` shows a count beside each group. The Bagisto list contract has none,
   * so the number is rendered only when it is real. */
  categoryCounts?: Record<string, number>;
  categories: CatalogCategory[];
  filters: CatalogFilters;
  isPending: boolean;
  onClear: () => void;
  onUpdate: (next: Partial<CatalogFilters>) => void;
}

/**
 * Only sort, page size and category are offered. The handoff also lists price
 * range, stock, quy cách and thương hiệu facets, but the catalog contract has no
 * upstream support for them, and a control that cannot filter is worse than no
 * control. One instance renders in the desktop sidebar and one inside the mobile
 * drawer; a closed `<dialog>` is `display:none`, so only one is ever in the
 * accessibility tree.
 */
const SORT_OPTIONS: readonly { label: string; value: string }[] = [
  { label: "Tên A → Z", value: "name:asc" },
  { label: "Tên Z → A", value: "name:desc" },
  { label: "Giá từ thấp đến cao", value: "starting_price:asc" },
  { label: "Giá từ cao đến thấp", value: "starting_price:desc" },
  { label: "Nhiều quy cách nhất", value: "variant_count:desc" },
];

export function CatalogFilterPanel({
  categories,
  categoryCounts,
  filters,
  isPending,
  onClear,
  onUpdate,
}: CatalogFilterPanelProps) {
  const hasFilters = Boolean(filters.category)
    || Boolean(filters.query)
    || filters.sort !== DEFAULT_CATALOG_SORT
    || filters.direction !== DEFAULT_CATALOG_SORT_DIRECTION
    || filters.pageSize !== DEFAULT_CATALOG_PAGE_SIZE;

  return (
    <div className="grid gap-5">
      <fieldset className="min-w-0 border-0 p-0">
        <legend className="mb-2 text-sm font-bold text-commerce-body">Danh mục</legend>
        <ul className="grid">
          <li>
            <CategoryRow
              count={categoryCounts ? Object.values(categoryCounts).reduce((total, value) => total + value, 0) : undefined}
              isActive={!filters.category}
              isPending={isPending}
              label="Tất cả sản phẩm"
              onSelect={() => onUpdate({ category: "" })}
            />
          </li>
          {categories.map((category) => (
            <li key={category.id}>
              <CategoryRow
                count={categoryCounts?.[category.slug]}
                isActive={filters.category === category.slug}
                isPending={isPending}
                label={category.name}
                onSelect={() => onUpdate({ category: category.slug })}
              />
            </li>
          ))}
        </ul>
      </fieldset>

      <label className="grid gap-1.5 text-sm font-bold text-commerce-body">
        Sắp xếp
        <select
          className="min-h-11 rounded-commerce-control border border-commerce-border bg-white px-3 text-sm font-normal text-commerce-body focus-visible:commerce-focus-ring"
          disabled={isPending}
          onChange={(event) => {
            const [sort, direction] = event.target.value.split(":");
            onUpdate({
              direction: direction === "desc" ? "desc" : "asc",
              sort: sort as CatalogFilters["sort"],
            });
          }}
          value={`${filters.sort}:${filters.direction}`}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-sm font-bold text-commerce-body">
        Số sản phẩm mỗi trang
        <select
          className="min-h-11 rounded-commerce-control border border-commerce-border bg-white px-3 text-sm font-normal text-commerce-body focus-visible:commerce-focus-ring"
          disabled={isPending}
          onChange={(event) => onUpdate({ pageSize: Number(event.target.value) as CatalogPageSize })}
          value={String(filters.pageSize)}
        >
          {CATALOG_PAGE_SIZES.map((size) => (
            <option key={size} value={String(size)}>{size} sản phẩm</option>
          ))}
        </select>
      </label>

      <button
        className="min-h-11 rounded-commerce-control border border-commerce-brand px-4 text-sm font-bold text-commerce-brand-dark hover:bg-commerce-active-surface disabled:opacity-45 focus-visible:commerce-focus-ring"
        disabled={isPending || !hasFilters}
        onClick={onClear}
        type="button"
      >
        Xóa bộ lọc
      </button>
    </div>
  );
}

/**
 * Sidebar category row. A 3px leading edge marks the active group, matching the
 * active-state treatment the behaviour spec defines for the mega menu, so the two
 * navigation surfaces read the same way.
 */
function CategoryRow({
  count,
  isActive,
  isPending,
  label,
  onSelect,
}: {
  count?: number;
  isActive: boolean;
  isPending: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      aria-pressed={isActive}
      className={`flex min-h-11 w-full items-center justify-between gap-2 border-l-3 px-3 text-left text-sm disabled:opacity-45 focus-visible:commerce-focus-ring ${
        isActive
          ? "border-l-commerce-brand bg-commerce-active-surface font-bold text-commerce-brand-dark"
          : "border-l-transparent font-medium text-commerce-body hover:bg-commerce-active-surface"
      }`}
      disabled={isPending}
      onClick={onSelect}
      type="button"
    >
      <span className="min-w-0">{label}</span>
      {count === undefined ? null : <span className="text-xs text-commerce-secondary">{count}</span>}
    </button>
  );
}
