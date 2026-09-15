export interface StorefrontNavItem {
  href: string;
  label: string;
}

/**
 * Storefront navigation. These are exactly the five header links
 * `scripts/verify-service-ia.mjs` locks, with the same labels and targets — the
 * captured menu pointed product entries at `href="#"` and `/`, but these all
 * resolve to real routes. The request-cart entry is kept in the header badge so
 * the primary navigation remains focused on shopping and service discovery.
 */
export const STOREFRONT_NAV_ITEMS: readonly StorefrontNavItem[] = [
  { href: "/", label: "Home" },
  { href: "/san-pham/", label: "Mua hàng" },
  { href: "/thue-gia-cong/", label: "Thuê gia công" },
  { href: "/tin-tuc/", label: "Tin tức" },
  { href: "/lien-he/", label: "Liên hệ" },
];
