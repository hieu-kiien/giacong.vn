// Stateless request-cart revalidation. No framework dependency so Node behavior tests can drive it.
// The server is the only source of truth for price and totals: client-supplied money is never read.
import { createHash } from "node:crypto";

import {
  REQUEST_CART_MAX_LINES,
  isRequestCartLineKey,
} from "./request-cart-storage.ts";
import type {
  RequestCartAdjustment,
  RequestCartLineKey,
  RequestCartProductResolution,
  RequestCartResolver,
  RequestCartVariantResolution,
  ResolvedRequestCart,
  ResolvedRequestCartLine,
} from "../types/request-cart.ts";

export const REQUEST_CART_MAX_BODY_BYTES = 16_384;
export const CONTACT_MAX_BODY_BYTES = 65_536;

export interface CartRevalidationDependencies {
  cartBatchResolver?: (lines: RequestCartLineKey[]) => Promise<ResolvedRequestCart>;
  cartResolver?: RequestCartResolver;
}

export type CartLinesParseResult =
  | { lines: RequestCartLineKey[]; ok: true }
  | { message: string; ok: false };

/** Parses an untrusted `lines` value into keys. Rejects instead of silently repairing. */
export function parseRequestCartLines(value: unknown): CartLinesParseResult {
  if (!Array.isArray(value) || value.length === 0) {
    return { message: "Giỏ yêu cầu phải có ít nhất một dòng.", ok: false };
  }
  if (value.length > REQUEST_CART_MAX_LINES) {
    return { message: `Giỏ yêu cầu chỉ nhận tối đa ${REQUEST_CART_MAX_LINES} dòng.`, ok: false };
  }

  const lines: RequestCartLineKey[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (!isRequestCartLineKey(entry) || !exactKeys(entry, ["parentSlug", "quantity", "variantSku"])) {
      return { message: "Dòng giỏ yêu cầu không hợp lệ.", ok: false };
    }
    const identity = `${entry.parentSlug}\u0000${entry.variantSku}`;
    if (seen.has(identity)) {
      return { message: "Giỏ yêu cầu có dòng trùng biến thể.", ok: false };
    }
    seen.add(identity);
    lines.push({ parentSlug: entry.parentSlug, quantity: entry.quantity, variantSku: entry.variantSku });
  }
  return { lines, ok: true };
}

export type RequestCartBatchResolver = (
  slugs: string[],
) => Promise<Map<string, RequestCartProductResolution | null>>;

/** Re-reads the catalog for every line, then derives price, totals and the request tier. */
export async function resolveRequestCart(
  lines: RequestCartLineKey[],
  resolver: RequestCartResolver,
): Promise<ResolvedRequestCart> {
  const slugs = [...new Set(lines.map((line) => line.parentSlug))];
  const products = new Map<string, RequestCartProductResolution | null>();
  for (const slug of slugs) {
    products.set(slug, await resolver(slug));
  }
  return assembleResolvedCart(lines, products);
}

/**
 * Same canonical engine as {@link resolveRequestCart} but the catalog is fetched
 * once for all unique parent slugs (one batched D1 read instead of one per line).
 */
export async function resolveRequestCartBatch(
  lines: RequestCartLineKey[],
  batchResolver: RequestCartBatchResolver,
): Promise<ResolvedRequestCart> {
  const slugs = [...new Set(lines.map((line) => line.parentSlug))];
  const products = await batchResolver(slugs);
  return assembleResolvedCart(lines, products);
}

function assembleResolvedCart(
  lines: RequestCartLineKey[],
  products: Map<string, RequestCartProductResolution | null>,
): ResolvedRequestCart {
  const resolved = lines.map((line) => resolveLine(line, products.get(line.parentSlug) ?? null));
  const units = new Set(resolved.map((line) => line.unit).filter((unit) => unit !== ""));
  const uniformUnit = units.size === 1 ? [...units][0] : null;

  return {
    currency: "VND",
    hasPriceOnRequest: resolved.some((line) => line.priceOnRequest),
    isSubmittable: resolved.length > 0 && resolved.every((line) => line.isSubmittable),
    lineCount: resolved.length,
    lines: resolved,
    pricedSubtotal: resolved.reduce((total, line) => total + (line.lineTotal ?? 0), 0),
    requestType: resolved.some((line) => line.priceOnRequest) ? "Tư vấn số lượng lớn" : "Đặt sản phẩm",
    snapshotToken: snapshotToken(resolved),
    totalQuantity: uniformUnit ? resolved.reduce((total, line) => total + line.quantity, 0) : null,
    uniformUnit,
  };
}

