/**
 * View model for the `/san-pham` listing and its product cards.
 *
 * Framework-free on purpose, so `scripts/catalog-listing.test.mts` can drive it
 * under Node and the same rules hold on the server component that renders the
 * grid. Imports use relative `.ts` specifiers for the same reason.
 *
 * Two rules shape everything here:
 *
 *  - **Nothing is invented.** The Bagisto list contract publishes no variants, so
 *    a card built from a list row exposes no variant SKU, no unit and no tier
 *    rows — it routes to detail instead. Only a source that actually carries
 *    variants (the demo fixture today, a richer feed later) can offer a direct
 *    add, and then only when exactly one variant is usable.
 *  - **Money is never computed.** `startingPrice` and `tierPrices` are passed
 *    through as the feed published them. Unit price and totals stay server-side
 *    inside `ResolvedRequestCart`.
 */
import { resolveCommerceCardAction } from "../../lib/commerce-ui.ts";
import type { CommerceCardAction } from "../../lib/commerce-ui.ts";
import {
  DEMO_CATALOG_CATEGORIES,
  DEMO_CATALOG_PRODUCTS,
} from "../../data/demo-catalog.ts";
import { demoProductImage } from "../../data/demo-product-images.ts";
import type {
  CatalogCategory,
  CatalogFilters,
  CatalogProductDetail,
  CatalogProductList,
  CatalogProductParent,
  CatalogTierPrice,
  CatalogVariant,
} from "../../types/catalog.ts";

/**
 * Benefits in the heading row of SCR-02. Each one is a claim the catalog can
 * actually back: tier pricing, MOQ, per-batch quality documents and packaging
 * advice. Nothing about delivery, settlement or returns, which V1 does not run.
 */
export const CATALOG_TRUST_BENEFITS: readonly { icon: CatalogTrustIcon; label: string }[] = [
  { icon: "tier", label: "Giá theo bậc số lượng" },
  { icon: "moq", label: "Số lượng đặt tối thiểu rõ ràng" },
  { icon: "document", label: "Hồ sơ chất lượng theo lô" },
  { icon: "support", label: "Tư vấn quy cách đóng gói" },
] as const;

export type CatalogTrustIcon = "document" | "moq" | "support" | "tier";

/** Purchase rule for a direct add. Present only with one canonical usable variant. */
export interface CatalogCardPurchaseRule {
  contactFromQuantity: number;
  minimumOrderQuantity: number;
  quantityStep: number;
  unit: string;
  variantSku: string;
}

export interface CatalogCardView {
  action: CommerceCardAction;
  availabilityLabel: string;
  categoryName: string | null;
  /** Quantity at which the feed switches to a quote, when the feed says so. */
  contactFromQuantity: number | null;
  detailHref: string;
  fallbackImageUrl: string;
  id: number;
  imageUrl: string | null;
  isAvailable: boolean;
  name: string;
  /** Null whenever the source cannot prove a single usable variant. */
  purchase: CatalogCardPurchaseRule | null;
  slug: string;
  specLabel: string;
  startingPrice: number | null;
  /** Tier rows exactly as published; empty when the source has none. */
  tierPrices: readonly CatalogTierPrice[];
  unitLabel: string | null;
}

/** A list row, or a detail row when the source happens to carry variants. */
type CatalogCardSource = CatalogProductParent | CatalogProductDetail;

function variantsOf(product: CatalogCardSource): readonly CatalogVariant[] {
  return "variants" in product && Array.isArray(product.variants) ? product.variants : [];
}

export function buildCatalogCards(products: readonly CatalogCardSource[]): CatalogCardView[] {
  return products.map((product, index) => buildCatalogCard(product, index));
}

export function buildCatalogCard(product: CatalogCardSource, index = 0): CatalogCardView {
  const variants = variantsOf(product);
  const usable = variants.filter((variant) => variant.isAvailable);
  // Without variants the action can only be "go to detail": `resolveCommerceCardAction`
  // would read an empty list as unavailable, which a list row does not prove.
  const action: CommerceCardAction = variants.length > 0
    ? resolveCommerceCardAction({ slug: product.slug, variants })
    : { href: detailHref(product.slug), kind: "select-variant", label: "Chọn quy cách" };
  const priceVariant = cheapestVariant(usable);
  const purchase = action.kind === "add-to-request-cart"
    ? purchaseRule(variants, action.variantSku)
    : null;
  const isAvailable = variants.length > 0
    ? usable.length > 0
    : product.availableVariantCount > 0;

  return {
    action,
    availabilityLabel: availabilityLabel(product, isAvailable),
    categoryName: product.category?.name.trim() ?? null,
    contactFromQuantity: priceVariant?.contactFromQuantity ?? null,
    detailHref: detailHref(product.slug),
    fallbackImageUrl: demoProductImage(index),
    id: product.id,
    imageUrl: product.imageUrl,
    isAvailable,
    name: product.name,
    purchase,
    slug: product.slug,
    specLabel: specLabel(product, priceVariant),
    startingPrice: product.startingPrice?.price ?? null,
    tierPrices: priceVariant?.tierPrices ?? [],
    unitLabel: priceVariant?.unit ?? null,
  };
}

