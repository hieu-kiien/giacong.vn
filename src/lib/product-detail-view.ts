// View model for `/san-pham/[slug]`.
//
// Framework-free on purpose, so `scripts/product-detail.test.mts` can drive every
// rule — breadcrumb, gallery, tier bands, quantity clamping — as a plain module
// instead of through a rendered tree.
//
// Money boundary: the tier prices and the starting price come from the catalog,
// which the server read. The quantity helpers below format those server values for
// display only; the canonical unit price and subtotal for a submitted request are
// recomputed by `POST /api/gui-yeu-cau/xac-thuc`, and nothing here is ever written
// into the request cart.
import { buildDemoGallery } from "../data/demo-product-gallery.ts";
import type { DemoGalleryImage } from "../data/demo-product-gallery.ts";
import { clampCommerceQuantity } from "./commerce-ui.ts";
import { formatVnd } from "./format-vnd.ts";
import type { CatalogProductDetail, CatalogProductParent, CatalogTierPrice } from "../types/catalog.ts";

/** Only the cart route continues the request; `/lien-he` is no longer the detail CTA. */
export const REQUEST_ROUTE = "/gui-yeu-cau/";

const CONTACT_PRICE_LABEL = "Liên hệ báo giá";

export interface ProductDetailCrumb {
  /** `null` marks the current page, which is text rather than a link. */
  href: string | null;
  label: string;
}

/** One band of the tier table. `price: null` is the contact band. */
export interface ProductDetailTierRow {
  minQuantity: number;
  price: number | null;
  priceLabel: string;
  quantityLabel: string;
  savingPercent: number | null;
}

/** Commercial view of one variant: the single axis the specification allows. */
export interface ProductDetailVariantView {
  contactFromQuantity: number;
  isAvailable: boolean;
  label: string;
  minimumOrderQuantity: number;
  name: string;
  quantityStep: number;
  sku: string;
  tierPrices: readonly CatalogTierPrice[];
  tierRows: readonly ProductDetailTierRow[];
  unit: string;
}

export interface ProductDetailVariantChoice {
  isAvailable: boolean;
  label: string;
  sku: string;
}

/** Verified product fact, filling the space the excluded social-proof block used. */
export interface ProductDetailFact {
  label: string;
  value: string;
}

/** Compact card for the related rail. Presentation only — no social proof field. */
export interface ProductDetailRelatedCard {
  availabilityLabel: string;
  categoryLabel: string | null;
  detailHref: string;
  imageUrl: string;
  name: string;
  priceLabel: string;
  slug: string;
  specificationLabel: string;
}

export interface ProductDetailView {
  addToCartLabel: string;
  availabilityLabel: string;
  breadcrumb: readonly ProductDetailCrumb[];
  categoryLabel: string | null;
  defaultVariantSku: string;
  description: string;
  facts: readonly ProductDetailFact[];
  gallery: readonly DemoGalleryImage[];
  isAvailable: boolean;
  name: string;
  priceLabel: string;
  relatedProducts: readonly ProductDetailRelatedCard[];
  requestHref: string;
  requestLabel: string;
  shortDescription: string;
  sku: string;
  slug: string;
  unitLabel: string;
  variantAxisLabel: string;
  variantChoices: readonly ProductDetailVariantChoice[];
  variants: readonly ProductDetailVariantView[];
}

export interface ProductDetailInput {
  product: CatalogProductDetail;
  related?: readonly CatalogProductParent[];
}

export function buildProductDetailView({ product, related = [] }: ProductDetailInput): ProductDetailView {
  const usable = product.variants.filter((variant) => variant.isAvailable);
  const isAvailable = usable.length > 0;
  const defaultVariant = usable[0] ?? product.variants[0];
  const optionGroup = product.optionGroups[0];

  const variants = product.variants.map((variant) => buildVariantView(variant, optionGroup));

  return {
    addToCartLabel: "Thêm vào giỏ yêu cầu",
    availabilityLabel: isAvailable
      ? `${usable.length}/${product.variants.length} quy cách có sẵn`
      : "Tạm hết hàng",
    breadcrumb: buildBreadcrumb(product),
    categoryLabel: product.category?.name ?? null,
    defaultVariantSku: defaultVariant.sku,
    description: product.description,
    facts: buildFacts(product, defaultVariant),
    gallery: buildDemoGallery({
      categorySlug: product.category?.slug ?? null,
      imageUrl: product.imageUrl,
      productName: product.name,
    }),
    isAvailable,
    name: product.name,
    priceLabel: product.startingPrice ? formatVnd(product.startingPrice.price) : CONTACT_PRICE_LABEL,
    relatedProducts: related
      .filter((item) => item.slug !== product.slug)
      .map(buildRelatedCard),
    requestHref: REQUEST_ROUTE,
    requestLabel: "Yêu cầu báo giá",
    shortDescription: product.shortDescription,
    sku: product.sku,
    slug: product.slug,
    unitLabel: defaultVariant.unit,
    variantAxisLabel: optionGroup?.label ?? "Quy cách",
    variantChoices: variants.map((variant) => ({
      isAvailable: variant.isAvailable,
      label: variant.label,
      sku: variant.sku,
    })),
    variants,
  };
}

function buildBreadcrumb(product: CatalogProductDetail): ProductDetailCrumb[] {
  const crumbs: ProductDetailCrumb[] = [
    { href: "/", label: "Trang chủ" },
    { href: "/san-pham/", label: "Sản phẩm" },
  ];
  if (product.category) {
    crumbs.push({
      href: `/san-pham/?category=${encodeURIComponent(product.category.slug)}`,
      label: product.category.name,
    });
  }
  crumbs.push({ href: null, label: product.name });
  return crumbs;
}

