"use client";

import { useEffect } from "react";

export function GiacongInteractions() {
  useEffect(() => {
    const menu = document.querySelector<HTMLElement>("#main-menu");
    const trigger = document.querySelector<HTMLElement>("[data-open='#main-menu']");
    const slider = document.querySelector<HTMLElement>(".slider");
    const slides = slider ? Array.from(slider.querySelectorAll<HTMLElement>(":scope > .row")) : [];
    const generatedToggles: HTMLButtonElement[] = [];
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

    const closeMenu = () => menu?.classList.remove("clone-menu-open");
    const toggleMenu = (event: Event) => {
      event.preventDefault();
      menu?.classList.toggle("clone-menu-open");
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
      closeMenu();
    };
  }, []);

  return null;
}