export async function handleCartRevalidation(
  request: Request,
  dependencies: CartRevalidationDependencies,
): Promise<Response> {
  if (!isJsonRequest(request)) return cartFailure("Dữ liệu gửi lên không hợp lệ.", 400);

  const body = await readJsonBody(request, REQUEST_CART_MAX_BODY_BYTES);
  if (!body.ok) return cartFailure(body.message, body.status);

  const payload = body.value;
  if (!isRecord(payload) || !exactKeys(payload, ["lines"])) {
    return cartFailure("Dữ liệu giỏ yêu cầu không hợp lệ.", 400);
  }
  const parsed = parseRequestCartLines(payload.lines);
  if (!parsed.ok) return cartFailure(parsed.message, 400);

  let cart: ResolvedRequestCart;
  try {
    if (dependencies.cartBatchResolver) {
      cart = await dependencies.cartBatchResolver(parsed.lines);
    } else if (dependencies.cartResolver) {
      cart = await resolveRequestCart(parsed.lines, dependencies.cartResolver);
    } else {
      return cartFailure("Không thể xác thực giỏ yêu cầu. Vui lòng thử lại.", 502);
    }
  } catch {
    return cartFailure("Không thể xác thực giỏ yêu cầu. Vui lòng thử lại.", 502);
  }

  return Response.json({ cart, ok: true }, { headers: { "Cache-Control": "no-store" }, status: 200 });
}

export type JsonBodyResult =
  | { ok: true; value: unknown }
  | { message: string; ok: false; status: 400 | 413 };

/** Route handlers do not cap body size for us, so the byte guard is explicit. */
export async function readJsonBody(request: Request, maxBytes: number): Promise<JsonBodyResult> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { message: "Dữ liệu gửi lên quá lớn.", ok: false, status: 413 };
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return { message: "Dữ liệu gửi lên không hợp lệ.", ok: false, status: 400 };
  }
  if (new TextEncoder().encode(raw).length > maxBytes) {
    return { message: "Dữ liệu gửi lên quá lớn.", ok: false, status: 413 };
  }

  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { message: "Dữ liệu gửi lên không hợp lệ.", ok: false, status: 400 };
  }
}

