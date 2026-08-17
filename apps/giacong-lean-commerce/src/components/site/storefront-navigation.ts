export const storefrontNavigation = [
  {
    key: "products",
    label: "Sản phẩm",
    menuItemId: "menu-item-1742",
    pathPrefix: "/san-pham",
  },
  {
    key: "services",
    label: "Thuê gia công",
    menuItemId: "menu-item-5166",
    pathPrefix: "/thue-gia-cong",
  },
  {
    key: "news",
    label: "Tin tức",
    menuItemId: "menu-item-1541",
    pathPrefix: "/tin-tuc",
  },
] as const;

export type StorefrontNavigationKey = (typeof storefrontNavigation)[number]["key"];

export function getStorefrontNavigation(key: StorefrontNavigationKey) {
  return storefrontNavigation.find((item) => item.key === key);
}

export function getStorefrontNavigationForPath(pathname: string) {
  return storefrontNavigation.find((item) => pathname.startsWith(item.pathPrefix));
}
