export interface StorefrontNavItem {
  href: string;
  label: string;
}

/**
 * Storefront navigation, taken from the master-plan sitemap. The captured menu
 * pointed product entries at `href="#"` and `/`; every target here resolves to a
 * real route. `/gui-yeu-cau` is deliberately absent: the route does not exist
 * yet, so the request-cart badge stays a status readout instead of a dead link.
 */
export const STOREFRONT_NAV_ITEMS: readonly StorefrontNavItem[] = [
  { href: "/", label: "Trang chủ" },
  { href: "/san-pham/", label: "Sản phẩm" },
  { href: "/thue-gia-cong/", label: "Thuê gia công" },
  { href: "/gioi-thieu-ve-gia-cong/", label: "Giới thiệu" },
  { href: "/lien-he/", label: "Liên hệ" },
];
