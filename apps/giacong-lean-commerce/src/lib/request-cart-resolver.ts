import "server-only";

import { fetchBagistoJson, getBagistoApiUrl } from "@/lib/bagisto-api";
import { CatalogApiError, getCatalogProduct } from "@/lib/bagisto-catalog";
import {
  resolveDemoCartProduct,
  toRequestCartProductResolution,
} from "@/lib/request-cart-demo";
import { demoCatalogFallbackAllowed } from "@/lib/demo-catalog-policy";
import { resolveRequestCart } from "@/lib/request-cart";
import {
  REQUEST_CART_ADJUSTMENT_CODES,
  type RequestCartLineKey,
  type RequestCartProductResolution,
  type ResolvedRequestCart,
  type ResolvedRequestCartLine,
} from "@/types/request-cart";

/**
 * Single catalog projection shared by the revalidate endpoint and the cart submit.
 * The explicitly selected demo mode reads its local fixture immediately, so quantity
 * edits never wait on an upstream source that is outside the review scope. Production
 * always reads Bagisto and never validates a cart against demo prices.
 */
export async function resolveCartProduct(slug: string): Promise<RequestCartProductResolution | null> {
  const demoAllowed = demoCatalogFallbackAllowed(process.env);
  if (demoAllowed) return resolveDemoCartProduct(slug);

  const product = await getCatalogProduct(slug);
  return product ? toRequestCartProductResolution(product) : null;
}

/**
 * Production pricing and sendability are decided by Bagisto in one batch call.
 * Demo mode remains local so an explicitly selected fixture never waits for Bagisto.
 */
