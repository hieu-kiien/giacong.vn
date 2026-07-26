/**
 * Numeric mirror of `src/styles/commerce-foundation.css`.
 *
 * Layout code needs some of these as numbers — grid maths, `sizes` attributes,
 * intersection thresholds — and CSS custom properties cannot be read at build
 * time. `scripts/commerce-foundation.test.mts` asserts both files agree, so the
 * stylesheet stays the single place a value is *changed*.
 *
 * The commerce-only values began as screenshot measurements. Header height now
 * follows the established storefront chrome so the catalog and service tabs share
 * one visual rhythm.
 */

export const COMMERCE_COLORS = {
  activeSurface: "#f1f8ec",
  body: "#191919",
  border: "#dfe3df",
  brand: "#2f9e0b",
  brandDark: "#237a08",
  price: "#ef1726",
  secondary: "#6f7177",
  supportStrip: "#f4faea",
} as const;

export type CommerceColorToken = keyof typeof COMMERCE_COLORS;

export const COMMERCE_GEOMETRY = {
  /** Desktop header band, aligned to the existing storefront tabs. */
  headerHeightDesktop: 90,
  /** Compact header at 390/320 px, where 65 px would crowd the viewport. */
  headerHeightMobile: 56,
  /** Smallest interactive target anywhere in the commerce UI. */
  minimumTouchTarget: 44,
  /** Card image area: 1.25:1 landscape, written as a CSS ratio. */
  productImageAspectRatio: "5 / 4",
  /** Grid gap between product cards. */
  productGridGap: 18,
  /** Centred content rail on the reference canvas. */
  railMaxWidth: 1390,
  /** Horizontal rail padding per breakpoint. */
  railPadding: { desktop: 24, mobile: 12, tablet: 16 },
  /** Catalog filter sidebar. */
  sidebarWidth: 230,
} as const;

/**
 * Implementation viewports from `docs/research/PAGE_TOPOLOGY.md`. Responsive work
 * is checked at these widths rather than at arbitrary ones.
 */
export const COMMERCE_VIEWPORTS = [1440, 1024, 768, 390, 320] as const;

/** Product grid columns per viewport, per the catalog and card specifications. */
export const COMMERCE_GRID_COLUMNS = { 320: 1, 390: 2, 768: 2, 1024: 3, 1440: 4 } as const;
