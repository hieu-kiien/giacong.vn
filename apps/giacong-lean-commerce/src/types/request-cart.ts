export const REQUEST_CART_ADJUSTMENT_CODES = [
  "PRODUCT_NOT_FOUND",
  "VARIANT_NOT_FOUND",
  "VARIANT_UNAVAILABLE",
  "QUANTITY_BELOW_MOQ",
  "QUANTITY_OFF_STEP",
  "PRICE_ON_REQUEST",
] as const;

export type RequestCartAdjustmentCode = (typeof REQUEST_CART_ADJUSTMENT_CODES)[number];

export interface RequestCartAdjustment {
  code: RequestCartAdjustmentCode;
  message: string;
  suggestedQuantity?: number;
}

/** The only cart shape the client keeps and the only one the server accepts. */
export interface RequestCartLineKey {
  parentSlug: string;
  quantity: number;
  variantSku: string;
}

export interface RequestCartState {
  lines: RequestCartLineKey[];
  schemaVersion: number;
  updatedAt: string;
}

export interface ResolvedRequestCartLine {
  adjustments: RequestCartAdjustment[];
  contactFromQuantity: number | null;
  imageUrl: string | null;
  isAvailable: boolean;
  isSubmittable: boolean;
  lineTotal: number | null;
  minimumOrderQuantity: number | null;
  parentSlug: string;
  priceOnRequest: boolean;
  productName: string;
  quantity: number;
  quantityStep: number | null;
  unit: string;
  unitPrice: number | null;
  variantLabel: string;
  variantSku: string;
}

export type RequestCartType = "Đặt sản phẩm" | "Tư vấn số lượng lớn";

export interface ResolvedRequestCart {
  currency: "VND";
  hasPriceOnRequest: boolean;
  isSubmittable: boolean;
  lineCount: number;
  lines: ResolvedRequestCartLine[];
  pricedSubtotal: number;
  requestType: RequestCartType;
  snapshotToken: string;
  totalQuantity: number | null;
  uniformUnit: string | null;
}

/** Catalog projection the server needs to price and validate a cart line. */
export interface RequestCartVariantResolution {
  contactFromQuantity: number;
  /** Variant-owned photo; null/undefined means the line reuses the parent product image. */
  imageUrl?: string | null;
  isAvailable: boolean;
  label: string;
  minimumOrderQuantity: number;
  quantityStep: number;
  sku: string;
  tierPrices: Array<{ minQuantity: number; price: number }>;
  unit: string;
}

export interface RequestCartProductResolution {
  imageUrl: string | null;
  name: string;
  slug: string;
  variants: RequestCartVariantResolution[];
}

export type RequestCartResolver = (slug: string) => Promise<RequestCartProductResolution | null>;
