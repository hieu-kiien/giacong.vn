"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { type KeyboardEvent, useRef, useState } from "react";

import { catalogHref } from "@/lib/catalog-query";
import type { CatalogCategory } from "@/types/catalog";
import type { StorefrontNavItem } from "@/components/storefront/navigation";

interface MobileNavDrawerProps {
  categories: CatalogCategory[];
  navItems: readonly StorefrontNavItem[];
}

/**
 * Mobile navigation. A native modal `<dialog>` gives the backdrop, inert
 * background and Escape-to-close for free; the Tab handler keeps focus inside on
 * browsers that do not yet constrain it, matching `ProductQuickPreview`.
 */
export function MobileNavDrawer({ categories, navItems }: MobileNavDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  function openDrawer() {
    setOpen(true);
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLButtonElement>("[data-drawer-close]")?.focus();
  }

  function closeDrawer() {
    setOpen(false);
    dialogRef.current?.close();
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function trapTab(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")]
      .filter((element) => !element.hidden && element.tabIndex >= 0);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <button
        aria-controls="storefront-mobile-nav"
        aria-expanded={open}
        className="flex size-11 items-center justify-center rounded-md text-white md:hidden focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
        onClick={openDrawer}
        ref={triggerRef}
        type="button"
      >
        <Menu aria-hidden="true" className="size-6" />
        <span className="sr-only">Mở menu</span>
      </button>
      <dialog
        aria-label="Điều hướng"
        className="m-0 h-dvh max-h-dvh w-[min(20rem,85vw)] max-w-none bg-white p-0 text-ink backdrop:bg-[rgba(16,24,40,0.48)]"
        onCancel={(event) => { event.preventDefault(); closeDrawer(); }}
        onKeyDown={trapTab}
        id="storefront-mobile-nav"
        ref={dialogRef}
      >
        <div className="grid h-full grid-rows-[auto_auto_1fr] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-hairline bg-brand-700 px-4 py-3">
            <span className="text-base font-bold text-white">Điều hướng</span>
            <button
              className="flex size-11 items-center justify-center rounded-md text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
              data-drawer-close
              onClick={closeDrawer}
              type="button"
            >
              <X aria-hidden="true" className="size-6" />
              <span className="sr-only">Đóng điều hướng</span>
            </button>
          </div>
          <nav aria-label="Điều hướng chính" className="px-2 py-3">
            <ul className="grid gap-0.5">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    className="flex min-h-11 items-center rounded-md px-3 text-sm font-bold text-ink hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    href={item.href}
                    onClick={closeDrawer}
                    prefetch={false}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {categories.length ? (
            <div className="border-t border-hairline px-2 py-3">
              <p className="px-3 pb-2 text-xs font-bold tracking-[0.06em] text-ink-soft uppercase">Danh mục sản phẩm</p>
              <ul className="grid gap-0.5">
                {categories.map((category) => (
                  <li key={category.id}>
                    <Link
                      className="flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-ink hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
                      href={catalogHref({ category: category.slug })}
                      onClick={closeDrawer}
                      prefetch={false}
                    >
                      {category.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
