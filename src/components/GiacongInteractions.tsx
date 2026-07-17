"use client";

import { useEffect } from "react";

const sectionForLabel = (label: string) => {
  const normalized = label.toLowerCase();
  if (normalized.includes("home") || normalized.includes("trang chủ")) return ".section01";
  if (normalized.includes("về giacong")) return ".section02";
  if (normalized.includes("sản phẩm") || normalized.includes("dịch vụ")) return ".section03";
  if (normalized.includes("tin tức")) return ".section07";
  if (normalized.includes("liên hệ")) return ".section05";
  return null;
};

export function GiacongInteractions() {
  useEffect(() => {
    const menu = document.querySelector<HTMLElement>("#main-menu");
    const trigger = document.querySelector<HTMLElement>("[data-open='#main-menu']");
    const slider = document.querySelector<HTMLElement>(".slider");
    const slides = slider ? Array.from(slider.querySelectorAll<HTMLElement>(":scope > .row")) : [];
    let current = 0;

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
    const handleLink = (event: MouseEvent) => {
      const link = (event.target as Element).closest<HTMLAnchorElement>("a");
      if (!link) return;
      const href = link.getAttribute("href") ?? "";
      const isInternal = link.href.includes("giacong.vn") || href.startsWith("/") || href === "#";
      const target = sectionForLabel(link.textContent ?? "");
      if (!isInternal || !target) return;
      event.preventDefault();
      document.querySelector(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.querySelectorAll(".clone-active-link").forEach((item) => item.classList.remove("clone-active-link"));
      link.classList.add("clone-active-link");
      closeMenu();
    };

    trigger?.addEventListener("click", toggleMenu);
    document.addEventListener("click", handleLink);
    document.querySelectorAll(".wpcf7-form").forEach((form) => form.addEventListener("submit", handleForm));
    showSlide(0);
    const timer = window.setInterval(() => showSlide(current + 1), 6000);

    return () => {
      trigger?.removeEventListener("click", toggleMenu);
      document.removeEventListener("click", handleLink);
      document.querySelectorAll(".wpcf7-form").forEach((form) => form.removeEventListener("submit", handleForm));
      window.clearInterval(timer);
      closeMenu();
    };
  }, []);

  return null;
}
