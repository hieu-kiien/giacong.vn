import type { CatalogProductDetail, CatalogProductParent, CatalogVariant } from "./catalog";
import type { ResolvedRequestCart } from "./request-cart";

/**
 * Shared view-model contracts for the commerce surfaces. Components may derive
 * these models from D1/catalog responses, but they must not invent money or
 * availability values in the browser.
 */
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