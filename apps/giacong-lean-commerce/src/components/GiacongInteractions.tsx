"use client";

import { useEffect } from "react";

import { connectContactForms } from "@/components/contact-form";
import { connectCapturedMotion } from "@/components/captured-motion";
import {
  resolveDesktopDropdownEscapeTarget,
  type EscapeActiveElement,
} from "@/lib/desktop-dropdown-escape";
import {
  addMobileAccordionToggles,
  handleMobileAccordion,
  replaceMobileMenuIcons,
} from "@/components/mobile-navigation";

interface GiacongInteractionsProps {
  bodyClasses: string;
  htmlClasses: string;
}

export function GiacongInteractions({
  bodyClasses,
  htmlClasses,
}: GiacongInteractionsProps) {
  useEffect(() => {
    const previousBodyClasses = document.body.className;
    const previousHtmlClasses = document.documentElement.className;
    document.body.className = bodyClasses;
    document.documentElement.className = htmlClasses;

    const menu = document.querySelector<HTMLElement>("#main-menu");
    const trigger = document.querySelector<HTMLElement>("[data-open='#main-menu']");
    const headerSearchTrigger = document.querySelector<HTMLElement>(
      ".mobile-nav.nav-right .header-search > a",
    );
    const menuBackdrop = document.createElement("button");
    menuBackdrop.type = "button";
    menuBackdrop.className = "clone-menu-backdrop";
    menuBackdrop.setAttribute("aria-label", "Đóng menu");
    document.body.append(menuBackdrop);
    const menuClose = document.createElement("button");
    menuClose.type = "button";
    menuClose.className = "clone-menu-close";
    menuClose.setAttribute("aria-label", "Đóng menu");
    menuClose.innerHTML = [
      '<svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24"',
      ' fill="none" stroke="currentColor" stroke-width="2"',
      ' stroke-linecap="round" stroke-linejoin="round">',
      '<line x1="18" y1="6" x2="6" y2="18"></line>',
      '<line x1="6" y1="6" x2="18" y2="18"></line>',
      "</svg>",
    ].join("");
    document.body.append(menuClose);
    const headerWrapper = document.querySelector<HTMLElement>(".header-wrapper");
    const taxonomy = document.querySelector<HTMLElement>(".taxonomy-description");
    let taxonomyShow: HTMLDivElement | undefined;
    let taxonomyLess: HTMLDivElement | undefined;

    const restoreMobileMenuIcons = replaceMobileMenuIcons(menu);
    const generatedToggles = addMobileAccordionToggles(menu);
    const disconnectContactForms = connectContactForms();
    const disconnectCapturedMotion = connectCapturedMotion();
    const mobileSearchInput = menu?.querySelector<HTMLInputElement>(
      "input[type='search']",
    );
    let menuReturnFocus = trigger;
    const desktopDropdownItems = Array.from(
      document.querySelectorAll<HTMLElement>("#header ul.header-nav-main > li.has-dropdown"),
    );
    const clearDesktopDropdownDismissal = (event: Event) => {
      (event.currentTarget as HTMLElement | null)?.removeAttribute("data-dropdown-dismissed");
    };
    desktopDropdownItems.forEach((item) => {
      item.addEventListener("pointerover", clearDesktopDropdownDismissal);
      item.addEventListener("focusin", clearDesktopDropdownDismissal);
    });

    headerSearchTrigger?.setAttribute("aria-controls", "main-menu");
    headerSearchTrigger?.setAttribute("aria-expanded", "false");

    const collapseTaxonomy = (event?: Event) => {
      event?.preventDefault();
      if (!taxonomy || !taxonomyShow || !taxonomyLess) return;
      taxonomy.style.height = "300px";
      taxonomyShow.style.display = "block";
      taxonomyLess.style.display = "none";
    };
    const expandTaxonomy = (event: Event) => {
      event.preventDefault();
      if (!taxonomy || !taxonomyShow || !taxonomyLess) return;
      taxonomy.style.height = "auto";
      taxonomyShow.style.display = "none";
      taxonomyLess.style.display = "block";
    };
    if (taxonomy && taxonomy.scrollHeight > 300) {
      taxonomyShow = document.createElement("div");
      taxonomyShow.className = "giuseart_readmore_taxonomy_flatsome giuseart_readmore_taxonomy_flatsome_show";
      taxonomyShow.innerHTML = '<a title="Xem thêm" href="#">Xem thêm</a>';
      taxonomyLess = document.createElement("div");
      taxonomyLess.className = "giuseart_readmore_taxonomy_flatsome giuseart_readmore_taxonomy_flatsome_less";
      taxonomyLess.innerHTML = '<a title="Thu gọn" href="#">Thu gọn</a>';
      taxonomy.append(taxonomyShow, taxonomyLess);
      taxonomyShow.addEventListener("click", expandTaxonomy);
      taxonomyLess.addEventListener("click", collapseTaxonomy);
      collapseTaxonomy();
    }

    const setMenuClosed = (restoreFocus: boolean) => {
      menu?.classList.remove("clone-menu-open");
      menuBackdrop.classList.remove("clone-menu-backdrop-open");
      document.body.classList.remove("clone-menu-active");
      trigger?.setAttribute("aria-expanded", "false");
      headerSearchTrigger?.setAttribute("aria-expanded", "false");
      if (restoreFocus) menuReturnFocus?.focus();
    };
    const closeMenu = () => setMenuClosed(true);
    const openMenu = (returnFocus: HTMLElement | null, focusTarget: HTMLElement | null) => {
      menuReturnFocus = returnFocus;
      menu?.classList.add("clone-menu-open");
      menuBackdrop.classList.add("clone-menu-backdrop-open");
      document.body.classList.add("clone-menu-active");
      trigger?.setAttribute("aria-expanded", "true");
      headerSearchTrigger?.setAttribute("aria-expanded", "true");
      focusTarget?.focus();
    };
    const toggleMenu = (event: Event) => {
      event.preventDefault();
      if (menu?.classList.contains("clone-menu-open")) {
        closeMenu();
        return;
      }
      openMenu(trigger, menuClose);
    };
    const openMobileSearch = (event: Event) => {
      event.preventDefault();
      openMenu(headerSearchTrigger, mobileSearchInput ?? null);
      mobileSearchInput?.select();
    };
    const handleMenuKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!menu?.classList.contains("clone-menu-open")) {
          const outcome = resolveDesktopDropdownEscapeTarget(
            document.activeElement as unknown as EscapeActiveElement | null,
            (dropdown) =>
              window.getComputedStyle(dropdown as unknown as Element).visibility === "visible",
          );
          if (outcome.action === "focus") {
            outcome.element.focus();
            queueMicrotask(() => {
              (outcome.element as unknown as HTMLElement)
                .closest<HTMLElement>("ul.header-nav-main > li")
                ?.setAttribute("data-dropdown-dismissed", "true");
            });
            return;
          }
          if (outcome.action === "blur") {
            outcome.element.blur();
            queueMicrotask(() => {
              (outcome.element as unknown as HTMLElement)
                .closest<HTMLElement>("ul.header-nav-main > li")
                ?.setAttribute("data-dropdown-dismissed", "true");
            });
            return;
          }
        }
        closeMenu();
        return;
      }
      if (event.key !== "Tab" || !menu?.classList.contains("clone-menu-open")) return;
      const focusable = [
        menuClose,
        ...Array.from(
          menu.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ),
      ].filter(
        (element) =>
          element.getClientRects().length > 0 &&
          window.getComputedStyle(element).display !== "none" &&
          window.getComputedStyle(element).visibility !== "hidden",
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!menu.contains(document.activeElement) && document.activeElement !== menuClose) {
        event.preventDefault();
        first.focus();
      }
    };
    const handleSubmenu = (event: Event) => {
      handleMobileAccordion(event, menu);
    };
    const updateStickyHeader = () => {
      headerWrapper?.classList.toggle("stuck", window.scrollY > 70);
    };
    trigger?.addEventListener("click", toggleMenu);
    headerSearchTrigger?.addEventListener("click", openMobileSearch);
    menuBackdrop.addEventListener("click", closeMenu);
    menuClose.addEventListener("click", closeMenu);
    document.addEventListener("click", handleSubmenu);
    document.addEventListener("keydown", handleMenuKeydown);
    window.addEventListener("scroll", updateStickyHeader, { passive: true });
    updateStickyHeader();

    return () => {
      trigger?.removeEventListener("click", toggleMenu);
      headerSearchTrigger?.removeEventListener("click", openMobileSearch);
      menuBackdrop.removeEventListener("click", closeMenu);
      menuClose.removeEventListener("click", closeMenu);
      document.removeEventListener("click", handleSubmenu);
      document.removeEventListener("keydown", handleMenuKeydown);
      window.removeEventListener("scroll", updateStickyHeader);
      disconnectContactForms();
      disconnectCapturedMotion();
      generatedToggles.forEach((button) => button.remove());
      restoreMobileMenuIcons();
      taxonomyShow?.removeEventListener("click", expandTaxonomy);
      taxonomyLess?.removeEventListener("click", collapseTaxonomy);
      taxonomyShow?.remove();
      taxonomyLess?.remove();
      taxonomy?.style.removeProperty("height");
      headerWrapper?.classList.remove("stuck");
      desktopDropdownItems.forEach((item) => {
        item.removeEventListener("pointerover", clearDesktopDropdownDismissal);
        item.removeEventListener("focusin", clearDesktopDropdownDismissal);
        item.removeAttribute("data-dropdown-dismissed");
      });
      setMenuClosed(false);
      menuBackdrop.remove();
      menuClose.remove();
      document.body.className = previousBodyClasses;
      document.documentElement.className = previousHtmlClasses;
    };
  }, [bodyClasses, htmlClasses]);

  return null;
}
