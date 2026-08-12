"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { catalogHref } from "@/lib/catalog-query";
import type { CatalogCategory } from "@/types/catalog";

interface CategoryMegaMenuProps {
  categories: CatalogCategory[];
}

/**
 * Desktop category menu. The captured Flatsome dropdown was CSS-only
 * (`:hover`/`:focus-within`) with a hard-coded `aria-expanded="false"`, so it had
 * no keyboard path at all. This owns the disclosure state instead: click or
 * Enter/Space toggles, Escape closes and returns focus, and an outside pointer
 * press closes without stealing focus.
 */
const PANEL_ID = "storefront-category-menu";

export function CategoryMegaMenu({ categories }: CategoryMegaMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && containerRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  return (
    <div className="relative max-md:hidden" ref={containerRef}>
      <button
        aria-controls={PANEL_ID}
        aria-expanded={open}
        className="flex min-h-11 items-center gap-1.5 px-3 text-sm font-bold tracking-wide text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        Danh mục sản phẩm
        <ChevronDown aria-hidden="true" className={`size-4 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
      </button>
      <div
        aria-label="Danh mục sản phẩm"
        className="absolute left-0 top-full z-50 mt-1 w-[min(46rem,calc(100vw-3rem))] rounded-lg border border-hairline bg-white p-5 text-ink shadow-[0_14px_40px_rgba(16,24,40,0.16)]"
        hidden={!open}
        id={PANEL_ID}
      >
        <div className="grid gap-6 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]" data-mega-columns>
          <div>
            <p className="mb-3 text-xs font-bold tracking-[0.06em] text-ink-soft uppercase">Danh mục</p>
            {categories.length ? (
              <ul className="grid gap-1 sm:grid-cols-2">
                {categories.map((category) => (
                  <li key={category.id}>
                    <Link
                      className="flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-ink hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
                      href={catalogHref({ category: category.slug })}
                      onClick={() => setOpen(false)}
                      prefetch={false}
                    >
                      {category.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-soft">Danh mục đang được cập nhật.</p>
            )}
          </div>
          <div className="border-hairline sm:border-l sm:pl-6">
            <p className="mb-3 text-xs font-bold tracking-[0.06em] text-ink-soft uppercase">Lối tắt</p>
            <ul className="grid gap-1">
              <li>
                <Link
                  className="flex min-h-11 items-center rounded-md px-3 text-sm font-bold text-brand-800 hover:bg-brand-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  href="/san-pham/"
                  onClick={() => setOpen(false)}
                  prefetch={false}
                >
                  Xem tất cả sản phẩm
                </Link>
              </li>
              <li>
                <Link
                  className="flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-ink hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  href="/lien-he/"
                  onClick={() => setOpen(false)}
                  prefetch={false}
                >
                  Đặt số lượng lớn
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
