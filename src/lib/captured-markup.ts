import { serviceFamilies } from "@/data/service-families";

const localCtaRoutes: Record<string, string> = {
  "Liên hệ ngay": "/lien-he/",
  "Về chúng tôi": "/gioi-thieu-ve-gia-cong/",
};

function readLinkLabel(content: string) {
  return content
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCapturedMarkup(markup: string) {
  const normalized = markup
    .replace(/Sản Phẩm(?=<i class="icon-angle-down"><\/i>)/g, "Mua hàng")
    .replace(/Dịch vụ(?=<i class="icon-angle-down"><\/i>)/g, "Thuê gia công")
    .replace(/Dịch Vụ Gia Công(?=<\/a>)/g, "Thuê gia công")
    .replace(
    /<a\b([^>]*?)href=(["'])#\2([^>]*)>([\s\S]*?)<\/a>/gi,
    (link, beforeHref: string, quote: string, afterHref: string, content: string) => {
      const route = localCtaRoutes[readLinkLabel(content)];
      if (!route) return link;
      return `<a${beforeHref}href=${quote}${route}${quote}${afterHref}>${content}</a>`;
    },
    );

  return replaceShoppingMenu(replaceServiceMenus(normalized));
}

function replaceServiceMenus(markup: string): string {
  return replaceListItemById(
    replaceListItemById(markup, "menu-item-5166", desktopServiceMenu()),
    "menu-item-5466",
    mobileServiceMenu(),
  );
}

function desktopServiceMenu(): string {
  const families = serviceFamilies.map((family) => `
    <article class="clone-service-mega-card">
      <a href="/thue-gia-cong/${family.slug}/">${family.name}</a>
      <span>${family.summary}</span>
    </article>`).join("");
  return `<li class="menu-item menu-item-design-container-width menu-item-has-block has-dropdown clone-service-menu-item" id="menu-item-5166">
    <a class="nav-top-link" href="/thue-gia-cong/">Thuê gia công</a>
    <button aria-controls="clone-service-menu-desktop" aria-expanded="false" aria-label="Mở menu Thuê gia công" class="clone-desktop-service-toggle" type="button"><i aria-hidden="true" class="icon-angle-down"></i></button>
    <div class="sub-menu nav-dropdown" id="clone-service-menu-desktop"><div class="clone-service-mega-grid">${families}</div></div>
  </li>`;
}

function mobileServiceMenu(): string {
  const families = serviceFamilies.map((family) => `
    <li class="menu-item"><a href="/thue-gia-cong/${family.slug}/">${family.name}</a></li>`).join("");
  return `<li class="menu-item menu-item-has-children has-icon-left clone-mobile-services" id="menu-item-5466">
    <a href="/thue-gia-cong/">Thuê gia công</a>
    <ul class="sub-menu nav-sidebar-ul children">${families}</ul>
  </li>`;
}

function replaceListItemById(markup: string, id: string, replacement: string): string {
  const opening = new RegExp(`<li\\b[^>]*\\bid=(["'])${id}\\1[^>]*>`, "i").exec(markup);
  if (!opening || opening.index === undefined) return markup;
  const end = matchingListItemEnd(markup, opening.index);
  if (end < 0) return markup;
  return `${markup.slice(0, opening.index)}${replacement}${markup.slice(end)}`;
}

function replaceShoppingMenu(markup: string): string {
  const shoppingAnchor = /<a\b[^>]*href=(['"])\/san-pham\/\1[^>]*>([\s\S]*?)Mua hàng<i class="icon-angle-down"><\/i><\/a>/i;
  const match = shoppingAnchor.exec(markup);
  if (!match || match.index === undefined) return markup;

  const itemStart = markup.lastIndexOf("<li", match.index);
  const itemEnd = itemStart < 0 ? -1 : matchingListItemEnd(markup, itemStart);
  if (itemEnd < 0) return markup;

  const itemOpenEnd = markup.indexOf(">", itemStart) + 1;
  const anchor = match[0]
    .replace(/\saria-current=(['"])[\s\S]*?\1/i, "")
    .replace(/\saria-expanded=(['"])[\s\S]*?\1/i, "")
    .replace(/\saria-haspopup=(['"])[\s\S]*?\1/i, "")
    .replace('<i class="icon-angle-down"></i>', "");
  const directItem = `${markup.slice(itemStart, itemOpenEnd)
    .replace(/\s(?:menu-item-has-block|has-dropdown)\b/g, "")}${anchor}</li>`;

  return `${markup.slice(0, itemStart)}${directItem}${markup.slice(itemEnd)}`;
}

function matchingListItemEnd(markup: string, start: number): number {
  const tags = /<\/?li\b[^>]*>/gi;
  tags.lastIndex = start;
  let depth = 0;
  let tag: RegExpExecArray | null;
  while ((tag = tags.exec(markup))) {
    depth += tag[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return tags.lastIndex;
  }
  return -1;
}
