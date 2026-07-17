"use client";

import { useEffect } from "react";

import {
  addMobileAccordionToggles,
  createMobileProductItem,
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
    const slider = document.querySelector<HTMLElement>(".slider");
    const slides = slider ? Array.from(slider.querySelectorAll<HTMLElement>(":scope > .row")) : [];
    const desktopMegaMenus = Array.from(
      document.querySelectorAll<HTMLElement>(
        "#header li.menu-item-design-container-width.menu-item-has-block.has-dropdown",
      ),
    );
    const headerWrapper = document.querySelector<HTMLElement>(".header-wrapper");
    const taxonomy = document.querySelector<HTMLElement>(".taxonomy-description");
    let taxonomyShow: HTMLDivElement | undefined;
    let taxonomyLess: HTMLDivElement | undefined;
    let current = 0;

    const generatedMobileProductItem = createMobileProductItem(
      menu,
      document.querySelector<HTMLElement>("#menu-item-1742"),
    );
    const restoreMobileMenuIcons = replaceMobileMenuIcons(menu);
    const generatedToggles = addMobileAccordionToggles(menu);
    const mobileSearchInput = menu?.querySelector<HTMLInputElement>(
      "input[type='search']",
    );
    let menuReturnFocus = trigger;

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
        closeMenu();
        return;
      }
      if (event.key !== "Tab" || !menu?.classList.contains("clone-menu-open")) return;
      const focusable = Array.from(
        menu.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || !menu.contains(document.activeElement))) {
        event.preventDefault();
        menuClose.focus();
      } else if (!event.shiftKey && document.activeElement === menuClose) {
        event.preventDefault();
        first.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        menuClose.focus();
      }
    };
    const showSlide = (index: number) => {
      if (slides.length < 2) return;
      current = (index + slides.length) % slides.length;
      slides.forEach((slide, slideIndex) => {
        slide.hidden = slideIndex !== current;
      });
    };
    const handleForm = (event: Event) => {
      const form = event.currentTarget as HTMLFormElement;
      event.preventDefault();
      form.dataset.status = "sent";
      const response = form.querySelector<HTMLElement>(".wpcf7-response-output");
      if (response) response.textContent = "Cảm ơn bạn. Chúng tôi sẽ liên hệ lại sớm nhất.";
    };
    const handleSubmenu = (event: Event) => {
      handleMobileAccordion(event, menu);
    };
    const positionMegaMenu = (item: HTMLElement) => {
      if (window.matchMedia("(max-width: 849px)").matches) return;
      const panel = item.querySelector<HTMLElement>(":scope > .nav-dropdown");
      const headerInner = item.closest<HTMLElement>(".header-inner");
      if (!panel || !headerInner) return;
      const itemRect = item.getBoundingClientRect();
      const headerRect = headerInner.getBoundingClientRect();
      const panelWidth = Math.min(1240, headerRect.width - 30);
      panel.style.width = `${panelWidth}px`;
      panel.style.setProperty(
        "left",
        `${headerRect.left + (headerRect.width - panelWidth) / 2 - itemRect.left}px`,
        "important",
      );
      panel.style.top = "55px";
    };
    const openMegaMenu = (item: HTMLElement) => {
      positionMegaMenu(item);
      item.classList.add("current-dropdown");
      item.querySelector<HTMLElement>(":scope > a")?.setAttribute("aria-expanded", "true");
    };
    const closeMegaMenu = (item: HTMLElement) => {
      item.classList.remove("clone-mega-menu-pinned", "current-dropdown");
      item.querySelector<HTMLElement>(":scope > a")?.setAttribute("aria-expanded", "false");
    };
    const closeAllMegaMenus = () => desktopMegaMenus.forEach(closeMegaMenu);
    const openExclusiveMegaMenu = (item: HTMLElement, pinned: boolean) => {
      desktopMegaMenus.filter((candidate) => candidate !== item).forEach(closeMegaMenu);
      if (pinned) item.classList.add("clone-mega-menu-pinned");
      openMegaMenu(item);
    };
    const desktopMenuListeners = desktopMegaMenus.map((item) => {
      const link = item.querySelector<HTMLElement>(":scope > a");
      const handleOpen = () => openExclusiveMegaMenu(item, false);
      const handleClose = () => {
        if (!item.classList.contains("clone-mega-menu-pinned")) closeMegaMenu(item);
      };
      const handleClick = (event: Event) => {
        if (window.matchMedia("(max-width: 849px)").matches) return;
        event.preventDefault();
        const wasPinned = item.classList.contains("clone-mega-menu-pinned");
        closeAllMegaMenus();
        if (!wasPinned) openExclusiveMegaMenu(item, true);
      };
      const handleFocusOut = (event: FocusEvent) => {
        if (!item.contains(event.relatedTarget as Node | null)) handleClose();
      };
      item.addEventListener("mouseenter", handleOpen);
      item.addEventListener("mouseleave", handleClose);
      item.addEventListener("focusin", handleOpen);
      item.addEventListener("focusout", handleFocusOut);
      link?.addEventListener("click", handleClick);
      return { item, link, handleOpen, handleClose, handleClick, handleFocusOut };
    });
    const handleDesktopMenuDocumentClick = (event: Event) => {
      if (desktopMegaMenus.some((item) => item.contains(event.target as Node))) return;
      closeAllMegaMenus();
    };
    const handleDesktopMenuKeydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeAllMegaMenus();
      if (
        document.activeElement instanceof HTMLElement
        && desktopMegaMenus.some((item) => item.contains(document.activeElement))
      ) {
        document.activeElement.blur();
      }
    };
    const updateStickyHeader = () => {
      headerWrapper?.classList.toggle("stuck", window.scrollY > 70);
    };
    const repositionOpenMegaMenus = () => {
      desktopMegaMenus
        .filter((item) => item.classList.contains("current-dropdown"))
        .forEach(positionMegaMenu);
    };
    trigger?.addEventListener("click", toggleMenu);
    headerSearchTrigger?.addEventListener("click", openMobileSearch);
    menuBackdrop.addEventListener("click", closeMenu);
    menuClose.addEventListener("click", closeMenu);
    document.addEventListener("click", handleSubmenu);
    document.addEventListener("click", handleDesktopMenuDocumentClick);
    document.addEventListener("keydown", handleMenuKeydown);
    document.addEventListener("keydown", handleDesktopMenuKeydown);
    window.addEventListener("scroll", updateStickyHeader, { passive: true });
    window.addEventListener("resize", repositionOpenMegaMenus);
    document.querySelectorAll(".wpcf7-form").forEach((form) => form.addEventListener("submit", handleForm));
    showSlide(0);
    updateStickyHeader();
    const timer = window.setInterval(() => showSlide(current + 1), 6000);

    return () => {
      trigger?.removeEventListener("click", toggleMenu);
      headerSearchTrigger?.removeEventListener("click", openMobileSearch);
      menuBackdrop.removeEventListener("click", closeMenu);
      menuClose.removeEventListener("click", closeMenu);
      document.removeEventListener("click", handleSubmenu);
      document.removeEventListener("click", handleDesktopMenuDocumentClick);
      document.removeEventListener("keydown", handleMenuKeydown);
      document.removeEventListener("keydown", handleDesktopMenuKeydown);
      window.removeEventListener("scroll", updateStickyHeader);
      window.removeEventListener("resize", repositionOpenMegaMenus);
      desktopMenuListeners.forEach(({
        item,
        link,
        handleOpen,
        handleClose,
        handleClick,
        handleFocusOut,
      }) => {
        item.removeEventListener("mouseenter", handleOpen);
        item.removeEventListener("mouseleave", handleClose);
        item.removeEventListener("focusin", handleOpen);
        item.removeEventListener("focusout", handleFocusOut);
        link?.removeEventListener("click", handleClick);
        closeMegaMenu(item);
        const panel = item.querySelector<HTMLElement>(":scope > .nav-dropdown");
        panel?.style.removeProperty("width");
        panel?.style.removeProperty("left");
        panel?.style.removeProperty("top");
      });
      document.querySelectorAll(".wpcf7-form").forEach((form) => form.removeEventListener("submit", handleForm));
      window.clearInterval(timer);
      generatedToggles.forEach((button) => button.remove());
      restoreMobileMenuIcons();
      generatedMobileProductItem?.remove();
      taxonomyShow?.removeEventListener("click", expandTaxonomy);
      taxonomyLess?.removeEventListener("click", collapseTaxonomy);
      taxonomyShow?.remove();
      taxonomyLess?.remove();
      taxonomy?.style.removeProperty("height");
      headerWrapper?.classList.remove("stuck");
      setMenuClosed(false);
      menuBackdrop.remove();
      menuClose.remove();
      document.body.className = previousBodyClasses;
      document.documentElement.className = previousHtmlClasses;
    };
  }, [bodyClasses, htmlClasses]);

  return null;
}
