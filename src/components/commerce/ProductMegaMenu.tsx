"use client";

import Link from "next/link";
import { ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { CommerceIcon } from "@/components/commerce/CommerceIcon";
import type { CommerceMegaMenuModel } from "@/components/commerce/commerce-navigation";
import { catalogHref } from "@/lib/catalog-query";
import { formatVnd } from "@/lib/format-vnd";

interface ProductMegaMenuProps {
  menu: CommerceMegaMenuModel;
}

/**
 * Desktop product mega-menu.
 *
 * Interaction follows the behaviour specification: hover previews the panel,
 * click pins it so the pointer can travel into it, and Escape or an outside
 * pointer press closes it and returns focus to the trigger. The captured dropdown
 * was CSS-only with a hard-coded `aria-expanded="false"`, so it had no keyboard
 * path at all; this owns the state instead.
 *
 * The panel is positioned against the header rail, so it opens directly below the
 * band and shares the catalog's left and right edges.
 */
export function ProductMegaMenu({ menu }: ProductMegaMenuProps) {
  const panelId = useId();
  const searchId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  /** A pinned panel survives the pointer leaving the trigger. */
  const [pinned, setPinned] = useState(false);
  const [query, setQuery] = useState("");
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);

  const activeSlug =
    hoveredSlug ?? menu.categories.find((category) => category.isActive)?.slug ?? menu.categories[0]?.slug ?? "";

  function close() {
    setOpen(false);
    setPinned(false);
  }

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      close();
      triggerRef.current?.focus();
    };
    // Pointer, not click: closing on press matches the rest of the commerce UI and
    // does not steal focus from whatever the customer pressed.
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && containerRef.current?.contains(event.target)) return;
      close();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  /**
   * Label filter. It narrows what the panel lists and never navigates, so a
   * customer can find a group without leaving the page they are on.
   */
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return menu.categories;

    return menu.categories
      .map((category) => ({
        ...category,
        subcategories: category.subcategories.filter((row) => row.label.toLowerCase().includes(needle)),
      }))
      .filter((category) => category.label.toLowerCase().includes(needle) || category.subcategories.length > 0);
  }, [menu.categories, query]);

  const activeCategory = filtered.find((category) => category.slug === activeSlug) ?? filtered[0];
  const featured = activeCategory?.slug === activeSlug ? menu.featured : [];

  return (
    <div
      className="max-lg:hidden"
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => {
        if (!pinned) setOpen(false);
      }}
      ref={containerRef}
    >
      <button
        aria-controls={panelId}
        aria-expanded={open}
        className="flex commerce-target items-center gap-1 rounded-commerce-control px-2 text-sm font-semibold text-white transition-colors hover:bg-white/12 focus-visible:commerce-focus-ring motion-reduce:transition-none"
        onClick={() => {
          // Enter and Space arrive here too, which is what makes the trigger a real
          // toggle for the keyboard rather than hover-only.
          if (open && pinned) close();
          else {
            setOpen(true);
            setPinned(true);
          }
        }}
        ref={triggerRef}
        type="button"
      >
        Danh mục sản phẩm
        <ChevronDown
          aria-hidden="true"
          className={`size-4 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div
        aria-label="Danh mục sản phẩm"
        className="absolute inset-x-0 top-full z-50 mt-1 commerce-panel-surface p-5 text-commerce-body"
        hidden={!open}
        id={panelId}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="relative w-full max-w-[380px]">
            <label className="sr-only" htmlFor={searchId}>
              Tìm trong danh mục sản phẩm
            </label>
            <CommerceIcon
              className="absolute left-3 top-1/2 -translate-y-1/2 text-commerce-secondary"
              icon={Search}
              size="sm"
            />
            {/*
              Deliberately not a form: the panel search filters the labels below and
              must not navigate. Catalog search stays URL-driven on `/san-pham`.
            */}
            <input
              autoComplete="off"
              className="h-11 w-full rounded-commerce-control border border-commerce-border pl-10 pr-3 text-sm text-commerce-body placeholder:text-commerce-secondary focus-visible:commerce-focus-ring"
              id={searchId}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm nhóm hàng hoặc sản phẩm"
              type="search"
              value={query}
            />
          </div>
          <Link
            className="flex commerce-target items-center rounded-commerce-control px-3 text-sm font-semibold text-commerce-brand-dark hover:bg-commerce-active-surface focus-visible:commerce-focus-ring"
            href="/san-pham/"
            onClick={close}
            prefetch={false}
          >
            Xem tất cả sản phẩm
          </Link>
        </div>

        {menu.categories.length === 0 ? (
          <p className="py-6 text-sm text-commerce-secondary">Danh mục đang được cập nhật.</p>
        ) : (
          <div
            className="grid grid-cols-[minmax(0,24fr)_minmax(0,25fr)_minmax(0,51fr)] gap-5"
            data-mega-columns
          >
            <section aria-labelledby={`${panelId}-groups`}>
              <h2
                className="mb-2 px-3 text-xs font-bold uppercase tracking-[0.06em] text-commerce-secondary"
                id={`${panelId}-groups`}
              >
                Danh mục
              </h2>
              <ul className="grid gap-0.5">
                {filtered.map((category) => {
                  const isActive = category.slug === activeCategory?.slug;
                  return (
                    <li key={category.slug}>
                      <Link
                        className={`flex commerce-target items-center justify-between gap-2 rounded-commerce-control border-l-3 px-3 text-sm font-semibold focus-visible:commerce-focus-ring ${
                          isActive
                            ? "border-l-commerce-brand bg-commerce-active-surface text-commerce-brand-dark"
                            : "border-l-transparent text-commerce-body hover:bg-commerce-active-surface"
                        }`}
                        href={catalogHref({ category: category.slug })}
                        onClick={close}
                        onPointerEnter={() => setHoveredSlug(category.slug)}
                        prefetch={false}
                      >
                        <span>{category.label}</span>
                        <span className="text-xs font-normal text-commerce-secondary">{category.count}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section aria-labelledby={`${panelId}-items`} className="border-l border-commerce-border pl-5">
              <h2
                className="mb-2 px-3 text-xs font-bold uppercase tracking-[0.06em] text-commerce-secondary"
                id={`${panelId}-items`}
              >
                Mặt hàng
              </h2>
              {activeCategory?.subcategories.length ? (
                <ul className="grid gap-0.5">
                  {activeCategory.subcategories.map((row) => (
                    <li key={row.productSlug}>
                      <Link
                        className="flex commerce-target items-center gap-2 rounded-commerce-control px-3 text-sm text-commerce-body hover:bg-commerce-active-surface focus-visible:commerce-focus-ring"
                        href={`/san-pham/${row.productSlug}/`}
                        onClick={close}
                        prefetch={false}
                      >
                        <span
                          aria-hidden="true"
                          className="size-8 shrink-0 overflow-hidden rounded-[6px] bg-commerce-active-surface"
                        >
                          {row.thumbnailUrl ? (
                            // Catalog image URLs are content data; the native element avoids
                            // configuring a remote image host for chrome thumbnails.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img alt="" className="size-full object-cover" src={row.thumbnailUrl} />
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">{row.label}</span>
                        <span className="shrink-0 text-xs text-commerce-secondary">{row.count} quy cách</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-3 py-2 text-sm text-commerce-secondary">Nhóm này đang được cập nhật.</p>
              )}
            </section>

            <section aria-labelledby={`${panelId}-featured`} className="border-l border-commerce-border pl-5">
              <h2
                className="mb-2 text-xs font-bold uppercase tracking-[0.06em] text-commerce-secondary"
                id={`${panelId}-featured`}
              >
                Sản phẩm nổi bật
              </h2>
              {featured.length ? (
                <ul className="grid grid-cols-3 gap-3">
                  {featured.map((item) => (
                    <li className="commerce-card-surface overflow-hidden" key={item.productSlug}>
                      <Link
                        className="flex h-full flex-col focus-visible:commerce-focus-ring"
                        href={`/san-pham/${item.productSlug}/`}
                        onClick={close}
                        prefetch={false}
                      >
                        <span aria-hidden="true" className="block commerce-image-frame bg-commerce-active-surface">
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img alt="" className="size-full object-cover" src={item.imageUrl} />
                          ) : null}
                        </span>
                        <span className="flex flex-1 flex-col gap-1 p-3">
                          <span className="line-clamp-2 text-sm font-semibold text-commerce-body">{item.name}</span>
                          <span className="line-clamp-1 text-xs text-commerce-secondary">
                            {item.specificationLabel}
                          </span>
                          <span className="mt-auto text-base font-bold text-commerce-price">
                            Từ {formatVnd(item.price)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-commerce-secondary">Chưa có sản phẩm nổi bật cho nhóm này.</p>
              )}
            </section>
          </div>
        )}

        <ul className="mt-4 grid gap-3 border-t border-commerce-border pt-4 sm:grid-cols-2">
          {menu.callouts.map((callout) => (
            <li key={callout.href}>
              <Link
                className="flex h-full flex-col justify-center rounded-commerce-control bg-commerce-support-strip px-4 py-3 focus-visible:commerce-focus-ring"
                href={callout.href}
                onClick={close}
                prefetch={false}
              >
                <span className="text-sm font-bold text-commerce-brand-dark">{callout.title}</span>
                <span className="text-xs text-commerce-secondary">{callout.description}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
