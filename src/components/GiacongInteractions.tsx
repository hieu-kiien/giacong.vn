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
    const slider = document.querySelector<HTMLElement>(".slider");
    const slides = slider ? Array.from(slider.querySelectorAll<HTMLElement>(":scope > .row")) : [];
    const generatedToggles: HTMLButtonElement[] = [];
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
      button.textContent = "+";
      item.prepend(button);
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

    const closeMenu = () => {
      menu?.classList.remove("clone-menu-open");
      trigger?.setAttribute("aria-expanded", "false");
    };
    const toggleMenu = (event: Event) => {
      event.preventDefault();
      menu?.classList.toggle("clone-menu-open");
      trigger?.setAttribute("aria-expanded", String(menu?.classList.contains("clone-menu-open")));
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
    trigger?.addEventListener("click", toggleMenu);
    document.addEventListener("click", handleSubmenu);
    document.querySelectorAll(".wpcf7-form").forEach((form) => form.addEventListener("submit", handleForm));
    showSlide(0);
    const timer = window.setInterval(() => showSlide(current + 1), 6000);

    return () => {
      trigger?.removeEventListener("click", toggleMenu);
      document.removeEventListener("click", handleSubmenu);
      document.querySelectorAll(".wpcf7-form").forEach((form) => form.removeEventListener("submit", handleForm));
      window.clearInterval(timer);
      generatedToggles.forEach((button) => button.remove());
      taxonomyShow?.removeEventListener("click", expandTaxonomy);
      taxonomyLess?.removeEventListener("click", collapseTaxonomy);
      taxonomyShow?.remove();
      taxonomyLess?.remove();
      taxonomy?.style.removeProperty("height");
      closeMenu();
      document.body.className = previousBodyClasses;
      document.documentElement.className = previousHtmlClasses;
    };
  }, [bodyClasses, htmlClasses]);

  return null;
}