function purchaseRule(
  variants: readonly CatalogVariant[],
  variantSku: string,
): CatalogCardPurchaseRule | null {
  const variant = variants.find((item) => item.sku === variantSku);
  if (!variant) return null;
  return {
    contactFromQuantity: variant.contactFromQuantity,
    minimumOrderQuantity: variant.minimumOrderQuantity,
    quantityStep: variant.quantityStep,
    unit: variant.unit,
    variantSku: variant.sku,
  };
}

/** Lowest MOQ-tier price among usable variants: the one the card's price refers to. */
function cheapestVariant(usable: readonly CatalogVariant[]): CatalogVariant | null {
  let cheapest: CatalogVariant | null = null;
  for (const variant of usable) {
    const price = variant.tierPrices[0]?.price;
    if (price === undefined) continue;
    if (!cheapest || price < (cheapest.tierPrices[0]?.price ?? Number.POSITIVE_INFINITY)) cheapest = variant;
  }
  return cheapest;
}

function detailHref(slug: string): string {
  return `/san-pham/${encodeURIComponent(slug)}/`;
}

function specLabel(product: CatalogCardSource, priceVariant: CatalogVariant | null): string {
  const count = `${product.variantCount} quy cách`;
  const option = priceVariant?.optionValues[0]?.optionLabel?.trim();
  return option && product.variantCount > 1 ? `${option} · ${count}` : option ?? count;
}

function availabilityLabel(product: CatalogCardSource, isAvailable: boolean): string {
  if (!isAvailable) return "Tạm hết hàng";
  return `Còn hàng · ${product.availableVariantCount}/${product.variantCount} quy cách`;
}

// ---------------------------------------------------------------------------
// Demo fallback
// ---------------------------------------------------------------------------

export const DEMO_CATALOG_NOTICE =
  "Đang hiển thị dữ liệu mẫu vì chưa kết nối được danh mục. Giá và quy cách chỉ để xem trước.";

export function demoCatalogCategories(): CatalogCategory[] {
  return [...DEMO_CATALOG_CATEGORIES];
}

/**
 * Applies the same query contract the Bagisto list endpoint answers, so a card
 * built from the fallback behaves identically to one built from the real feed —
 * search, category, sort, direction and pagination all included.
 */
export function demoCatalogList(filters: CatalogFilters): {
  pagination: CatalogProductList["pagination"];
  products: CatalogProductDetail[];
} {
  const query = filters.query.trim().toLowerCase();
  const matched = DEMO_CATALOG_PRODUCTS.filter((product) => {
    if (filters.category && product.category?.slug !== filters.category) return false;
    if (!query) return true;
    return `${product.name} ${product.shortDescription}`.toLowerCase().includes(query);
  });

  const sorted = [...matched].sort((left, right) => compareProducts(left, right, filters.sort));
  if (filters.direction === "desc") sorted.reverse();

  const total = sorted.length;
  const perPage = filters.pageSize;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(Math.max(1, filters.page), Math.max(lastPage, filters.page));
  const start = (currentPage - 1) * perPage;

  return {
    pagination: { currentPage, lastPage, perPage, total },
    products: sorted.slice(start, start + perPage),
  };
}

function compareProducts(
  left: CatalogProductDetail,
  right: CatalogProductDetail,
  sort: CatalogFilters["sort"],
): number {
  switch (sort) {
    case "available_variant_count":
      return left.availableVariantCount - right.availableVariantCount || left.id - right.id;
    case "id":
      return left.id - right.id;
    case "starting_price":
      return (left.startingPrice?.price ?? Number.POSITIVE_INFINITY)
        - (right.startingPrice?.price ?? Number.POSITIVE_INFINITY) || left.id - right.id;
    case "variant_count":
      return left.variantCount - right.variantCount || left.id - right.id;
    default:
      return left.name.localeCompare(right.name, "vi");
  }
}
