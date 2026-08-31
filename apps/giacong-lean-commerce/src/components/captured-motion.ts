type MotionCleanup = () => void;

const noop: MotionCleanup = () => undefined;

export function connectCapturedMotion(root: ParentNode = document): MotionCleanup {
  const cleanups = [
    connectCapturedReveals(root),
    connectPageReveals(root),
    connectCapturedSliders(root),
  ];

  return () => cleanups.forEach((cleanup) => cleanup());
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

const PAGE_REVEAL_SELECTOR = [
  ".archive-page-header",
  ".giacong-page-hero",
  'section[aria-label="Điều khiển danh sách sản phẩm"]',
  "[data-catalog-category-nav]",
  "[data-catalog-view-toggle]",
  "[data-catalog-grid]",
  "[data-catalog-grid] > [data-catalog-card]",
  "[data-catalog-grid] ~ aside",
  ".managed-block",
  ".managed-feature-card",
  ".giacong-news-card",
  "[data-storefront-detail-main] > *",
].join(", ");

type PageRevealMode = "from-up" | "from-left" | "from-right" | "scale";

function connectPageReveals(root: ParentNode): MotionCleanup {
  const elements = Array.from(root.querySelectorAll<HTMLElement>(PAGE_REVEAL_SELECTOR)).filter(
    (element, index, all) =>
      all.indexOf(element) === index &&
      !element.matches("[data-animate], [data-page-reveal]") &&
      !element.closest("#header, #main-menu, .echbay-sms-messenger, .clone-menu-backdrop"),
  );
  if (elements.length === 0) return noop;

  const original = elements.map((element) => ({
    pageReveal: element.getAttribute("data-page-reveal"),
    pageRevealed: element.getAttribute("data-page-revealed"),
    delay: element.style.getPropertyValue("--page-reveal-delay"),
    delayPriority: element.style.getPropertyPriority("--page-reveal-delay"),
  }));
  const staggered = (element: HTMLElement) =>
    element.matches(
      "[data-catalog-grid] > [data-catalog-card], .managed-feature-card, .giacong-news-card",
    );

  elements.forEach((element, index) => {
    element.setAttribute("data-page-reveal", getPageRevealMode(element));
    if (staggered(element)) {
      const siblingIndex = Array.from(element.parentElement?.children ?? []).indexOf(element);
      element.style.setProperty(
        "--page-reveal-delay",
        `${Math.min(Math.max(siblingIndex, 0), 7) * 70}ms`,
      );
    } else if (index === 0) {
      element.style.setProperty("--page-reveal-delay", "0ms");
    }
  });

  const restore = () => {
    elements.forEach((element, index) => {
      restoreAttribute(element, "data-page-reveal", original[index].pageReveal);
      restoreAttribute(element, "data-page-revealed", original[index].pageRevealed);
      if (original[index].delay === "") element.style.removeProperty("--page-reveal-delay");
      else {
        element.style.setProperty(
          "--page-reveal-delay",
          original[index].delay,
          original[index].delayPriority,
        );
      }
    });
  };

  if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
    elements.forEach((element) => element.setAttribute("data-page-revealed", "true"));
    return restore;
  }

  const documentElement = document.documentElement;
  documentElement.classList.add("page-reveal-ready");
  elements.forEach((element) => element.removeAttribute("data-page-revealed"));
  elements.forEach((element) => element.getBoundingClientRect());

  const reveal = (element: HTMLElement) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (element.isConnected) element.setAttribute("data-page-revealed", "true");
      });
    });
  };
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const element = entry.target as HTMLElement;
        reveal(element);
        observer.unobserve(element);
      });
    },
    { rootMargin: "0px 0px -6% 0px", threshold: 0.05 },
  );

  let enableMotionFrame: number | undefined = window.requestAnimationFrame(() => {
    enableMotionFrame = window.requestAnimationFrame(() => {
      enableMotionFrame = undefined;
      if (!documentElement.classList.contains("page-reveal-ready")) return;
      documentElement.classList.add("page-reveal-motion");
      elements.forEach((element) => observer.observe(element));
    });
  });

  return () => {
    if (enableMotionFrame !== undefined) window.cancelAnimationFrame(enableMotionFrame);
    observer.disconnect();
    documentElement.classList.remove("page-reveal-ready", "page-reveal-motion");
    restore();
  };
}

