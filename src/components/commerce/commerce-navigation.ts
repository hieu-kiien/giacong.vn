/**
 * Navigation data for the commerce chrome: header links, hotline, contact
 * channels, the B2B callouts and the mega-menu derivation.
 *
 * Deliberately framework-free — no React, no `next/*`, no value import from a
 * path alias — so `scripts/commerce-header.test.mts` can drive the derivation as
 * a real module instead of asserting on source text.
 *
 * Money is numeric here. Formatting belongs to `@/lib/format-vnd`, which the
 * components call at render time, so there is still one VND formatter in the app.
 */
import type { CatalogCategory, CatalogProductParent } from "@/types/catalog";

/** Hotline shown in the header, the support strip and the floating cluster. */
export const COMMERCE_HOTLINE = "0868408115";
export const COMMERCE_HOTLINE_HREF = `tel:${COMMERCE_HOTLINE}`;

/**
 * The one request route. Both the header quote button and the request badge point
 * here; V1 has no second destination for a request.
 */
export const COMMERCE_REQUEST_HREF = "/gui-yeu-cau/";
export const COMMERCE_QUOTE_LABEL = "Gửi yêu cầu";

export interface CommerceNavItem {
  /** Only the product action opens the mega-menu; the rest are plain links. */
  hasMegaMenu?: boolean;
  href: string;
  label: string;
}

/**
 * The six header actions in the approved reference, in its order. Every target is
 * a route this app actually serves — the captured menu pointed several entries at
 * `href="#"`, which is what the audit flagged.
 */
export const COMMERCE_NAV_ITEMS: readonly CommerceNavItem[] = [
  { href: "/", label: "Trang chủ" },
  { hasMegaMenu: true, href: "/san-pham/", label: "Mua hàng" },
  { href: "/thue-gia-cong/", label: "Thuê gia công" },
  { href: "/gioi-thieu-ve-gia-cong/", label: "Về Giacong.vn" },
  { href: "/tin-tuc/", label: "Tin tức" },
  { href: "/lien-he/", label: "Liên hệ" },
];

export type CommerceContactKind = "email" | "hotline" | "messenger" | "zalo";

export interface CommerceContactChannel {
  /** The reference itself, shown as visible text rather than only as an icon. */
  contact: string;
  /** Chat and mail targets leave the app; `tel:`/`mailto:` hand off to the OS. */
  isExternal: boolean;
  href: string;
  kind: CommerceContactKind;
  label: string;
}

/**
 * Floating contact cluster. These four targets are the demo values the master plan
 * publishes for the request handoff, mirrored from `@/lib/request-cart-channels`
 * rather than imported so the chrome carries no dependency on the cart module.
 * `scripts/commerce-header.test.mts` asserts the two lists agree, so they cannot
 * drift — and the mirror is what keeps this module framework-free.
 */
export const COMMERCE_CONTACT_CHANNELS: readonly CommerceContactChannel[] = [
  {
    contact: COMMERCE_HOTLINE,
    href: COMMERCE_HOTLINE_HREF,
    isExternal: false,
    kind: "hotline",
    label: "Gọi hotline",
  },
  {
    contact: "06408115",
    href: "https://zalo.me/06408115",
    isExternal: true,
    kind: "zalo",
    label: "Chat Zalo",
  },
  {
    contact: "m.me/qtudepdai",
    href: "https://m.me/qtudepdai",
    isExternal: true,
    kind: "messenger",
    label: "Chat Messenger",
  },
  {
    contact: "qtu1053@gmail.com",
    href: "mailto:qtu1053@gmail.com",
    isExternal: false,
    kind: "email",
    label: "Gửi email",
  },
];

export interface CommerceB2bCallout {
  description: string;
  href: string;
  title: string;
}

/**
 * The two rows spanning the panel bottom in the reference.
 *
 * Both stay on purchasing: the captured product dropdown listed service pages,
 * which is the defect `qa:catalog` pins with its "must not list gia công
 * services" assertion. Services keep their own top-level navigation action.
 */
