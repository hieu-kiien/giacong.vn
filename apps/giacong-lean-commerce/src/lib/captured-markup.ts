import { getLegacyMegaMenuItemId, type LegacyMegaMenuOwner } from "../data/legacy-mega-menu.ts";

const localCtaRoutes: Record<string, string> = {
  "Liên hệ ngay": "/lien-he/",
  "Về chúng tôi": "/gioi-thieu-ve-gia-cong/",
};

// Decision: D1 site_navigation_items owns top-level parent labels and hrefs.
// Child choices start from source-owned capture data and get stable markers so
// D1 can override a selected child after an operator saves and publishes it.
// The mobile product accordion clones the desktop menu after navigation has
// been applied. Legacy child hrefs that cannot be mapped to a public page
// render as plain text until an operator provides a real destination.
const legacyMegaMenuHrefFallbacks: Readonly<Record<string, "parent">> = {
  "#": "parent",
  "/": "parent",
  "/Hoa quả sấy": "parent",
};

const capturedAssetAliases: Readonly<Record<string, string>> = {
  // The capture kept WordPress thumbnail suffixes after the source thumbnails
  // were removed. The original files are still public and preserve the same
  // visual content without adding a dependency on the old thumbnail route.
  "https://giacong.vn/wp-content/uploads/2024/10/img-sp-1-510x315.png":
    "https://giacong.vn/wp-content/uploads/2024/10/img-sp-1.png",
  "https://giacong.vn/wp-content/uploads/2024/09/IMG-510x433.png":
    "https://giacong.vn/wp-content/uploads/2024/09/IMG.png",
  "https://giacong.vn/wp-content/uploads/2024/09/Screenshot-2024-09-06-003821-100x100.png":
    "https://giacong.vn/wp-content/uploads/2024/09/Screenshot-2024-09-06-003821.png",
  "https://giacong.vn/wp-content/uploads/2024/09/Screenshot-2024-09-06-004009-100x100.png":
    "https://giacong.vn/wp-content/uploads/2024/09/Screenshot-2024-09-06-004009.png",
  // These decorative icon uploads now return a WordPress 404 HTML page. A
  // local neutral asset keeps the captured layout stable and removes the
  // browser's ORB failures from every route.
  "https://giacong.vn/wp-content/uploads/2024/08/file-star-svgrepo-com.svg": "/images/captured-asset-placeholder.svg",
  "https://giacong.vn/wp-content/uploads/2024/08/file-2-svgrepo-com.svg": "/images/captured-asset-placeholder.svg",
  "https://giacong.vn/wp-content/uploads/2024/08/bulb-2-svgrepo-com.svg": "/images/captured-asset-placeholder.svg",
  "https://giacong.vn/wp-content/uploads/2024/08/message-2-star-svgrepo-com.svg": "/images/captured-asset-placeholder.svg",
  "https://giacong.vn/wp-content/uploads/2024/08/gift-card-150x150.png": "/images/captured-asset-placeholder.svg",
  "https://giacong.vn/wp-content/uploads/2024/08/comment-info-150x150.png": "/images/captured-asset-placeholder.svg",
  "https://giacong.vn/wp-content/uploads/2024/08/envelope-dot-150x150.png": "/images/captured-asset-placeholder.svg",
  "https://giacong.vn/wp-content/uploads/2024/08/trang-chu-netfood.svg": "/images/captured-asset-placeholder.svg",
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
 * Safe to wrap after removing a capture's optional `@charset`: `@charset` is
 * valid only at the stylesheet top level, while `@layer` may contain the
 * remaining `@font-face`, `@media` and `@keyframes` rules.
 */
export function layerCapturedStyles(pageStyles: string): string {
  const nestedStyles = pageStyles.replace(/@charset\s+(?:"[^"]*"|'[^']*')\s*;?/gi, "");
  return `@layer captured {\n${nestedStyles}\n}`;
}

export function normalizeCapturedMarkup(markup: string, activeCapturedMenuId?: string | null) {
  const normalized = markup
    // Captured pages are static marketing HTML rendered through
    // dangerouslySetInnerHTML. Executable elements must never reach the
    // document even if a capture artifact is poisoned upstream; React would
    // not run them either, so stripping changes no legitimate rendering.
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script\b[^>]*>/gi, "")
    .replace(/<\/script\s*>/gi, "")
    // Captured HTML must start unrevealed so the client observer has a real
    // initial frame to animate from. Older generated page JSON baked this
    // attribute in, so strip it here as a backwards-compatible safeguard.
    .replace(/\sdata-animated=(["'])[^"']*\1/gi, "")
    .replace(/Sản Phẩm(?=<i\b[^>]*\bclass=(["'])icon-angle-down\1[^>]*>\s*<\/i>)/g, "Mua hàng")
    .replace(/Dịch vụ(?=<i\b[^>]*\bclass=(["'])icon-angle-down\1[^>]*>\s*<\/i>)/g, "Thuê gia công")
    .replace(/Dịch Vụ Gia Công(?=<\/a>)/g, "Thuê gia công")
    .replace(
    /<a\b([^>]*?)href=(["'])#\2([^>]*)>([\s\S]*?)<\/a>/gi,
    (link, beforeHref: string, quote: string, afterHref: string, content: string) => {
      const route = localCtaRoutes[readLinkLabel(content)];
      if (!route) return link;
      return `<a${beforeHref}href=${quote}${route}${quote}${afterHref}>${content}</a>`;
    },
    );

  return applyCapturedActiveNav(
    addCapturedImageLoadingHints(
      normalizeCapturedAssetSources(
        normalizeCapturedFooterHeadings(
          normalizeCapturedFormControls(
            normalizeCapturedFrames(
              normalizeCapturedContactHeadings(
                normalizeCapturedMainLandmark(
                  normalizeHomeMenuItems(
                    replaceCapturedMenus(
                      normalizeCapturedMenuRoutes(normalizeCapturedInternalLinks(normalized)),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
    activeCapturedMenuId,
  );
}

function normalizeCapturedAssetSources(markup: string): string {
  return Object.entries(capturedAssetAliases).reduce(
    (result, [source, replacement]) => result.split(source).join(replacement),
    markup,
  );
}

/**
 * Maps a captured route path to the desktop menu item that owns its section.
 * Mirrors the section intent of the published navigation without consulting
 * D1: captured pages render source-owned markup, so the active tab has to be
 * derived from the route itself. Returns null when no tab owns the route.
 */
export function resolveCapturedActiveMenuId(routePath: string): string | null {
  const slug = routePath.split("/").filter(Boolean)[0] ?? "";
  if (!slug) return null;
  if (slug === "gioi-thieu-ve-gia-cong") return "menu-item-5498";
  if (slug === "lien-he") return "menu-item-1542";
  if (slug === "tin-tuc" || slug.startsWith("tin-tuc-")) return "menu-item-1541";
  if (slug === "san-pham" || slug.startsWith("san-pham-")) return "menu-item-1742";
  if (
    slug === "thue-gia-cong" ||
    slug === "bot-gia-vi" ||
    slug.startsWith("bot-gia-vi-") ||
    slug.startsWith("gia-cong-") ||
    slug.startsWith("dich-vu-") ||
    slug.startsWith("say-") ||
    slug.startsWith("thuc-pham-")
  ) {
    return "menu-item-5166";
  }
  return null;
}

// Local mirror of capturedNavigationAliases in site-navigation.ts (that
// module owns the D1-driven menu; captured pages stay source-owned, so the
// alias list is duplicated here instead of coupling the two).
const capturedActiveNavAliases: Readonly<Record<string, readonly string[]>> = {
  "menu-item-4618": ["menu-item-5465"],
  "menu-item-5498": ["menu-item-5496"],
  "menu-item-1742": [],
  "menu-item-5166": ["menu-item-5466"],
  "menu-item-1541": ["menu-item-5477"],
  "menu-item-1542": ["menu-item-5478"],
};

const capturedActiveLiTokens: readonly string[] = [
  "current-menu-item",
  "current_page_item",
  "current-menu-parent",
  "active",
];

/**
 * Replaces the upstream active tab with the one owning this route. Only
 * `li#menu-item-*` opening tags and their own top-link anchor are touched —
 * the captured footer owns no menu-item ids and pagination `aria-current`
 * lives on `span.page-number`, so both survive byte-identical. An `undefined`
 * active id keeps legacy output for callers that manage navigation themselves
 * (homepage, storefront shell); `null` strips upstream markers and sets none.
 */
function applyCapturedActiveNav(markup: string, activeMenuId: string | null | undefined): string {
  if (activeMenuId === undefined) return markup;
  const liPattern = /<li\b[^>]*\bid=(["'])(menu-item-\d+)\1[^>]*>/gi;
  const items: { index: number; length: number; id: string; tag: string }[] = [];
  let found: RegExpExecArray | null;
  while ((found = liPattern.exec(markup))) {
    items.push({ index: found.index, length: found[0].length, id: found[2], tag: found[0] });
  }
  const activeTargets = new Map<string, readonly string[]>();
  if (activeMenuId) {
    activeTargets.set(activeMenuId, ["active", "current-menu-item"]);
    for (const alias of capturedActiveNavAliases[activeMenuId] ?? []) {
      activeTargets.set(alias, ["current-menu-item"]);
    }
  }
  let result = markup;
  for (let cursor = items.length - 1; cursor >= 0; cursor -= 1) {
    const item = items[cursor];
    const stripped = stripCapturedActiveLiTag(item.tag);
    const tokens = activeTargets.get(item.id);
    const nextTag = tokens ? addCapturedClassTokens(stripped, tokens) : stripped;
    result = `${result.slice(0, item.index)}${nextTag}${result.slice(item.index + item.length)}`;
    // The first anchor after the li opening tag is the item's own top link;
    // nested dropdown links always come later, pagination is never inside a
    // menu-item li, so only this anchor may lose or gain aria-current.
    const anchorStart = result.indexOf("<a", item.index + nextTag.length);
    if (anchorStart < 0) continue;
    const anchorEnd = result.indexOf(">", anchorStart);
    if (anchorEnd < 0) continue;
    const anchor = result.slice(anchorStart, anchorEnd);
    if (tokens) {
      if (!/\baria-current=/i.test(anchor)) {
        result = `${result.slice(0, anchorStart + 2)} aria-current="page"${result.slice(anchorStart + 2)}`;
      }
    } else {
      const cleaned = anchor.replace(/\saria-current=(["'])page\1/i, "");
      if (cleaned !== anchor) {
        result = `${result.slice(0, anchorStart)}<a${cleaned.slice(2)}${result.slice(anchorEnd)}`;
      }
    }
  }
  return result;
}

function stripCapturedActiveLiTag(tag: string): string {
  return tag
    .replace(
      /class=(["'])([^"']*)\1/i,
      (_match, quote: string, classes: string) =>
        `class=${quote}${classes
          .split(/\s+/)
          .filter((token) => token && !capturedActiveLiTokens.includes(token))
          .join(" ")}${quote}`,
    )
    .replace(/\saria-current=(["'])page\1/i, "");
}

function addCapturedClassTokens(tag: string, tokens: readonly string[]): string {
  return tag.replace(
    /class=(["'])([^"']*)\1/i,
    (_match, quote: string, classes: string) => {
      const next = classes.split(/\s+/).filter(Boolean);
      for (const token of tokens) {
        if (!next.includes(token)) next.push(token);
      }
      return `class=${quote}${next.join(" ")}${quote}`;
    },
  );
}

function normalizeCapturedMainLandmark(markup: string): string {
  return markup.replace(/<div\b([^>]*)>/gi, (tag, attributes: string) => {
    if (!/\bid\s*=\s*(["'])content\1/i.test(attributes)) return tag;
    return `<div${attributes.replace(/\srole\s*=\s*(["'])main\1/i, "")}>`;
  });
}

function normalizeCapturedContactHeadings(markup: string): string {
  return markup.replace(
    /<h3\b([^>]*)>([\s\S]*?)<\/h3>/gi,
    (tag, attributes: string, content: string) =>
      /^\s*Thông tin công ty\s*$/i.test(readLinkLabel(content))
        ? `<h2${attributes}>${content}</h2>`
        : tag,
  );
}

function normalizeCapturedFrames(markup: string): string {
  return markup.replace(/<iframe\b([^>]*)>/gi, (tag, attributes: string) => {
    if (/\btitle\s*=/i.test(attributes)) return tag;
    const title = /(?:google\.[^/]+\/maps\/embed|maps\.google\.)/i.test(attributes)
      ? "Bản đồ vị trí Giacong.vn"
      : "Nội dung nhúng Giacong.vn";
    return `<iframe${attributes} title="${title}">`;
  });
}

function normalizeCapturedFormControls(markup: string): string {
  return markup.replace(/<input\b([^>]*)>/gi, (tag, attributes: string) => {
    if (!/\btype\s*=\s*(["'])submit\1/i.test(attributes)) return tag;
    if (/\b(?:aria-label|aria-labelledby|title|id)\s*=/i.test(attributes)) return tag;

    const value = attributes.match(/\bvalue\s*=\s*(["'])([\s\S]*?)\1/i)?.[2]?.trim();
    if (!value) return tag;
    const label = escapeCapturedAttribute(value);
    return tag.replace(/\s*(\/?)>$/, (_closing, slash: string) => ` aria-label="${label}"${slash}>`);
  });
}

function escapeCapturedAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeCapturedFooterHeadings(markup: string): string {
  return markup.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, (footer) =>
    footer
      .replace(/<h3\b/gi, "<h2")
      .replace(/<\/h3>/gi, "</h2>"),
  );
}

function addCapturedImageLoadingHints(markup: string): string {
  return markup.replace(/<img\b[^>]*>/gi, (tag) => {
    if (
      /\bloading\s*=|\bfetchpriority\s*=\s*(["'])high\1|\b(?:header_logo|header-logo|header-logo-dark|ux-menu-icon|ux-sidebar-menu-icon)\b/i.test(
        tag,
      )
    ) {
      return tag;
    }
    return tag.replace(/\/?>$/, (closing) => ` loading="lazy"${closing}`);
  });
}

function normalizeCapturedInternalLinks(markup: string): string {
  return markup.replace(
    /(\bhref\s*=\s*["'])https?:\/\/(?:www\.)?giacong\.vn(?=\/|["'])/gi,
    "$1",
  );
}

function normalizeCapturedMenuRoutes(markup: string): string {
  return markup
    .replace(
      /(<li\b[^>]*\bid=["']menu-item-1742["'][^>]*>[\s\S]*?<a\b[^>]*\bhref=)["']#["']/i,
      "$1\"/san-pham/\"",
    )
    .replace(
      /(<li\b[^>]*\bid=["']menu-item-5166["'][^>]*>[\s\S]*?<a\b[^>]*\bhref=)["']#["']/i,
      "$1\"/thue-gia-cong/\"",
    );
}

function replaceCapturedMenus(markup: string): string {
  let result = replaceDesktopDropdown(
    markup,
    "menu-item-1742",
    productMegaMenu(),
  );
  result = replaceDesktopDropdown(
    result,
    "menu-item-5166",
    serviceMegaMenu(),
  );
  return replaceListItemById(result, "menu-item-5466", mobileServiceMenu());
}

function replaceDesktopDropdown(
  markup: string,
  id: string,
  replacement: string,
): string {
  const opening = new RegExp(`<li\\b[^>]*\\bid=(["'])${id}\\1[^>]*>`, "i").exec(markup);
  if (!opening || opening.index === undefined) return markup;
  const end = matchingListItemEnd(markup, opening.index);
  if (end < 0) return markup;
  const item = markup.slice(opening.index, end);
  const dropdown = /<div\b[^>]*\bclass=(["'])[^"']*\bsub-menu\b[^"']*\bnav-dropdown\b[^"']*\1[^>]*>/i.exec(item);
  if (!dropdown || dropdown.index === undefined) return markup;
  const dropdownEnd = matchingElementEnd(item, dropdown.index, "div");
  if (dropdownEnd < 0) return markup;
  const normalizedItem = `${item.slice(0, dropdown.index)}${replacement}${item.slice(dropdownEnd)}`;
  return `${markup.slice(0, opening.index)}${normalizedItem}${markup.slice(end)}`;
}

interface MegaMenuLink {
  href: string;
  label: string;
}

interface MegaMenuGroup {
  href: string;
  label: string;
  links?: readonly MegaMenuLink[];
}

type MegaMenuColumn = readonly MegaMenuGroup[];

const productMegaMenuColumns: readonly MegaMenuColumn[] = [
  [
    { href: "/gia-cong-sot-cham/", label: "Gia công sốt chấm" },
    { href: "/gia-cong-do-uong/", label: "Gia công đồ uống" },
    { href: "/gia-cong-bot-pha-che/", label: "Gia công bột pha chế" },
    { href: "/gia-cong-duoc-lieu/", label: "Gia công dược liệu" },
    { href: "/gia-cong-thuc-pham/", label: "Gia công thực phẩm" },
    { href: "/gia-cong-my-pham/", label: "Gia công mỹ phẩm" },
    { href: "/gia-cong-tra/", label: "Gia công trà" },
    { href: "/gia-cong-ca-phe/", label: "Gia công cà phê" },
    { href: "/gia-cong-dong-goi/", label: "Gia công đóng gói" },
    { href: "/gia-cong-bot/", label: "Gia công bột" },
    { href: "/gia-cong-ruou/", label: "Gia công rượu" },
  ],
  [
    {
      href: "/gia-cong-sua/",
      label: "Gia công sữa",
      links: [
        { href: "/gia-cong-sua-bot/", label: "Gia công sữa bột" },
        { href: "/", label: "Gia công sữa tươi" },
      ],
    },
    {
      href: "/dich-vu-say/",
      label: "Dịch vụ sấy",
      links: [
        { href: "/say-thang-hoa/", label: "Sấy thăng hoa" },
        { href: "/say-lanh/", label: "Dịch vụ sấy lạnh" },
        { href: "/say-chan-khong/", label: "Dịch vụ sấy chân không" },
      ],
    },
    {
      href: "",
      label: "Nước trái cây",
      links: [
        { href: "#", label: "Nước ép chanh leo" },
        { href: "/Hoa quả sấy", label: "Nước ép dưa hấu" },
        { href: "#", label: "Nước ép dứa" },
      ],
    },
  ],
  [
    {
      href: "",
      label: "Thực phẩm sấy",
      links: [
        { href: "/", label: "Bột phô mai tách muối" },
        { href: "/", label: "Sữa chua vị việt quất" },
        { href: "/", label: "Sữa chua vị chuối" },
        { href: "/", label: "Sữa chua vị dâu tây" },
        { href: "/", label: "Sữa chua vị đào" },
        { href: "/", label: "Sữa chua vị nguyên bản" },
        { href: "/", label: "Sữa chua vị truyền thống" },
      ],
    },
  ],
  [
    {
      href: "/bot-gia-vi/",
      label: "Bột gia vị",
      links: [
        { href: "/", label: "Bột gừng" },
        { href: "/", label: "Bột hành" },
        { href: "/", label: "Bột Hành Baro" },
        { href: "/", label: "Bột hành tây" },
        { href: "/", label: "Bột nghệ" },
        { href: "/", label: "Bột ớt" },
        { href: "/", label: "Bột sả" },
      ],
    },
  ],
];

const serviceMegaMenuColumns: readonly MegaMenuColumn[] = [
  [
    {
      href: "/dich-vu-say/",
      label: "Dịch vụ sấy",
      links: [
        { href: "/say-thang-hoa/", label: "Sấy thăng hoa" },
        { href: "/say-nong/", label: "Sấy nóng" },
        { href: "/say-lanh/", label: "Sấy lạnh" },
        { href: "/say-chan-khong/", label: "Sấy chân không" },
        { href: "/say-hong-ngoai/", label: "Sấy hồng ngoại" },
      ],
    },
  ],
  [
    {
      href: "/gia-cong-do-uong/",
      label: "Gia công đồ uống",
      links: [
        { href: "/gia-cong-sua-hat/", label: "Gia công sữa hạt" },
        { href: "/gia-cong-sua-thuc-vat/", label: "Gia công sữa thực vật" },
        { href: "/gia-cong-nuoc-ep-trai-cay/", label: "Gia công nước ép trái cây" },
        { href: "/gia-cong-nuoc-giai-khat-co-ga/", label: "Gia công nước giải khát" },
        { href: "/gia-cong-tra-dong-chai/", label: "Gia công trà đóng chai" },
        { href: "/gia-cong-nuoc-uong-dong-chai/", label: "Gia công nước lọc" },
        { href: "/gia-cong-ca-phe-qua-tang/", label: "Gia công cà phê quà tặng" },
        { href: "/gia-cong-ca-phe-hoa-tan/", label: "Gia công cà phê hòa tan" },
        { href: "/gia-cong-tra-tui-loc/", label: "Gia công trà túi lọc" },
        { href: "/rang-gia-cong-ca-phe/", label: "Gia công rang cà phê" },
      ],
    },
    {
      href: "",
      label: "Dịch vụ đóng gói",
      links: [
        { href: "#", label: "Mit sấy" },
        { href: "/Hoa quả sấy", label: "Hồng sấy" },
        { href: "#", label: "Khoai lang sấy" },
      ],
    },
    {
      href: "",
      label: "Dịch vụ thiết kế",
      links: [
        { href: "#", label: "Nước ép chanh leo" },
        { href: "#", label: "Nước ép dưa hấu" },
        { href: "#", label: "Nước ép dứa" },
      ],
    },
  ],
  [
    {
      href: "",
      label: "Dịch vụ pháp lý",
      links: [
        { href: "/", label: "Bột phô mai tách muối" },
        { href: "/", label: "Sữa chua vị việt quất" },
        { href: "/", label: "Sữa chua vị chuối" },
        { href: "/", label: "Sữa chua vị dâu tây" },
        { href: "/", label: "Sữa chua vị đào" },
        { href: "/", label: "Sữa chua vị nguyên bản" },
        { href: "/", label: "Sữa chua vị truyền thống" },
      ],
    },
  ],
  [
    {
      href: "",
      label: "Dịch vụ marketing",
      links: [
        { href: "/", label: "Bột gừng" },
        { href: "/", label: "Bột hành" },
        { href: "/", label: "Bột Hành Baro" },
        { href: "/", label: "Bột hành tây" },
        { href: "/", label: "Bột nghệ" },
        { href: "/", label: "Bột ớt" },
        { href: "/", label: "Bột sả" },
      ],
    },
  ],
];

const mobileServiceMenuLinks: readonly MegaMenuLink[] = [
  { href: "/gia-cong-sua/", label: "Dịch Vụ Gia Công Sữa" },
  { href: "/dich-vu-say/", label: "Dịch Vụ Sấy" },
  { href: "/bot-gia-vi/", label: "Gia Công Bột Gia Vị" },
  { href: "/gia-cong-ca-phe/", label: "Gia Công Cà Phê" },
  { href: "/gia-cong-duoc-lieu/", label: "Gia Công Dược Liệu" },
  { href: "/gia-cong-do-uong/", label: "Gia Công Đồ Uống" },
  { href: "/gia-cong-my-pham/", label: "Gia Công Mỹ Phẩm" },
  { href: "/gia-cong-thuc-pham/", label: "Gia Công Thực Phẩm" },
  { href: "/gia-cong-tra/", label: "Gia Công Trà" },
  { href: "/thuc-pham-chuc-nang/", label: "Thực Phẩm Chức Năng" },
];

function productMegaMenu(): string {
  return renderMegaMenu(productMegaMenuColumns, "clone-product-menu", "products");
}

function serviceMegaMenu(): string {
  return renderMegaMenu(serviceMegaMenuColumns, "clone-service-menu", "services");
}

function mobileServiceMenu(): string {
  const links = mobileServiceMenuLinks.map((link) => (
    `<li class="menu-item menu-item-type-taxonomy menu-item-object-category"><a href="${escapeAttribute(resolveMegaMenuHref(link.href, "/thue-gia-cong/"))}">${escapeHtml(link.label)}</a></li>`
  )).join("\n");
  return `<li class="menu-item menu-item-type-custom menu-item-object-custom menu-item-has-children menu-item-5466 has-icon-left" id="menu-item-5466"><a href="/thue-gia-cong/">Thuê gia công</a><ul class="sub-menu nav-sidebar-ul children">${links}</ul></li>`;
}

function renderMegaMenu(columns: readonly MegaMenuColumn[], menuClass: string, owner: LegacyMegaMenuOwner): string {
  const markup = columns.map((column) => (
    `<div class="col medium-3 small-6 large-3"><div class="col-inner">${column.map((group) => renderMegaMenuGroup(group, owner)).join("\n")}</div></div>`
  )).join("\n");

  return `<div class="sub-menu nav-dropdown"><div class="row row-small menu-san-pham ${menuClass}">${markup}</div></div>`;
}

function renderMegaMenuGroup(group: MegaMenuGroup, owner: LegacyMegaMenuOwner): string {
  const links = group.links?.map((link) => {
    const content = `<i class="ux-menu-link__icon text-center icon-angle-right"></i><span class="ux-menu-link__text">${escapeHtml(link.label)}</span>`;
    const inner = legacyMegaMenuHrefFallbacks[link.href] === "parent"
      ? `<span class="ux-menu-link__link flex">${content}</span>`
      : `<a class="ux-menu-link__link flex" href="${escapeAttribute(link.href)}">${content}</a>`;
    const navigationId = getLegacyMegaMenuItemId(owner, link.label, link.href);
    const marker = navigationId ? ` data-navigation-id="${escapeAttribute(navigationId)}"` : "";
    return `<div class="ux-menu-link flex menu-item"${marker}>${inner}</div>`;
  }).join("\n");
  const linkMenu = links === undefined
    ? ""
    : `<div class="ux-menu stack stack-col justify-start ux-menu--divider-solid">${links}</div>`;
  const heading = group.href
    ? `<h4><a href="${escapeAttribute(group.href)}">${escapeHtml(group.label)}</a></h4>`
    : `<h4><span>${escapeHtml(group.label)}</span></h4>`;

  return `${heading}${linkMenu}`;
}

function resolveMegaMenuHref(href: string, parentHref: string): string {
  return legacyMegaMenuHrefFallbacks[href] === "parent" ? parentHref : href;
}

function replaceListItemById(markup: string, id: string, replacement: string): string {
  const opening = new RegExp(`<li\\b[^>]*\\bid=(["'])${id}\\1[^>]*>`, "i").exec(markup);
  if (!opening || opening.index === undefined) return markup;
  const end = matchingListItemEnd(markup, opening.index);
  if (end < 0) return markup;
  return `${markup.slice(0, opening.index)}${replacement}${markup.slice(end)}`;
}

function matchingElementEnd(markup: string, start: number, tagName: string): number {
  const tags = new RegExp(`<\\/?${tagName}\\b[^>]*>`, "gi");
  tags.lastIndex = start;
  let depth = 0;
  let tag: RegExpExecArray | null;
  while ((tag = tags.exec(markup))) {
    if (tag[0].startsWith("</")) depth -= 1;
    else if (!/\/\s*>$/.test(tag[0])) depth += 1;
    if (depth === 0) return tags.lastIndex;
  }
  return -1;
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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
