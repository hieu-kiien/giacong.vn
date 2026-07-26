"use client";

import {
  CATALOG_PAGE_SIZES,
  DEFAULT_CATALOG_PAGE_SIZE,
  DEFAULT_CATALOG_SORT,
  DEFAULT_CATALOG_SORT_DIRECTION,
} from "@/lib/catalog-query";
import type { CatalogCategory, CatalogFilters, CatalogPageSize } from "@/types/catalog";

interface CatalogFilterPanelProps {
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
  { label: "Nhiều phiên bản nhất", value: "variant_count:desc" },
];

export function CatalogFilterPanel({
  categories,
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
    <div className="grid gap-6">
      <fieldset className="min-w-0 border-0 p-0">
        <legend className="mb-3 text-sm font-bold text-brand-800">Danh mục</legend>
        <div className="flex flex-wrap gap-2">
          <CategoryChip
            isActive={!filters.category}
            isPending={isPending}
            label="Tất cả"
            onSelect={() => onUpdate({ category: "" })}
          />
          {categories.map((category) => (
            <CategoryChip
              isActive={filters.category === category.slug}
              isPending={isPending}
              key={category.id}
              label={category.name}
              onSelect={() => onUpdate({ category: category.slug })}
            />
          ))}
        </div>
      </fieldset>

      <label className="grid gap-2 text-sm font-bold text-brand-800">
        Sắp xếp
        <select
          className="min-h-11 rounded-md border border-hairline-strong bg-white px-3 text-sm font-normal text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
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

      <label className="grid gap-2 text-sm font-bold text-brand-800">
        Số sản phẩm mỗi trang
        <select
          className="min-h-11 rounded-md border border-hairline-strong bg-white px-3 text-sm font-normal text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
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
        className="min-h-11 rounded-md border border-brand-700 px-4 text-sm font-bold text-brand-800 hover:bg-brand-50 disabled:opacity-45 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
        disabled={isPending || !hasFilters}
        onClick={onClear}
        type="button"
      >
        Xóa bộ lọc
      </button>
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
      className={`min-h-11 rounded-full border px-4 text-sm font-semibold disabled:opacity-45 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus ${
        isActive
          ? "border-brand-700 bg-brand-700 text-white"
          : "border-hairline-strong bg-white text-ink hover:border-brand-700 hover:text-brand-800"
      }`}
      disabled={isPending}
      onClick={onSelect}
      type="button"
    >
      {label}
    </button>
  );
}
