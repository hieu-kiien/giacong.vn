"use client";

import Link from "next/link";
import { ChevronDown, Menu, Phone, X } from "lucide-react";
import { type KeyboardEvent, useRef, useState } from "react";

import { CommerceIcon } from "@/components/commerce/CommerceIcon";
import {
  COMMERCE_B2B_CALLOUTS,
  COMMERCE_HOTLINE,
  COMMERCE_HOTLINE_HREF,
  COMMERCE_NAV_ITEMS,
  COMMERCE_QUOTE_LABEL,
  COMMERCE_REQUEST_HREF,
} from "@/components/commerce/commerce-navigation";
import type { CommerceMegaMenuModel } from "@/components/commerce/commerce-navigation";
import { catalogHref } from "@/lib/catalog-query";

interface MobileCommerceNavProps {
  menu: CommerceMegaMenuModel;
}

/**
 * Compact navigation below the desktop breakpoint.
 *
 * A native modal `<dialog>` supplies the backdrop, the inert background and
 * Escape-to-close; the Tab handler keeps focus inside on browsers that do not yet
 * constrain it, matching the pattern the catalog preview already uses.
 *
 * The category groups are disclosures rather than a flat list, so the drawer shows
 * the same real routes the desktop panel does without becoming a long scroll. Each
 * row clears the 44 px target.
 */
export function MobileCommerceNav({ menu }: MobileCommerceNavProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  /**
   * Which category group is expanded. The first group starts open so the drawer
   * lands on reachable catalog links instead of on a wall of collapsed rows.
   */
  const [expandedSlug, setExpandedSlug] = useState<string | null>(menu.categories[0]?.slug ?? null);

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
    // After the dialog releases focus, so the trigger keeps it.
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function trapTab(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const focusable = [
      ...event.currentTarget.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input"),
    ].filter((element) => !element.hidden && element.tabIndex >= 0);
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
        aria-expanded={open}
        className="flex commerce-target items-center justify-center rounded-commerce-control text-white lg:hidden focus-visible:commerce-focus-ring"
        onClick={openDrawer}
        ref={triggerRef}
        type="button"
      >
        <CommerceIcon icon={Menu} size="lg" />
        <span className="sr-only">Mở menu</span>
      </button>

      <dialog
        aria-label="Điều hướng"
        className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-dvh w-[min(340px,88vw)] max-w-none bg-white p-0 text-commerce-body backdrop:bg-[rgb(0_0_0/48%)]"
        onCancel={(event) => {
          // Prevented so the close path is the same one the button and backdrop use.
          event.preventDefault();
          closeDrawer();
        }}
        onKeyDown={trapTab}
        ref={dialogRef}
      >
        <div className="flex h-full flex-col overflow-y-auto overscroll-contain">
          <div className="flex items-center justify-between gap-2 bg-commerce-brand px-3 py-2">
            <span className="text-base font-bold text-white">Điều hướng</span>
            <button
              className="flex commerce-target items-center justify-center rounded-commerce-control text-white focus-visible:commerce-focus-ring"
              data-drawer-close
              onClick={closeDrawer}
              type="button"
            >
              <CommerceIcon icon={X} size="lg" />
              <span className="sr-only">Đóng điều hướng</span>
            </button>
          </div>

          <nav aria-label="Điều hướng chính" className="px-2 py-2">
            <ul className="grid gap-0.5">
              {COMMERCE_NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link
                    className="flex commerce-target items-center rounded-commerce-control px-3 text-sm font-bold text-commerce-body hover:bg-commerce-active-surface focus-visible:commerce-focus-ring"
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

          {menu.categories.length ? (
            <div className="border-t border-commerce-border px-2 py-2">
              <p className="px-3 pb-1 text-xs font-bold uppercase tracking-[0.06em] text-commerce-secondary">
                Danh mục sản phẩm
              </p>
              <ul className="grid gap-0.5">
                {menu.categories.map((category) => {
                  const isExpanded = category.slug === expandedSlug;
                  return (
                    <li key={category.slug}>
                      {/*
                        The row is split: the label navigates to the filtered catalog
                        and the chevron expands the group, so neither action hides
                        the other behind a single tap target.
                      */}
                      <div className="flex items-center gap-1">
                        <Link
                          className="flex commerce-target flex-1 items-center rounded-commerce-control px-3 text-sm font-semibold text-commerce-body hover:bg-commerce-active-surface focus-visible:commerce-focus-ring"
                          href={catalogHref({ category: category.slug })}
                          onClick={closeDrawer}
                          prefetch={false}
                        >
                          {category.label}
                        </Link>
                        {category.subcategories.length ? (
                          <button
                            aria-expanded={isExpanded}
                            className="flex commerce-target items-center justify-center rounded-commerce-control text-commerce-secondary hover:bg-commerce-active-surface focus-visible:commerce-focus-ring"
                            onClick={() => setExpandedSlug(isExpanded ? null : category.slug)}
                            type="button"
                          >
                            <ChevronDown
                              aria-hidden="true"
                              className={`size-5 transition-transform motion-reduce:transition-none ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            />
                            <span className="sr-only">
                              {isExpanded ? "Thu gọn" : "Mở rộng"} {category.label}
                            </span>
                          </button>
                        ) : null}
                      </div>
                      {isExpanded && category.subcategories.length ? (
                        <ul className="mb-1 grid gap-0.5 border-l-3 border-l-commerce-brand pl-2">
                          {category.subcategories.map((row) => (
                            <li key={row.productSlug}>
                              <Link
                                className="flex commerce-target items-center rounded-commerce-control px-3 text-sm text-commerce-body hover:bg-commerce-active-surface focus-visible:commerce-focus-ring"
                                href={`/san-pham/${row.productSlug}/`}
                                onClick={closeDrawer}
                                prefetch={false}
                              >
                                <span className="truncate">{row.label}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <div className="mt-auto grid gap-2 border-t border-commerce-border p-3">
            <a
              className="flex commerce-target items-center gap-2 rounded-commerce-control px-3 text-sm font-bold text-commerce-brand-dark hover:bg-commerce-active-surface focus-visible:commerce-focus-ring"
              href={COMMERCE_HOTLINE_HREF}
            >
              <CommerceIcon icon={Phone} size="sm" />
              {COMMERCE_HOTLINE}
            </a>
            <Link
              className="flex commerce-target items-center justify-center rounded-commerce-control bg-commerce-brand px-4 text-sm font-bold text-white hover:bg-commerce-brand-dark focus-visible:commerce-focus-ring"
              href={COMMERCE_REQUEST_HREF}
              onClick={closeDrawer}
              prefetch={false}
            >
              {COMMERCE_QUOTE_LABEL}
            </Link>
            {COMMERCE_B2B_CALLOUTS.map((callout) => (
              <Link
                className="rounded-commerce-control bg-commerce-support-strip px-3 py-2 focus-visible:commerce-focus-ring"
                href={callout.href}
                key={callout.href}
                onClick={closeDrawer}
                prefetch={false}
              >
                <span className="block text-sm font-bold text-commerce-brand-dark">{callout.title}</span>
                <span className="block text-xs text-commerce-secondary">{callout.description}</span>
              </Link>
            ))}
          </div>
        </div>
      </dialog>
    </>
  );
}