/**
 * Facts, not claims: every value is read from the catalog record the server
 * already validated. This is what occupies the block the approved screenshot
 * spends on social proof, which V1 excludes.
 */
function buildFacts(
  product: CatalogProductDetail,
  variant: CatalogProductDetail["variants"][number],
): ProductDetailFact[] {
  return [
    { label: "Mã sản phẩm", value: product.sku },
    { label: "Quy cách", value: `${product.variantCount} lựa chọn` },
    { label: "Đặt tối thiểu", value: `${variant.minimumOrderQuantity} ${variant.unit}` },
    { label: "Bước số lượng", value: `${variant.quantityStep} ${variant.unit}` },
    { label: "Đơn vị tính", value: variant.unit },
    { label: "Danh mục", value: product.category?.name ?? "Đang cập nhật" },
  ];
}

function buildVariantView(
  variant: CatalogProductDetail["variants"][number],
  optionGroup: CatalogProductDetail["optionGroups"][number] | undefined,
): ProductDetailVariantView {
  const label = variant.optionValues[0]?.optionLabel
    ?? optionGroup?.options.find((option) => option.variantIds.includes(variant.id))?.label
    ?? variant.name;

  return {
    contactFromQuantity: variant.contactFromQuantity,
    isAvailable: variant.isAvailable,
    label,
    minimumOrderQuantity: variant.minimumOrderQuantity,
    name: variant.name,
    quantityStep: variant.quantityStep,
    sku: variant.sku,
    tierPrices: variant.tierPrices,
    tierRows: buildTierRows(variant),
    unit: variant.unit,
  };
}

/**
 * Tier bands plus the closing contact band. The saving percentage is measured
 * against the first band, and is only shown where that baseline is canonical —
 * the first band itself therefore reports no saving.
 */
function buildTierRows(variant: CatalogProductDetail["variants"][number]): ProductDetailTierRow[] {
  if (variant.tierPrices.length === 0) {
    return [{
      minQuantity: variant.minimumOrderQuantity,
      price: null,
      priceLabel: CONTACT_PRICE_LABEL,
      quantityLabel: "Báo giá theo yêu cầu",
      savingPercent: null,
    }];
  }

  const baseline = variant.tierPrices[0]?.price;
  const rows: ProductDetailTierRow[] = variant.tierPrices.map((tier, index) => ({
    minQuantity: tier.minQuantity,
    price: tier.price,
    priceLabel: formatVnd(tier.price),
    quantityLabel: `Từ ${tier.minQuantity} ${variant.unit}`,
    savingPercent: index === 0 || !baseline ? null : Math.round(((baseline - tier.price) / baseline) * 100),
  }));

  rows.push({
    minQuantity: variant.contactFromQuantity,
    price: null,
    priceLabel: CONTACT_PRICE_LABEL,
    quantityLabel: `Từ ${variant.contactFromQuantity} ${variant.unit}`,
    savingPercent: null,
  });
  return rows;
}

function buildRelatedCard(product: CatalogProductParent): ProductDetailRelatedCard {
  return {
    availabilityLabel: product.availableVariantCount > 0
      ? `${product.availableVariantCount}/${product.variantCount} quy cách có sẵn`
      : "Tạm hết hàng",
    categoryLabel: product.category?.name ?? null,
    detailHref: `/san-pham/${encodeURIComponent(product.slug)}/`,
    imageUrl: buildDemoGallery({
      categorySlug: product.category?.slug ?? null,
      imageUrl: product.imageUrl,
      productName: product.name,
    })[0].url,
    name: product.name,
    priceLabel: product.startingPrice ? `Từ ${formatVnd(product.startingPrice.price)}` : CONTACT_PRICE_LABEL,
    slug: product.slug,
    specificationLabel: `${product.variantCount} quy cách`,
  };
}

/** What one quantity costs, for display beside the stepper. */
export interface ProductDetailQuantityPricing {
  needsContact: boolean;
  quantity: number;
  subtotal: number | null;
  subtotalLabel: string;
  unitPrice: number | null;
  unitPriceLabel: string;
}

/**
 * Snaps a requested quantity onto the variant's MOQ/step grid, then reads the tier
 * band that applies. At or above `contactFromQuantity` no figure is shown at all:
 * that band is quoted, so displaying the last tier price there would be wrong.
 */
export function resolveQuantityPricing(
  variant: Pick<
    ProductDetailVariantView,
    "contactFromQuantity" | "minimumOrderQuantity" | "quantityStep" | "tierPrices" | "unit"
  >,
  requested: number,
): ProductDetailQuantityPricing {
  const quantity = clampCommerceQuantity(requested, {
    minimumOrderQuantity: variant.minimumOrderQuantity,
    quantityStep: variant.quantityStep,
  });

  if (variant.tierPrices.length === 0) {
    return {
      needsContact: true,
      quantity,
      subtotal: null,
      subtotalLabel: CONTACT_PRICE_LABEL,
      unitPrice: null,
      unitPriceLabel: CONTACT_PRICE_LABEL,
    };
  }

  if (quantity >= variant.contactFromQuantity) {
    return {
      needsContact: true,
      quantity,
      subtotal: null,
      subtotalLabel: CONTACT_PRICE_LABEL,
      unitPrice: null,
      unitPriceLabel: CONTACT_PRICE_LABEL,
    };
  }

  const band = [...variant.tierPrices]
    .reverse()
    .find((tier) => tier.minQuantity <= quantity)
    ?? variant.tierPrices[0];
  const total = band.price * quantity;

  return {
    needsContact: false,
    quantity,
    subtotal: total,
    subtotalLabel: formatVnd(total),
    unitPrice: band.price,
    unitPriceLabel: `${formatVnd(band.price)} / ${variant.unit}`,
  };
}
