/**
 * View-model contracts shared by the commerce surfaces: shell, mega-menu, product
 * card, product detail and the request cart.
 *
 * These are presentation shapes only. They are derived from catalog and cart data
 * by a server component or a mapper — never fetched directly — so a component can
 * be built and checked against a fixture before the real feed is approved.
 *
 * Two boundaries are deliberate:
 *  - money is never modelled as client input. Unit price, line total and subtotal
 *    only ever arrive inside `ResolvedRequestCart`, which the server computes.
 *  - no field for a surface excluded from V1 exists here, so a component cannot
 *    render one by accident.
 */
import type { CatalogCategory, CatalogTierPrice } from "./catalog";
import type { RequestCartLineKey, ResolvedRequestCart } from "./request-cart";

/** Header/menu link. Mirrors the existing storefront nav item shape. */
export interface CommerceNavLink {
  href: string;
  isActive?: boolean;
  label: string;
}

/** Hotline, Zalo and Messenger entries. Values stay in one place per the master plan. */
export interface CommerceContactChannel {
  href: string;
  kind: "hotline" | "messenger" | "zalo";
  label: string;
}

export interface CommerceShellViewModel {
  contactChannels: readonly CommerceContactChannel[];
  /** Count shown on the request-cart badge; `0` renders no badge. */
  requestCartLineCount: number;
  /** Whether the floating contact cluster is shown on this route. */
  showFloatingContacts: boolean;
  navLinks: readonly CommerceNavLink[];
}

/** One row in the mega-menu's subcategory column. */
export interface CommerceMegaMenuSubcategory {
  count: number;
  href: string;
  label: string;
  /** Small leading thumbnail; `null` renders the warm placeholder surface. */
  thumbnailUrl: string | null;
}

export interface CommerceMegaMenuCategory {
  href: string;
  isActive: boolean;
  label: string;
  slug: string;
  subcategories: readonly CommerceMegaMenuSubcategory[];
}

/** Callout row spanning the panel bottom. */
export interface CommerceMegaMenuCallout {
  description: string;
  href: string;
  title: string;
}

export interface CommerceMegaMenuViewModel {
  callouts: readonly CommerceMegaMenuCallout[];
  categories: readonly CommerceMegaMenuCategory[];
  /** Compact cards in the featured column. */
  featured: readonly CommerceProductCardViewModel[];
  /** Client-side label filter; it never navigates. */
  searchPlaceholder: string;
}

/**
 * What the card's second action does. `select-variant` carries no SKU on purpose:
 * a product needing a choice must not be added under an invented variant key.
 */
export type CommerceCardActionKind = "add-to-request-cart" | "select-variant" | "unavailable";

export interface CommerceProductCardViewModel {
  /** Resolved by `resolveCommerceCardAction`, not hand-set. */
  actionKind: CommerceCardActionKind;
  availabilityLabel: string;
  categoryLabel: string | null;
  detailHref: string;
  /** `null` renders the warm placeholder surface rather than a gray box. */
  imageUrl: string | null;
  name: string;
  /** Formatted VND string; the numeric price stays server-side. */
  priceLabel: string;
  slug: string;
  specificationLabel: string;
  unitLabel: string;
}

export interface CommerceGalleryImage {
  alt: string;
  url: string;
}

/** Single-axis variant choice. Multi-axis selection is out of scope. */
export interface CommerceVariantChoice {
  isAvailable: boolean;
  label: string;
  sku: string;
}

/** One band of the tier table, with its saving against the first band when canonical. */
export interface CommerceTierRow extends CatalogTierPrice {
  priceLabel: string;
  savingPercent: number | null;
}

/** Verified fact shown where the excluded social proof block used to sit. */
export interface CommerceProductFact {
  label: string;
  value: string;
}

export interface CommerceProductDetailViewModel {
  availabilityLabel: string;
  breadcrumb: readonly CommerceNavLink[];
  category: CatalogCategory | null;
  description: string;
  facts: readonly CommerceProductFact[];
  gallery: readonly CommerceGalleryImage[];
  name: string;
  priceLabel: string;
  relatedProducts: readonly CommerceProductCardViewModel[];
  slug: string;
  tierRows: readonly CommerceTierRow[];
  unitLabel: string;
  /** Empty when the product has a single usable variant. */
  variantChoices: readonly CommerceVariantChoice[];
}

export interface CommerceRequestCartViewModel {
  /**
   * Server-resolved cart. Prices, totals and the request tier are read from here
   * only; the client never supplies or recomputes them.
   */
  cart: ResolvedRequestCart | null;
  /** Untrusted keys read back from local storage, pending revalidation. */
  storedLines: readonly RequestCartLineKey[];
  /** Route the submit action continues to. */
  submitHref: string;
}
