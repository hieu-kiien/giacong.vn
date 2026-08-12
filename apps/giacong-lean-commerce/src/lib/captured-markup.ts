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

/**
 * Wraps a captured page's inline stylesheet in the `captured` cascade layer.
 *
 * This is the third route captured CSS takes into the document, alongside the
 * `public/styles/` sheets imported by `(storefront)/captured-layers.css` and this
 * project's own overrides in `globals.css`. All three have to sit in the same
 * layer: an unlayered sheet beats every layered one regardless of specificity, so
 * leaving this one out silently overrides both the other two — the captured
 * mobile-menu link colour comes from here, and `globals.css` is what makes it
 * white.
 *
 * Safe to wrap unconditionally: `@layer` may contain `@font-face`, `@media` and
 * `@keyframes`, which is everything the captured sheets use, and none of them
 * contain `@import` or `@charset` (which would have to stay at the top level).
 */
export function layerCapturedStyles(pageStyles: string): string {
  return `@layer captured {\n${pageStyles}\n}`;
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

  return normalizeHomeMenuItems(
    replaceShoppingMenu(replaceServiceMenus(normalized)),
  );
}

function normalizeHomeMenuItems(markup: string): string {
  return normalizeHomeMenuItem(
    normalizeHomeMenuItem(markup, "menu-item-4618"),
    "menu-item-5465",
  );
}

function normalizeHomeMenuItem(markup: string, id: string): string {
  const opening = new RegExp(`<li\\b[^>]*\\bid=(["'])${id}\\1[^>]*>`, "i").exec(markup);
  if (!opening || opening.index === undefined) return markup;
  const end = matchingListItemEnd(markup, opening.index);
  if (end < 0) return markup;

  const item = markup.slice(opening.index, end);
  const directAnchor = /^(<li\b[^>]*>\s*<a\b[^>]*>)([\s\S]*?)(<\/a>)/i.exec(item);
  if (!directAnchor) return markup;
  const label = directAnchor[2].replace(/Trang Chủ(\s*)$/i, "Home$1");
  const normalizedItem = `${directAnchor[1]}${label}${directAnchor[3]}${item.slice(directAnchor[0].length)}`;

  return `${markup.slice(0, opening.index)}${normalizedItem}${markup.slice(end)}`;
}

function replaceServiceMenus(markup: string): string {
  return replaceListItemById(
    replaceListItemById(markup, "menu-item-5166", desktopServiceMenu()),
    "menu-item-5466",
    mobileServiceMenu(),
  );
}

function desktopServiceMenu(): string {
  return `<li class="menu-item menu-item-design-default" id="menu-item-5166"><a class="nav-top-link" href="/thue-gia-cong/">Thuê gia công</a></li>`;
}

function mobileServiceMenu(): string {
  return `<li class="menu-item has-icon-left clone-mobile-services" id="menu-item-5466"><a href="/thue-gia-cong/">Thuê gia công</a></li>`;
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
