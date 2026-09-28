export type ImageAsset = {
  src: string;
  alt: string;
  width: number;
  height: number;
  blurDataURL?: string;
};

export type Money = { amount: number; currency: "VND" };

export type ProductSummary = {
  id: string;
  slug: string;
  name: string;
  category: { id: string; name: string; slug: string };
  image: ImageAsset;
  price: Money;
  unitLabel: string;
  packageSize: string;
  inStock: boolean;
  badge?: string;
  rating?: number;
  reviewCount?: number;
};

export type NavigationItem = {
  label: string;
  href: string;
  children?: NavigationItem[];
  megaMenu?: "products" | "services";
};