function getPageRevealMode(element: HTMLElement): PageRevealMode {
  if (element.matches(".archive-page-header, .giacong-page-hero")) return "from-left";
  if (
    element.matches(
      "[data-catalog-grid] > [data-catalog-card], .managed-feature-card, .giacong-news-card",
    )
  ) {
    return "scale";
  }
  if (element.matches("[data-catalog-view-toggle]")) return "from-right";
  return "from-up";
}

function connectCapturedReveals(root: ParentNode): MotionCleanup {
  const elements = Array.from(root.querySelectorAll<HTMLElement>("[data-animate]"));
  if (elements.length === 0) return noop;

  const original = elements.map((element) => element.getAttribute("data-animated"));
  const reveal = (element: HTMLElement) => element.setAttribute("data-animated", "true");

  if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
    elements.forEach(reveal);
    return () => elements.forEach((element, index) => {
      restoreAttribute(element, "data-animated", original[index]);
    });
  }

  elements.forEach((element) => element.removeAttribute("data-animated"));
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const element = entry.target as HTMLElement;
        reveal(element);
        observer.unobserve(element);
      });
    },
    { rootMargin: "0px", threshold: 0.05 },
  );
  elements.forEach((element) => observer.observe(element));

  return () => {
    observer.disconnect();
    elements.forEach((element, index) => {
      restoreAttribute(element, "data-animated", original[index]);
    });
  };
}

function connectCapturedSliders(root: ParentNode): MotionCleanup {
  const cleanups = Array.from(root.querySelectorAll<HTMLElement>(".slider")).map((slider) =>
    connectCapturedSlider(slider),
  );
  return () => cleanups.forEach((cleanup) => cleanup());
}