export function isJsonRequest(request: Request): boolean {
  const contentType = request.headers.get("content-type")?.trim() ?? "";
  return /^application\/json(?:\s*;.*)?$/i.test(contentType);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function exactKeys(value: object, keys: string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function resolveLine(
  line: RequestCartLineKey,
  product: RequestCartProductResolution | null,
): ResolvedRequestCartLine {
  if (!product) {
    return unresolvedLine(line, {
      code: "PRODUCT_NOT_FOUND",
      message: "Sản phẩm không còn tồn tại. Vui lòng xóa dòng này.",
    });
  }

  const variant = product.variants.find((item) => item.sku === line.variantSku);
  if (!variant) {
    return {
      ...unresolvedLine(line, {
        code: "VARIANT_NOT_FOUND",
        message: "Biến thể không còn tồn tại. Vui lòng xóa dòng này.",
      }),
      productName: product.name,
    };
  }

  const base: ResolvedRequestCartLine = {
    adjustments: [],
    contactFromQuantity: variant.contactFromQuantity,
    imageUrl: variant.imageUrl || product.imageUrl,
    isAvailable: variant.isAvailable,
    isSubmittable: true,
    lineTotal: null,
    minimumOrderQuantity: variant.minimumOrderQuantity,
    parentSlug: line.parentSlug,
    priceOnRequest: false,
    productName: product.name,
    quantity: line.quantity,
    quantityStep: variant.quantityStep,
    tierMinQuantity: null,
    unit: variant.unit,
    unitPrice: null,
    variantLabel: variant.label,
    variantSku: variant.sku,
  };

  if (!variant.isAvailable) {
    return blocked(base, {
      code: "VARIANT_UNAVAILABLE",
      message: "Biến thể hiện không khả dụng. Vui lòng xóa dòng này.",
    });
  }
  if (line.quantity < variant.minimumOrderQuantity) {
    return blocked(base, {
      code: "QUANTITY_BELOW_MOQ",
      message: `Số lượng tối thiểu là ${variant.minimumOrderQuantity} ${variant.unit}.`,
      suggestedQuantity: variant.minimumOrderQuantity,
    });
  }
  if ((line.quantity - variant.minimumOrderQuantity) % variant.quantityStep !== 0) {
    return blocked(base, {
      code: "QUANTITY_OFF_STEP",
      message: `Số lượng phải theo bước ${variant.quantityStep} ${variant.unit}.`,
      suggestedQuantity: nextStepQuantity(line.quantity, variant),
    });
  }
  if (line.quantity >= variant.contactFromQuantity) {
    return {
      ...base,
      adjustments: [{
        code: "PRICE_ON_REQUEST",
        message: `Từ ${variant.contactFromQuantity} ${variant.unit}, giá được báo riêng theo số lượng.`,
      }],
      priceOnRequest: true,
    };
  }

  const matchedTier = resolveTier(line.quantity, variant.tierPrices);
  if (matchedTier === null) {
    return {
      ...base,
      adjustments: [{
        code: "PRICE_ON_REQUEST",
        message: "Giá của số lượng này được báo riêng.",
      }],
      priceOnRequest: true,
    };
  }
  return {
    ...base,
    lineTotal: matchedTier.price * line.quantity,
    tierMinQuantity: matchedTier.minQuantity,
    unitPrice: matchedTier.price,
  };
}

/** Highest tier whose minimum does not exceed the quantity. */
export function resolveTierPrice(
  quantity: number,
  tierPrices: Array<{ minQuantity: number; price: number }>,
): number | null {
  return resolveTier(quantity, tierPrices)?.price ?? null;
}

function resolveTier(
  quantity: number,
  tierPrices: Array<{ minQuantity: number; price: number }>,
): { minQuantity: number; price: number } | null {
  let matched: { minQuantity: number; price: number } | null = null;
  for (const tier of tierPrices) {
    if (tier.minQuantity <= quantity && (!matched || tier.minQuantity > matched.minQuantity)) {
      matched = tier;
    }
  }
  return matched;
}

function nextStepQuantity(quantity: number, variant: RequestCartVariantResolution): number {
  const steps = Math.ceil((quantity - variant.minimumOrderQuantity) / variant.quantityStep);
  return variant.minimumOrderQuantity + steps * variant.quantityStep;
}

function blocked(line: ResolvedRequestCartLine, adjustment: RequestCartAdjustment): ResolvedRequestCartLine {
  return { ...line, adjustments: [adjustment], isSubmittable: false, lineTotal: null, unitPrice: null };
}

function unresolvedLine(line: RequestCartLineKey, adjustment: RequestCartAdjustment): ResolvedRequestCartLine {
  return {
    adjustments: [adjustment],
    contactFromQuantity: null,
    imageUrl: null,
    isAvailable: false,
    isSubmittable: false,
    lineTotal: null,
    minimumOrderQuantity: null,
    parentSlug: line.parentSlug,
    priceOnRequest: false,
    productName: "",
    quantity: line.quantity,
    quantityStep: null,
    tierMinQuantity: null,
    unit: "",
    unitPrice: null,
    variantLabel: "",
    variantSku: line.variantSku,
  };
}

/**
 * Order-independent digest of the priced state a customer approved. Comparison only:
 * forging it can lose a drift warning but can never set a price, which the server always recomputes.
 */
function snapshotToken(lines: ResolvedRequestCartLine[]): string {
  const canonical = lines
    .map((line) => [
      line.parentSlug,
      line.variantSku,
      line.quantity,
      line.unitPrice,
      line.lineTotal,
      line.isAvailable,
      line.priceOnRequest,
      line.minimumOrderQuantity,
      line.quantityStep,
      line.contactFromQuantity,
      line.isSubmittable,
      line.tierMinQuantity ?? null,
    ])
    .sort((left, right) => String(left[1]).localeCompare(String(right[1])));
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function cartFailure(message: string, status: number): Response {
  return Response.json({ message, ok: false }, { headers: { "Cache-Control": "no-store" }, status });
}