export const COMMERCE_B2B_CALLOUTS: readonly CommerceB2bCallout[] = [
  {
    description: "Gửi danh sách mặt hàng và số lượng, chúng tôi báo giá theo bậc số lượng.",
    href: COMMERCE_REQUEST_HREF,
    title: "Đặt số lượng lớn cho doanh nghiệp",
  },
  {
    description: `Gọi ${COMMERCE_HOTLINE} để được tư vấn quy cách, tồn kho và thời gian giao.`,
    href: "/lien-he/",
    title: "Cần tư vấn quy cách?",
  },
];

/** One row in the middle column: a product inside the hovered category. */
export interface CommerceMenuSubcategory {
  /** Quy cách available for the product, shown as supporting metadata. */
  count: number;
  label: string;
  productSlug: string;
  /** `null` renders the warm placeholder surface instead of a gray box. */
  thumbnailUrl: string | null;
}

export interface CommerceMenuCategory {
  /** Products the category holds. */
  count: number;
  isActive: boolean;
  label: string;
  slug: string;
  subcategories: readonly CommerceMenuSubcategory[];
}

/**
 * Compact card in the featured column.
 *
 * No `variantSku`: list data carries no variant key, so a featured card routes to
 * detail where a quy cách is chosen. Inventing one here is exactly what the card
 * contract forbids.
 */
export interface CommerceMenuFeaturedItem {
  categorySlug: string;
  imageUrl: string | null;
  name: string;
  price: number | null;
  productSlug: string;
  specificationLabel: string;
}

export interface CommerceMegaMenuModel {
  callouts: readonly CommerceB2bCallout[];
  categories: readonly CommerceMenuCategory[];
  featured: readonly CommerceMenuFeaturedItem[];
}

export interface BuildCommerceMegaMenuInput {
  /** Category the current route is filtered by; empty selects the first one. */
  activeCategorySlug: string;
  categories: readonly CatalogCategory[];
  products: readonly CatalogProductParent[];
}

/** Cards in the featured column of the reference panel. */
const FEATURED_LIMIT = 3;

/**
 * Builds the panel model from the category and product feeds.
 *
 * The catalog publishes a flat category list, so the middle column is derived:
 * each category lists its own products as rows, and the featured column shows the
 * first few products of whichever category leads. An empty or unavailable feed
 * yields an empty panel rather than an error — this is chrome, not the content of
 * any route, so it must not fail the page around it.
 */
export function buildCommerceMegaMenu({
  activeCategorySlug,
  categories,
  products,
}: BuildCommerceMegaMenuInput): CommerceMegaMenuModel {
  const grouped = new Map<string, CatalogProductParent[]>();
  for (const product of products) {
    const slug = product.category?.slug;
    if (!slug) continue;
    const bucket = grouped.get(slug);
    if (bucket) bucket.push(product);
    else grouped.set(slug, [product]);
  }

  // An unknown or absent selection falls back to the first category, so the panel
  // always opens with one column highlighted and a populated middle column.
  const activeSlug = categories.some((category) => category.slug === activeCategorySlug)
    ? activeCategorySlug
    : categories[0]?.slug ?? "";

  const menuCategories = categories.map((category) => {
    const items = grouped.get(category.slug) ?? [];
    return {
      count: items.length,
      isActive: category.slug === activeSlug,
      label: category.name,
      slug: category.slug,
      subcategories: items.map((product) => ({
        count: product.availableVariantCount,
        label: product.name,
        productSlug: product.slug,
        thumbnailUrl: product.imageUrl,
      })),
    };
  });

  const featured = (grouped.get(activeSlug) ?? []).slice(0, FEATURED_LIMIT).map((product) => ({
    categorySlug: activeSlug,
    imageUrl: product.imageUrl,
    name: product.name,
    price: product.startingPrice?.price ?? null,
    productSlug: product.slug,
    specificationLabel: product.shortDescription,
  }));

  return { callouts: COMMERCE_B2B_CALLOUTS, categories: menuCategories, featured };
}