export async function resolveRequestCartFromCatalog(lines: RequestCartLineKey[]): Promise<ResolvedRequestCart> {
  if (demoCatalogFallbackAllowed(process.env)) {
    return resolveRequestCart(lines, async (slug) => resolveDemoCartProduct(slug));
  }

  const url = getBagistoApiUrl("/api/b2b/catalog/resolve-cart", true);
  const { payload, response } = await fetchBagistoJson(url, {
    body: JSON.stringify({
      lines: lines.map((line) => ({
        parent_slug: line.parentSlug,
        quantity: line.quantity,
        variant_sku: line.variantSku,
      })),
    }),
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) throw new CatalogApiError("Không thể xác thực giỏ yêu cầu.", response.status);
  return parseCatalogCart(payload, lines);
}

function parseCatalogCart(payload: unknown, requestedLines: RequestCartLineKey[]): ResolvedRequestCart {
  const root = exactRecord(payload, "Giỏ Bagisto", ["cart"]);
  const cart = exactRecord(root.cart, "Giỏ Bagisto.cart", [
    "currency", "has_price_on_request", "is_submittable", "line_count", "lines",
    "priced_subtotal", "request_type", "snapshot_token", "total_quantity", "uniform_unit",
  ]);
  if (string(cart.currency, "Giỏ Bagisto.cart.currency") !== "VND") throw invalid("Tiền tệ không hợp lệ.");
  const lines = array(cart.lines, "Giỏ Bagisto.cart.lines").map((line, index) => parseLine(line, index));
  if (lines.length !== requestedLines.length || positiveInteger(cart.line_count, "Giỏ Bagisto.cart.line_count") !== lines.length) {
    throw invalid("Số dòng không khớp yêu cầu.");
  }
  for (const [index, line] of lines.entries()) {
    const requested = requestedLines[index];
    if (!requested || line.parentSlug !== requested.parentSlug || line.variantSku !== requested.variantSku || line.quantity !== requested.quantity) {
      throw invalid("Dòng phản hồi không khớp yêu cầu.");
    }
  }

  const requestType = string(cart.request_type, "Giỏ Bagisto.cart.request_type");
  if (requestType !== "Đặt sản phẩm" && requestType !== "Tư vấn số lượng lớn") throw invalid("Loại yêu cầu không hợp lệ.");
  return {
    currency: "VND",
    hasPriceOnRequest: boolean(cart.has_price_on_request, "Giỏ Bagisto.cart.has_price_on_request"),
    isSubmittable: boolean(cart.is_submittable, "Giỏ Bagisto.cart.is_submittable"),
    lineCount: lines.length,
    lines,
    pricedSubtotal: nonNegativeInteger(cart.priced_subtotal, "Giỏ Bagisto.cart.priced_subtotal"),
    requestType,
    snapshotToken: hash(cart.snapshot_token, "Giỏ Bagisto.cart.snapshot_token"),
    totalQuantity: nullableNonNegativeInteger(cart.total_quantity, "Giỏ Bagisto.cart.total_quantity"),
    uniformUnit: nullableString(cart.uniform_unit, "Giỏ Bagisto.cart.uniform_unit"),
  };
}

function parseLine(payload: unknown, index: number): ResolvedRequestCartLine {
  const label = `Giỏ Bagisto.cart.lines[${index}]`;
  const line = exactRecord(payload, label, [
    "adjustments", "contact_from_quantity", "image_url", "is_available", "is_submittable", "line_total",
    "minimum_order_quantity", "parent_slug", "price_on_request", "product_name", "quantity", "quantity_step",
    "unit", "unit_price", "variant_label", "variant_sku",
  ]);
  const adjustments = array(line.adjustments, `${label}.adjustments`).map((adjustment, adjustmentIndex) => {
    const value = record(adjustment, `${label}.adjustments[${adjustmentIndex}]`);
    const allowedKeys = ["code", "message", "suggested_quantity"];
    if (!Object.keys(value).every((key) => allowedKeys.includes(key)) || !Object.keys(value).includes("code") || !Object.keys(value).includes("message")) {
      throw invalid(`${label}.adjustments không hợp lệ.`);
    }
    const code = string(value.code, `${label}.adjustments[${adjustmentIndex}].code`);
    if (!REQUEST_CART_ADJUSTMENT_CODES.includes(code as typeof REQUEST_CART_ADJUSTMENT_CODES[number])) throw invalid("Mã điều chỉnh không hợp lệ.");
    const suggestedQuantity = value.suggested_quantity === undefined
      ? undefined
      : positiveInteger(value.suggested_quantity, `${label}.adjustments[${adjustmentIndex}].suggested_quantity`);
    return { code: code as typeof REQUEST_CART_ADJUSTMENT_CODES[number], message: string(value.message, `${label}.adjustments[${adjustmentIndex}].message`), suggestedQuantity };
  });
  return {
    adjustments,
    contactFromQuantity: nullablePositiveInteger(line.contact_from_quantity, `${label}.contact_from_quantity`),
    imageUrl: nullableString(line.image_url, `${label}.image_url`),
    isAvailable: boolean(line.is_available, `${label}.is_available`),
    isSubmittable: boolean(line.is_submittable, `${label}.is_submittable`),
    lineTotal: nullableNonNegativeInteger(line.line_total, `${label}.line_total`),
    minimumOrderQuantity: nullablePositiveInteger(line.minimum_order_quantity, `${label}.minimum_order_quantity`),
    parentSlug: string(line.parent_slug, `${label}.parent_slug`),
    priceOnRequest: boolean(line.price_on_request, `${label}.price_on_request`),
    productName: string(line.product_name, `${label}.product_name`),
    quantity: positiveInteger(line.quantity, `${label}.quantity`),
    quantityStep: nullablePositiveInteger(line.quantity_step, `${label}.quantity_step`),
    unit: string(line.unit, `${label}.unit`),
    unitPrice: nullableNonNegativeInteger(line.unit_price, `${label}.unit_price`),
    variantLabel: string(line.variant_label, `${label}.variant_label`),
    variantSku: string(line.variant_sku, `${label}.variant_sku`),
  };
}

function exactRecord(value: unknown, label: string, keys: string[]): Record<string, unknown> {
  const result = record(value, label);
  if (Object.keys(result).length !== keys.length || !keys.every((key) => key in result)) throw invalid(`${label} không đúng định dạng.`);
  return result;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw invalid(`${label} phải là object.`);
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw invalid(`${label} phải là mảng.`);
  return value;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string") throw invalid(`${label} phải là chuỗi.`);
  return value;
}

function nullableString(value: unknown, label: string): string | null {
  return value === null ? null : string(value, label);
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw invalid(`${label} phải là boolean.`);
  return value;
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || typeof value !== "number" || value < 1) throw invalid(`${label} phải là số nguyên dương.`);
  return value;
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || typeof value !== "number" || value < 0) throw invalid(`${label} phải là số nguyên không âm.`);
  return value;
}

function nullablePositiveInteger(value: unknown, label: string): number | null {
  return value === null ? null : positiveInteger(value, label);
}

function nullableNonNegativeInteger(value: unknown, label: string): number | null {
  return value === null ? null : nonNegativeInteger(value, label);
}

function hash(value: unknown, label: string): string {
  const result = string(value, label);
  if (!/^[a-f0-9]{64}$/.test(result)) throw invalid(`${label} không hợp lệ.`);
  return result;
}

function invalid(message: string): CatalogApiError {
  return new CatalogApiError(`Dữ liệu giỏ Bagisto không hợp lệ: ${message}`);
}
