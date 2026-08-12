/**
 * Numeric mirror of `src/styles/commerce-foundation.css`.
 *
 * Layout code needs some of these as numbers — grid maths, `sizes` attributes,
 * intersection thresholds — and CSS custom properties cannot be read at build
 * time. `scripts/commerce-foundation.test.mts` asserts both files agree, so the
 * stylesheet stays the single place a value is *changed*.
 *
 * The commerce-only values began as screenshot measurements. `brand` is now the real
 * giacong.vn green instead, and `brandDark` is derived from it — see the header comment
 * in `commerce-foundation.css` for why. Header height follows the established
 * storefront chrome so the catalog and service tabs share one visual rhythm.
 */

export const COMMERCE_COLORS = {
  activeSurface: "#f1f8ec",
  body: "#191919",
  border: "#dfe3df",
  brand: "#5aa400",
  brandDark: "#457f00",
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
  /** Card image area: square, as the shop archive serves it. */
  productImageAspectRatio: "1 / 1",
  /**
   * Grid gap between product cards, from the archive's `.row-small > .col`
   * padding of `0 9.8px 19.6px` — so the column gap is half the row gap.
   */
  productGridGap: { column: 9.8, row: 19.6 },
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

/**
 * Product grid columns per viewport, as the shop archive giacong.vn serves them:
 * `small-columns-2 medium-columns-4 large-columns-6`. This supersedes the 1/2/2/3/4
 * ladder the catalog specification drew before the captured pages were the reference.
 */
export const COMMERCE_GRID_COLUMNS = { 320: 2, 390: 2, 768: 4, 1024: 4, 1440: 6 } as const;
