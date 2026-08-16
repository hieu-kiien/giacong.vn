import type { CatalogProductDetail, CatalogProductParent, CatalogVariant } from "./catalog";
import type { ResolvedRequestCart } from "./request-cart";

/**
 * Shared view-model contracts for the commerce surfaces. Components may derive
 * these models from D1/catalog responses, but they must not invent money or
 * availability values in the browser.
 */
export interface CommerceShellViewModel {
  brandName: string;
  requestHref: string;
  supportPhone: string;
  supportPhoneHref: string;
}

export interface CommerceMegaMenuViewModel {
  callouts: readonly {
    description: string;
    href: string;
    title: string;
  }[];
  categories: readonly {
    count: number;
    isActive: boolean;
    label: string;
    slug: string;
    subcategories: readonly {
      count: number;
      label: string;
      productSlug: string;
      thumbnailUrl: string | null;
    }[];
  }[];
  featured: readonly {
    categorySlug: string;
    imageUrl: string | null;
    name: string;
    price: number | null;
    productSlug: string;
    specificationLabel: string;
  }[];
}

export interface CommerceProductCardViewModel {
  detailHref: string;
  imageUrl: string | null;
  name: string;
  product: CatalogProductParent;
  startingPrice: number | null;
  unitLabel: string | null;
}

export interface CommerceProductDetailViewModel {
  detail: CatalogProductDetail;
  gallery: readonly string[];
  selectedVariant: CatalogVariant | null;
}

export interface CommerceRequestCartViewModel {
  cart: ResolvedRequestCart;
  requestHref: string;
  supportPhone: string;
}

export type { ResolvedRequestCart };