const productSubmenuId = "clone-mobile-products-submenu";

function setAccordionExpanded(item: HTMLElement, expanded: boolean) {
  item.classList.toggle("clone-submenu-open", expanded);
  item.querySelector<HTMLElement>(":scope > a")?.setAttribute(
    "aria-expanded",
    String(expanded),
  );
  item.querySelector<HTMLButtonElement>(":scope > button.toggle")?.setAttribute(
    "aria-expanded",
    String(expanded),
  );
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
  productItem.className = [
    "menu-item",
    "menu-item-has-children",
    "has-icon-left",
    "clone-mobile-products",
  ].join(" ");

  const productLink = document.createElement("a");
  productLink.href = "#";
  productLink.setAttribute("aria-controls", productSubmenuId);
  productLink.setAttribute("aria-expanded", "false");
  const sourceIcon = desktopProductItem.querySelector<HTMLImageElement>(
    ":scope > a > .ux-menu-icon",
  );
  if (sourceIcon) {
    const icon = sourceIcon.cloneNode(true) as HTMLImageElement;
    icon.className = "ux-sidebar-menu-icon";
    productLink.append(icon);
  }
  productLink.append(document.createTextNode("Sản Phẩm"));

  const submenu = document.createElement("ul");
  submenu.id = productSubmenuId;
  submenu.className = "sub-menu nav-sidebar-ul children";
  const seenChoices = new Set<string>();
  desktopProductItem
    .querySelectorAll<HTMLAnchorElement>(
      ".menu-san-pham h4 > a, .menu-san-pham .ux-menu-link__link",
    )
    .forEach((sourceLink) => {
      const label = sourceLink.textContent.trim().replace(/\s+/g, " ");
      const href = sourceLink.getAttribute("href")?.trim() ?? "";
      const key = `${label}|${href}`;
      if (!label || !href || href === "#" || href === "/" || seenChoices.has(key)) return;
      seenChoices.add(key);
      const choice = document.createElement("li");
      choice.className = "menu-item clone-mobile-product-choice";
      const link = document.createElement("a");
      link.href = href;
      link.textContent = label;
      choice.append(link);
      submenu.append(choice);
    });

  productItem.append(productLink, submenu);
  navigation.insertBefore(productItem, serviceItem);
  return productItem;
}

export function addMobileAccordionToggles(menu: HTMLElement | null) {
  const generatedToggles: HTMLButtonElement[] = [];
  menu
    ?.querySelectorAll<HTMLElement>("li.menu-item-has-children, li.has-dropdown")
    .forEach((item, index) => {
      if (item.querySelector(":scope > button.toggle")) return;
      const submenu = item.querySelector<HTMLElement>(":scope > .sub-menu");
      if (submenu && !submenu.id) submenu.id = `clone-mobile-submenu-${index + 1}`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "toggle clone-toggle";
      button.setAttribute("aria-label", "Mở menu con");
      button.setAttribute("aria-expanded", "false");
      if (submenu?.id) {
        button.setAttribute("aria-controls", submenu.id);
        item.querySelector<HTMLElement>(":scope > a")?.setAttribute(
          "aria-controls",
          submenu.id,
        );
      }
      item.querySelector<HTMLElement>(":scope > a")?.setAttribute(
        "aria-expanded",
        "false",
      );
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
  const parentLink = event.target.closest<HTMLAnchorElement>(
    "#main-menu li.menu-item-has-children > a",
  );
  const item = (button ?? parentLink)?.closest<HTMLElement>(
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
