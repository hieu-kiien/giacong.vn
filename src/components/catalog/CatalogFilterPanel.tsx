"use client";

import {
  CATALOG_PAGE_SIZES,
  DEFAULT_CATALOG_PAGE_SIZE,
  DEFAULT_CATALOG_SORT,
  DEFAULT_CATALOG_SORT_DIRECTION,
} from "@/lib/catalog-query";
import type { CatalogFilters, CatalogPageSize } from "@/types/catalog";

interface CatalogFilterPanelProps {
  filters: CatalogFilters;
  isPending: boolean;
  onClear: () => void;
  onUpdate: (next: Partial<CatalogFilters>) => void;
}

/**
 * Only sort and page size are offered. The handoff also lists price
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
      <label className="grid gap-1.5 border-t border-commerce-border pt-5 text-sm font-bold text-commerce-body">
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