function connectCapturedSlider(slider: HTMLElement): MotionCleanup {
  const slides = Array.from(slider.querySelectorAll<HTMLElement>(":scope > .row"));
  if (slides.length < 2) return noop;

  const reducedMotion = prefersReducedMotion();
  const originalHeight = slider.style.height;
  const originalAriaLive = slider.getAttribute("aria-live");
  const originalIndex = slider.getAttribute("data-clone-slider-index");
  const originalReady = slider.classList.contains("clone-slider-ready");
  const originalSlideStyles = slides.map((slide) => ({
    hidden: slide.hidden,
    left: slide.style.left,
    position: slide.style.position,
    top: slide.style.top,
    transform: slide.style.transform,
    transition: slide.style.transition,
    width: slide.style.width,
  }));
  slides.forEach((slide) => {
    slide.hidden = false;
  });
  const naturalHeight = Math.max(
    ...slides.map((slide) =>
      Math.ceil(Math.max(slide.getBoundingClientRect().height, slide.scrollHeight, slide.offsetHeight)),
    ),
    1,
  );
  const createdDots = !slider.querySelector(":scope > .flickity-page-dots");
  const dots = createSliderDots(slider, slides.length);
  const dotHandlers: Array<{ dot: HTMLButtonElement; handler: () => void }> = [];
  let current = 0;
  let paused = false;
  let pointerStartX: number | undefined;

  slider.classList.add("clone-slider-ready");
  slider.setAttribute("aria-live", "polite");
  slider.setAttribute("data-clone-slider-index", "0");
  slider.style.height = naturalHeight + "px";

  const updateHeight = () => {
    const height = Math.ceil(
      Math.max(
        slides[current].getBoundingClientRect().height,
        slides[current].scrollHeight,
        slides[current].offsetHeight,
      ),
    );
    if (height > 0) slider.style.height = height + "px";
  };
  slides.forEach((slide, index) => {
    slide.style.left = "0";
    slide.style.position = "absolute";
    slide.style.top = "0";
    slide.style.transform = `translate3d(${index * 100}%, 0, 0)`;
    slide.style.transition = reducedMotion
      ? "none"
      : "transform .6s cubic-bezier(.25,.46,.45,.94)";
    slide.style.width = "100%";
  });

  const render = (index: number) => {
    current = (index + slides.length) % slides.length;
    slider.setAttribute("data-clone-slider-index", String(current));
    updateHeight();
    slides.forEach((slide, slideIndex) => {
      slide.style.transform = `translate3d(${(slideIndex - current) * 100}%, 0, 0)`;
    });
    dots?.querySelectorAll<HTMLButtonElement>("button").forEach((dot, dotIndex) => {
      const selected = dotIndex === current;
      dot.classList.toggle("is-selected", selected);
      dot.setAttribute("aria-current", selected ? "true" : "false");
    });
  };
  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointerStartX = event.clientX;
  };
  const onPointerUp = (event: PointerEvent) => {
    if (pointerStartX === undefined) return;
    const delta = event.clientX - pointerStartX;
    pointerStartX = undefined;
    if (Math.abs(delta) < 10) return;
    render(current + (delta < 0 ? 1 : -1));
  };
  const onMouseEnter = () => { paused = true; };
  const onMouseLeave = () => { paused = false; };
  const onFocusIn = () => { paused = true; };
  const onFocusOut = (event: FocusEvent) => {
    if (!slider.contains(event.relatedTarget as Node | null)) paused = false;
  };

  dots?.querySelectorAll<HTMLButtonElement>("button").forEach((dot, dotIndex) => {
    const handler = () => render(dotIndex);
    dot.addEventListener("click", handler);
    dotHandlers.push({ dot, handler });
  });
  slider.addEventListener("pointerdown", onPointerDown);
  slider.addEventListener("pointerup", onPointerUp);
  slider.addEventListener("mouseenter", onMouseEnter);
  slider.addEventListener("mouseleave", onMouseLeave);
  slider.addEventListener("focusin", onFocusIn);
  slider.addEventListener("focusout", onFocusOut);
  const resizeObserver =
    typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(updateHeight);
  slides.forEach((slide) => resizeObserver?.observe(slide));
  render(0);

  const timer = reducedMotion
    ? undefined
    : window.setInterval(() => {
        if (!paused) render(current + 1);
      }, 6000);

  return () => {
    if (timer !== undefined) window.clearInterval(timer);
    slider.removeEventListener("pointerdown", onPointerDown);
    slider.removeEventListener("pointerup", onPointerUp);
    slider.removeEventListener("mouseenter", onMouseEnter);
    slider.removeEventListener("mouseleave", onMouseLeave);
    slider.removeEventListener("focusin", onFocusIn);
    slider.removeEventListener("focusout", onFocusOut);
    dotHandlers.forEach(({ dot, handler }) => dot.removeEventListener("click", handler));
    resizeObserver?.disconnect();
    slides.forEach((slide, index) => {
      const original = originalSlideStyles[index];
      slide.hidden = original.hidden;
      slide.style.left = original.left;
      slide.style.position = original.position;
      slide.style.top = original.top;
      slide.style.transform = original.transform;
      slide.style.transition = original.transition;
      slide.style.width = original.width;
    });
    slider.style.height = originalHeight;
    if (!originalReady) slider.classList.remove("clone-slider-ready");
    restoreAttribute(slider, "aria-live", originalAriaLive);
    restoreAttribute(slider, "data-clone-slider-index", originalIndex);
    if (createdDots) dots?.remove();
  };
}

function createSliderDots(slider: HTMLElement, count: number): HTMLOListElement | null {
  const existing = slider.querySelector<HTMLOListElement>(":scope > .flickity-page-dots");
  if (existing) return existing;

  const dots = document.createElement("ol");
  dots.className = "flickity-page-dots clone-slider-dots";
  dots.setAttribute("aria-label", "Chuyển nội dung");
  for (let index = 0; index < count; index += 1) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dot";
    button.setAttribute("aria-label", "Nội dung " + (index + 1));
    button.setAttribute("aria-current", index === 0 ? "true" : "false");
    item.append(button);
    dots.append(item);
  }
  slider.append(dots);
  return dots;
}

function restoreAttribute(element: HTMLElement, name: string, value: string | null): void {
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}
