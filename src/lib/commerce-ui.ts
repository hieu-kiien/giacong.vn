// Shared commerce UI behaviour. Framework-free so Node behaviour tests can drive it.
//
// Only the two rules every commerce surface has to agree on live here: which action
// a product card offers, and how a quantity is clamped. Both were previously
// re-derived per component, which is how a card and a detail page drift apart.
//
// Money is absent on purpose. Unit price, line total and subtotal are computed by
// the server inside `ResolvedRequestCart`; nothing in this module reads or produces
// them.
import { REQUEST_CART_MAX_QUANTITY } from "./request-cart-storage.ts";

/** Quantity ceiling, shared with the request-cart storage contract. */
export const COMMERCE_MAX_QUANTITY = REQUEST_CART_MAX_QUANTITY;

export const COMMERCE_CARD_ACTION_KINDS = [
  "add-to-request-cart",
  "select-variant",
  "unavailable",
] as const;

export type CommerceCardActionKind = (typeof COMMERCE_CARD_ACTION_KINDS)[number];

/**
 * A product with exactly one usable variant may be added straight to the request
 * cart at its MOQ. Anything else must send the customer to detail: `select-variant`
 * and `unavailable` carry no `variantSku` at all, so no call site can add a line
 * under a variant key the catalog never issued.
 */
export type CommerceCardAction =
  | { defaultQuantity: number; kind: "add-to-request-cart"; label: string; variantSku: string }
  | { href: string; kind: "select-variant"; label: string }
  | { kind: "unavailable"; label: string };

/** Minimum a caller must supply; `CatalogProductDetail` satisfies it as-is. */
export interface CommerceCardVariantInput {
  isAvailable: boolean;
  minimumOrderQuantity: number;
  sku: string;
}

export interface CommerceCardProductInput {
  slug: string;
  variants: readonly CommerceCardVariantInput[];
}

export function resolveCommerceCardAction(product: CommerceCardProductInput): CommerceCardAction {
  const usable = product.variants.filter((variant) => variant.isAvailable);

  if (usable.length === 0) {
    return { kind: "unavailable", label: "Tạm hết hàng" };
  }
  if (usable.length > 1) {
    return { href: `/san-pham/${product.slug}/`, kind: "select-variant", label: "Chọn quy cách" };
  }

  const variant = usable[0];
  return {
    defaultQuantity: variant.minimumOrderQuantity,
    kind: "add-to-request-cart",
    label: "Thêm vào giỏ yêu cầu",
    variantSku: variant.sku,
  };
}

/** MOQ and step rule for a variant, as the catalog publishes it. */
export interface CommerceQuantityRule {
  minimumOrderQuantity: number;
  quantityStep: number;
}

/**
 * Snaps an untrusted quantity onto the variant's grid: at least the MOQ, on a
 * whole step above it, and never past the storage ceiling. Unparsable input falls
 * back to the MOQ rather than to zero, so an emptied number field cannot submit a
 * quantity the catalog would reject.
 *
 * Rounds up, matching the stepper: a customer who typed a value between two steps
 * asked for at least that much.
 */
export function clampCommerceQuantity(quantity: number, rule: CommerceQuantityRule): number {
  const { minimumOrderQuantity, quantityStep } = rule;
  const step = quantityStep > 0 ? quantityStep : 1;

  if (!Number.isFinite(quantity) || quantity <= minimumOrderQuantity) return minimumOrderQuantity;

  const steps = Math.ceil((quantity - minimumOrderQuantity) / step);
  const snapped = minimumOrderQuantity + steps * step;
  if (snapped <= COMMERCE_MAX_QUANTITY) return snapped;

  // At the ceiling, round *down* to stay on the grid instead of overshooting it.
  const withinCeiling = Math.floor((COMMERCE_MAX_QUANTITY - minimumOrderQuantity) / step);
  return withinCeiling > 0 ? minimumOrderQuantity + withinCeiling * step : minimumOrderQuantity;
}

/** One stepper press. The MOQ is the floor, so decrementing at it is a no-op. */
export function stepCommerceQuantity(
  quantity: number,
  direction: 1 | -1,
  rule: CommerceQuantityRule,
): number {
  const step = rule.quantityStep > 0 ? rule.quantityStep : 1;
  const current = clampCommerceQuantity(quantity, rule);
  return clampCommerceQuantity(current + direction * step, rule);
}
