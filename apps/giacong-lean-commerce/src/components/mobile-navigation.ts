const svgNamespace = "http://www.w3.org/2000/svg";

const mobileMenuIcons = [
  {
    selector: "#menu-item-5465",
    paths: [
      '<path d="m3 10.5 9-7.5 9 7.5"/>',
      '<path d="M5 9.5V21h14V9.5"/>',
      '<path d="M9 21v-6h6v6"/>',
    ],
  },
  {
    selector: "#menu-item-5496",
    paths: [
      '<circle cx="12" cy="12" r="9"/>',
      '<path d="M12 11v6"/>',
      '<path d="M12 7.5h.01"/>',
    ],
  },
  {
    selector: ".clone-mobile-products",
    paths: [
      '<path d="m3 6 9-4 9 4-9 4Z"/>',
      '<path d="m3 6 9 4 9-4v12l-9 4-9-4Z"/>',
      '<path d="M12 10v12"/>',
    ],
  },
  {
    selector: "#menu-item-5466",
    paths: [
      '<circle cx="12" cy="12" r="3"/>',
      '<path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.97 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.52-1H3v-4h.08A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8.97 4.6 1.7 1.7 0 0 0 10 3.08V3h4v.08a1.7 1.7 0 0 0 1.03 1.52 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9 1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/>',
    ],
  },
  {
    selector: "#menu-item-5477",
    paths: [
      '<rect x="3" y="4" width="18" height="16" rx="2"/>',
      '<path d="M7 8h6"/>',
      '<path d="M7 12h10"/>',
      '<path d="M7 16h10"/>',
      '<path d="M17 8h.01"/>',
    ],
  },
  {
    selector: "#menu-item-5478",
    paths: [
      '<rect x="3" y="5" width="18" height="14" rx="2"/>',
      '<path d="m3 7 9 6 9-6"/>',
    ],
  },
] as const;

function createMobileMenuIcon(paths: readonly string[]) {
  const icon = document.createElementNS(svgNamespace, "svg");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("class", "clone-mobile-menu-icon");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.setAttribute("stroke-width", "1.8");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.innerHTML = paths.join("");
  return icon;
}

function setAccordionExpanded(item: HTMLElement, expanded: boolean) {
  item.classList.toggle("clone-submenu-open", expanded);
  const toggle = item.querySelector<HTMLButtonElement>(":scope > button.toggle");
  toggle?.setAttribute("aria-expanded", String(expanded));
  toggle?.setAttribute("aria-label", expanded ? "Đóng menu con" : "Mở menu con");
  item
    .querySelector<HTMLElement>(":scope > .sub-menu")
    ?.setAttribute("aria-hidden", String(!expanded));
}

export function createMobileProductItem(
  menu: HTMLElement | null,
  desktopProductItem: HTMLElement | null,
) {
  const navigation = menu?.querySelector<HTMLElement>(
    ":scope > .sidebar-menu > .nav-sidebar",
  );
  const serviceItem = navigation?.querySelector<HTMLElement>("#menu-item-5466");
  if (!navigation || !serviceItem || !desktopProductItem) return undefined;

  const productItem = document.createElement("li");
  productItem.className = "menu-item has-icon-left clone-mobile-products";

  const productLink = document.createElement("a");
  productLink.href = "/san-pham/";
  const sourceIcon = desktopProductItem.querySelector<HTMLImageElement>(
    ":scope > a > .ux-menu-icon",
  );
  if (sourceIcon) {
    const icon = sourceIcon.cloneNode(true) as HTMLImageElement;
    icon.className = "ux-sidebar-menu-icon";
    productLink.append(icon);
  }
  productLink.append(document.createTextNode("Mua hàng"));

  productItem.append(productLink);
  navigation.insertBefore(productItem, serviceItem);
  return productItem;
}

export function replaceMobileMenuIcons(menu: HTMLElement | null) {
  const replacements: Array<{
    icon: SVGSVGElement;
    original?: HTMLImageElement;
  }> = [];

  mobileMenuIcons.forEach(({ selector, paths }) => {
    const link = menu?.querySelector<HTMLElement>(`${selector} > a`);
    const original = link?.querySelector<HTMLImageElement>(
      ":scope > img.ux-sidebar-menu-icon",
    );
    if (!link) return;
    const icon = createMobileMenuIcon(paths);
    if (original) link.replaceChild(icon, original);
    else link.prepend(icon);
    replacements.push({ icon, original: original ?? undefined });
  });

  return () => {
    replacements.forEach(({ icon, original }) => {
      if (icon.parentElement && original) icon.replaceWith(original);
      else icon.remove();
    });
  };
}

export function addMobileAccordionToggles(menu: HTMLElement | null) {
  const generatedToggles: HTMLButtonElement[] = [];
  menu
    ?.querySelectorAll<HTMLElement>("li.menu-item-has-children, li.has-dropdown")
    .forEach((item, index) => {
      if (item.querySelector(":scope > button.toggle")) return;
      const submenu = item.querySelector<HTMLElement>(":scope > .sub-menu");
      if (submenu && !submenu.id) submenu.id = `clone-mobile-submenu-${index + 1}`;
      submenu?.setAttribute("aria-hidden", "true");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "toggle clone-toggle";
      button.setAttribute("aria-label", "Mở menu con");
      button.setAttribute("aria-expanded", "false");
      if (submenu?.id) {
        button.setAttribute("aria-controls", submenu.id);
      }
      button.innerHTML = '<i aria-hidden="true" class="icon-angle-down"></i>';
      if (submenu) {
        item.insertBefore(button, submenu);
      } else {
        item.append(button);
      }
      generatedToggles.push(button);
    });
  return generatedToggles;
}

export function handleMobileAccordion(event: Event, menu: HTMLElement | null) {
  if (!menu || !(event.target instanceof Element)) return;
  const button = event.target.closest<HTMLButtonElement>(
    "#main-menu button.toggle",
  );
  const item = button?.closest<HTMLElement>(
    "li.menu-item-has-children",
  );
  if (!item || !menu.contains(item)) return;

  event.preventDefault();
  const shouldExpand = !item.classList.contains("clone-submenu-open");
  menu.querySelectorAll<HTMLElement>("li.clone-submenu-open").forEach((openItem) => {
    if (openItem !== item) setAccordionExpanded(openItem, false);
  });
  setAccordionExpanded(item, shouldExpand);
}
