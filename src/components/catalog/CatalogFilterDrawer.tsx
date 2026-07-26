"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useRef, useState } from "react";

interface CatalogFilterDrawerProps {
  activeFilterCount: number;
  children: ReactNode;
}

/**
 * Below the tablet breakpoint the filters move into a modal `<dialog>`, which
 * supplies the backdrop, inert background and Escape handling. There is no
 * "Áp dụng" button on purpose: filters commit as they change, matching the rest
 * of the catalog.
 */
export function CatalogFilterDrawer({ activeFilterCount, children }: CatalogFilterDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  function openDrawer() {
    setOpen(true);
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLButtonElement>("[data-filter-close]")?.focus();
  }

  function closeDrawer() {
    setOpen(false);
    dialogRef.current?.close();
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function trapTab(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), select:not([disabled]), input:not([disabled])")]
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
        aria-controls="catalog-filter-drawer"
        aria-expanded={open}
        className="flex min-h-11 items-center gap-2 rounded-md border border-brand-700 px-4 text-sm font-bold text-brand-800 lg:hidden focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
        onClick={openDrawer}
        ref={triggerRef}
        type="button"
      >
        <SlidersHorizontal aria-hidden="true" className="size-4" />
        Bộ lọc
        {activeFilterCount ? (
          <span className="inline-flex min-w-6 justify-center rounded-full bg-brand-700 px-1.5 text-white">{activeFilterCount}</span>
        ) : null}
      </button>
      <dialog
        aria-label="Bộ lọc sản phẩm"
        className="m-0 mt-auto max-h-[85dvh] w-full max-w-none rounded-t-xl bg-white p-0 text-ink backdrop:bg-[rgba(16,24,40,0.48)]"
        id="catalog-filter-drawer"
        onCancel={(event) => { event.preventDefault(); closeDrawer(); }}
        onKeyDown={trapTab}
        ref={dialogRef}
      >
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
          <h2 className="text-base font-bold text-brand-800">Bộ lọc sản phẩm</h2>
          <button
            className="flex size-11 items-center justify-center rounded-md text-ink-soft hover:text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
            data-filter-close
            onClick={closeDrawer}
            type="button"
          >
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Đóng bộ lọc</span>
          </button>
        </div>
        <div className="overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
      </dialog>
    </>
  );
}
