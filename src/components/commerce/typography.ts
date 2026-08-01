/**
 * Commerce type scale, as Tailwind utility strings.
 *
 * Utilities rather than CSS classes so a caller can extend or override a level
 * with `cn()` at the call site, which a `.module.css` class cannot do. Sizes are
 * the measured implementation ranges; the font is the bundled
 * SF Pro Display already wired to `--font-sans`.
 */

export const COMMERCE_TYPOGRAPHY = {
  /** 14–16 px body and control text. */
  body: "text-sm leading-6 text-commerce-body sm:text-base",
  /** 12–14 px secondary metadata. */
  metadata: "text-xs leading-5 text-commerce-secondary sm:text-sm",
  /** 36–40 px desktop, 28–32 px mobile, 700 weight. */
  pageTitle: "text-[28px] leading-tight font-bold text-commerce-body sm:text-[32px] lg:text-[38px]",
  /** 20–24 px, 700 weight, in the price red. */
  price: "text-[20px] leading-7 font-bold text-commerce-price sm:text-[22px] lg:text-[24px]",
  /** 16–18 px, 650–700 weight. */
  productTitle: "text-base leading-6 font-semibold text-commerce-body lg:text-[17px]",
  /** Section headings between the page title and body copy. */
  sectionTitle: "text-lg leading-7 font-bold text-commerce-body lg:text-xl",
} as const;

export type CommerceTypographyLevel = keyof typeof COMMERCE_TYPOGRAPHY;
