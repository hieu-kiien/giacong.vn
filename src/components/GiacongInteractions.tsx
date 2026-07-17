"use client";

import { useEffect } from "react";

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
    const generatedToggles: HTMLButtonElement[] = [];
    const desktopMegaMenus = Array.from(
      document.querySelectorAll<HTMLElement>(
        "#header li.menu-item-design-container-width.menu-item-has-block.has-dropdown",
      ),
    );
    const taxonomy = document.querySelector<HTMLElement>(".taxonomy-description");
    let taxonomyShow: HTMLDivElement | undefined;
    let taxonomyLess: HTMLDivElement | undefined;
    let current = 0;

    menu?.querySelectorAll<HTMLElement>("li.menu-item-has-children, li.has-dropdown").forEach((item) => {
      if (item.querySelector(":scope > button.toggle")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "toggle clone-toggle";
      button.setAttribute("aria-label", "Mở menu con");
      button.setAttribute("aria-expanded", "false");
      button.innerHTML = '<i aria-hidden="true" class="icon-angle-down"></i>';
      item.append(button);
      generatedToggles.push(button);
    });

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
      if (restoreFocus) trigger?.focus();
    };
    const closeMenu = () => setMenuClosed(true);
    const toggleMenu = (event: Event) => {
      event.preventDefault();
      if (menu?.classList.contains("clone-menu-open")) {
        closeMenu();
        return;
      }
      menu?.classList.add("clone-menu-open");
      menuBackdrop.classList.add("clone-menu-backdrop-open");
      document.body.classList.add("clone-menu-active");
      trigger?.setAttribute("aria-expanded", "true");
      menuClose.focus();
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
      const button = (event.target as Element).closest<HTMLButtonElement>("button.toggle");
      if (!button) return;
      event.preventDefault();
      const item = button.closest<HTMLElement>("li.menu-item-has-children, li.has-dropdown");
      item?.classList.toggle("clone-submenu-open");
      button.setAttribute("aria-expanded", String(item?.classList.contains("clone-submenu-open")));
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
      item.classList.remove("current-dropdown");
      item.querySelector<HTMLElement>(":scope > a")?.setAttribute("aria-expanded", "false");
    };
    const desktopMenuListeners = desktopMegaMenus.map((item) => {
      const handleOpen = () => openMegaMenu(item);
      const handleClose = () => closeMegaMenu(item);
      const handleFocusOut = (event: FocusEvent) => {
        if (!item.contains(event.relatedTarget as Node | null)) handleClose();
      };
      item.addEventListener("mouseenter", handleOpen);
      item.addEventListener("mouseleave", handleClose);
      item.addEventListener("focusin", handleOpen);
      item.addEventListener("focusout", handleFocusOut);
      return { item, handleOpen, handleClose, handleFocusOut };
    });
    const repositionOpenMegaMenus = () => {
      desktopMegaMenus
        .filter((item) => item.classList.contains("current-dropdown"))
        .forEach(positionMegaMenu);
    };
    trigger?.addEventListener("click", toggleMenu);
    menuBackdrop.addEventListener("click", closeMenu);
    menuClose.addEventListener("click", closeMenu);
    document.addEventListener("click", handleSubmenu);
    document.addEventListener("keydown", handleMenuKeydown);
    window.addEventListener("resize", repositionOpenMegaMenus);
    document.querySelectorAll(".wpcf7-form").forEach((form) => form.addEventListener("submit", handleForm));
    showSlide(0);
    const timer = window.setInterval(() => showSlide(current + 1), 6000);

    return () => {
      trigger?.removeEventListener("click", toggleMenu);
      menuBackdrop.removeEventListener("click", closeMenu);
      menuClose.removeEventListener("click", closeMenu);
      document.removeEventListener("click", handleSubmenu);
      document.removeEventListener("keydown", handleMenuKeydown);
      window.removeEventListener("resize", repositionOpenMegaMenus);
      desktopMenuListeners.forEach(({
        item,
        handleOpen,
        handleClose,
        handleFocusOut,
      }) => {
        item.removeEventListener("mouseenter", handleOpen);
        item.removeEventListener("mouseleave", handleClose);
        item.removeEventListener("focusin", handleOpen);
        item.removeEventListener("focusout", handleFocusOut);
        closeMegaMenu(item);
        const panel = item.querySelector<HTMLElement>(":scope > .nav-dropdown");
        panel?.style.removeProperty("width");
        panel?.style.removeProperty("left");
        panel?.style.removeProperty("top");
      });
      document.querySelectorAll(".wpcf7-form").forEach((form) => form.removeEventListener("submit", handleForm));
      window.clearInterval(timer);
      generatedToggles.forEach((button) => button.remove());
      taxonomyShow?.removeEventListener("click", expandTaxonomy);
      taxonomyLess?.removeEventListener("click", collapseTaxonomy);
      taxonomyShow?.remove();
      taxonomyLess?.remove();
      taxonomy?.style.removeProperty("height");
      setMenuClosed(false);
      menuBackdrop.remove();
      menuClose.remove();
      document.body.className = previousBodyClasses;
      document.documentElement.className = previousHtmlClasses;
    };
  }, [bodyClasses, htmlClasses]);

  return null;
}
