// Client side of the request cart. Runs in the browser, so every server response is untrusted
// input: money is only rendered after the payload proves it is a finite number the server sent.
// No framework dependency, so Node behavior tests can drive it with relative .ts specifiers.
import { REQUEST_CART_ADJUSTMENT_CODES } from "../types/request-cart.ts";
import type {
  RequestCartAdjustment,
  RequestCartLineKey,
  ResolvedRequestCart,
  ResolvedRequestCartLine,
} from "../types/request-cart.ts";
import { isRequestCartLineKey } from "./request-cart-storage.ts";
import type { RequestCartReadResult } from "./request-cart-storage.ts";

export const REQUEST_CART_REVALIDATE_ENDPOINT = "/api/gui-yeu-cau/xac-thuc";
export const REQUEST_CART_SUBMIT_ENDPOINT = "/api/contact";
export const REQUEST_CART_SOURCE = "/gui-yeu-cau/";
export const REQUEST_CART_ACCEPTED_STORAGE_KEY = "giacong.request-cart.accepted.v1";

/**
 * A 502 or 504 means the intake service did not answer in time, not that it did nothing:
 * the request may already be recorded. Retrying reuses the same `requestId`, which the
 * Apps Script maps back to the original `Mã`, so a retry cannot create a second request.
 */
export const REQUEST_CART_INDETERMINATE_MESSAGE =
  "Chưa rõ yêu cầu đã được tiếp nhận hay chưa. Yêu cầu có thể đã được ghi nhận. "
  + "Vui lòng thử lại để nhận Mã, hoặc liên hệ hotline nếu vẫn chưa thấy Mã.";

export const REQUEST_CART_DRIFT_MESSAGE =
  "Giá hoặc tình trạng hàng vừa thay đổi. Vui lòng xem lại giỏ yêu cầu trước khi gửi.";

const REVALIDATE_FAILURE_MESSAGE = "Không thể xác thực giỏ yêu cầu. Vui lòng thử lại.";
const SNAPSHOT_TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const REQUEST_TYPES = new Set(["Đặt sản phẩm", "Tư vấn số lượng lớn"]);
const ADJUSTMENT_CODES = new Set<string>(REQUEST_CART_ADJUSTMENT_CODES);

export interface RevalidateBody {
  lines: RequestCartLineKey[];
}

export type RevalidateResult =
  | { cart: ResolvedRequestCart; status: "ok" }
  | { message: string; status: "error" };

/** The endpoint accepts exactly `{ lines }`, and a line exactly the three key fields. */
export function buildRevalidateBody(lines: RequestCartLineKey[]): RevalidateBody {
  return {
    lines: lines.map((line) => ({
      parentSlug: line.parentSlug,
      quantity: line.quantity,
      variantSku: line.variantSku,
    })),
  };
}

export function parseRevalidateResponse(status: number, body: unknown): RevalidateResult {
  if (status === 200 && isRecord(body) && body.ok === true && isResolvedRequestCart(body.cart)) {
    return { cart: body.cart, status: "ok" };
  }
  return { message: failureMessage(body), status: "error" };
}

export function failureMessage(body: unknown, fallback = REVALIDATE_FAILURE_MESSAGE): string {
  if (isRecord(body) && typeof body.message === "string" && body.message.trim() !== "") {
    return body.message.trim();
  }
  return fallback;
}

export function isResolvedRequestCart(value: unknown): value is ResolvedRequestCart {
  if (!isRecord(value) || !exactKeys(value, [
    "currency", "hasPriceOnRequest", "isSubmittable", "lineCount", "lines",
    "pricedSubtotal", "requestType", "snapshotToken", "totalQuantity", "uniformUnit",
  ])) {
    return false;
  }
  if (value.currency !== "VND") return false;
  if (typeof value.hasPriceOnRequest !== "boolean" || typeof value.isSubmittable !== "boolean") return false;
  if (!isMoney(value.pricedSubtotal)) return false;
  if (typeof value.requestType !== "string" || !REQUEST_TYPES.has(value.requestType)) return false;
  if (typeof value.snapshotToken !== "string" || !SNAPSHOT_TOKEN_PATTERN.test(value.snapshotToken)) return false;
  if (value.totalQuantity !== null && !isCount(value.totalQuantity)) return false;
  if (value.uniformUnit !== null && typeof value.uniformUnit !== "string") return false;
  if (!Array.isArray(value.lines) || value.lines.length === 0) return false;
  if (!isCount(value.lineCount) || value.lineCount !== value.lines.length) return false;
  return value.lines.every(isResolvedRequestCartLine);
}

function isResolvedRequestCartLine(value: unknown): value is ResolvedRequestCartLine {
  if (!isRecord(value) || !exactKeys(value, [
    "adjustments", "contactFromQuantity", "imageUrl", "isAvailable", "isSubmittable", "lineTotal",
    "minimumOrderQuantity", "parentSlug", "priceOnRequest", "productName", "quantity",
    "quantityStep", "unit", "unitPrice", "variantLabel", "variantSku",
  ]) && !exactKeys(value, [
    "adjustments", "contactFromQuantity", "imageUrl", "isAvailable", "isSubmittable", "lineTotal",
    "minimumOrderQuantity", "parentSlug", "priceOnRequest", "productName", "quantity",
    "quantityStep", "tierMinQuantity", "unit", "unitPrice", "variantLabel", "variantSku",
  ])) {
    return false;
  }
  if (!isRequestCartLineKey({
    parentSlug: value.parentSlug,
    quantity: value.quantity,
    variantSku: value.variantSku,
  })) {
    return false;
  }
  for (const key of ["isAvailable", "isSubmittable", "priceOnRequest"] as const) {
    if (typeof value[key] !== "boolean") return false;
  }
  for (const key of ["productName", "unit", "variantLabel"] as const) {
    if (typeof value[key] !== "string") return false;
  }
  if (value.imageUrl !== null && typeof value.imageUrl !== "string") return false;
  for (const key of ["contactFromQuantity", "minimumOrderQuantity", "quantityStep"] as const) {
    if (value[key] !== null && !isCount(value[key])) return false;
  }
  for (const key of ["lineTotal", "unitPrice"] as const) {
    if (value[key] !== null && !isMoney(value[key])) return false;
  }
  if ("tierMinQuantity" in value && value.tierMinQuantity !== null && !isCount(value.tierMinQuantity)) return false;
  return Array.isArray(value.adjustments) && value.adjustments.every(isAdjustment);
}

function isAdjustment(value: unknown): value is RequestCartAdjustment {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort();
  const shapeOk = keys.length === 2
    ? keys[0] === "code" && keys[1] === "message"
    : keys.length === 3 && keys[0] === "code" && keys[1] === "message" && keys[2] === "suggestedQuantity";
  if (!shapeOk) return false;
  if (typeof value.code !== "string" || !ADJUSTMENT_CODES.has(value.code)) return false;
  if (typeof value.message !== "string" || value.message === "") return false;
  return value.suggestedQuantity === undefined || isCount(value.suggestedQuantity);
}

/**
 * Warns when the server changed the priced state on its own. Only lines the customer left
 * untouched are compared, so editing a quantity or removing a line never reads as drift.
 */
export function driftNotice(
  previous: ResolvedRequestCart | null,
  next: ResolvedRequestCart,
): string | null {
  if (!previous || previous.snapshotToken === next.snapshotToken) return null;

  const before = new Map(previous.lines.map((line) => [lineIdentity(line), line]));
  for (const line of next.lines) {
    const earlier = before.get(lineIdentity(line));
    if (!earlier || earlier.quantity !== line.quantity) continue;
    if (earlier.unitPrice !== line.unitPrice || earlier.isAvailable !== line.isAvailable) {
      return REQUEST_CART_DRIFT_MESSAGE;
    }
  }
  return null;
}

function lineIdentity(line: ResolvedRequestCartLine): string {
  return `${line.parentSlug}\u0000${line.variantSku}`;
}

/** Explains a sanitized local cart, so a silent repair never looks like lost lines. */
export function hydrationNotice(read: Pick<RequestCartReadResult, "status"> & {
  dropped?: number;
  reason?: string;
}): string | null {
  if (read.status === "repaired") {
    return `Đã bỏ ${read.dropped ?? 0} dòng không còn hợp lệ khỏi giỏ yêu cầu.`;
  }
  if (read.status === "reset") {
    return "Giỏ yêu cầu đã được làm mới vì dữ liệu lưu trên máy không còn dùng được.";
  }
  return null;
}

function isMoney(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: object, keys: string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export interface RequestCartContact {
  address: string;
  companyName: string;
  deliveryLocation: string;
  email: string;
  message: string;
  name: string;
  neededBy: string;
  phone: string;
  vatInvoice: string;
}

export interface AcceptedRequestSnapshot {
  cart: ResolvedRequestCart;
  contact: RequestCartContact;
  receivedAt: string;
  reference: string;
}

export type RequestCartField = keyof RequestCartContact;

export interface SubmitBody extends RequestCartContact {
  lines: RequestCartLineKey[];
  requestId: string;
  snapshotToken: string;
  source: string;
}

export type SubmitResult =
  | { message: string; receivedAt: string | null; reference: string; status: "accepted" }
  | { errors: Partial<Record<RequestCartField, string>>; message: string; status: "invalid" }
  | { cart: ResolvedRequestCart | null; code: string; message: string; status: "conflict" }
  | { message: string; status: "indeterminate" }
  | { message: string; status: "failed" };

/**
 * Keeps the last accepted confirmation available after a refresh in this tab only. The server
 * never exposes a public lookup by reference, and the URL never contains customer details.
 */
export function serializeAcceptedRequest(snapshot: AcceptedRequestSnapshot): string {
  return JSON.stringify(snapshot);
}

export function parseAcceptedRequest(value: string | null): AcceptedRequestSnapshot | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed) || !exactKeys(parsed, ["cart", "contact", "receivedAt", "reference"])) return null;
    if (!isResolvedRequestCart(parsed.cart) || !isStoredRequestContact(parsed.contact)) return null;
    if (typeof parsed.receivedAt !== "string" || !Number.isFinite(Date.parse(parsed.receivedAt))) return null;
    if (typeof parsed.reference !== "string" || !/^[^\u0000-\u001f<>]{1,120}$/.test(parsed.reference)) return null;
    return {
      cart: parsed.cart,
      contact: parsed.contact,
      receivedAt: parsed.receivedAt,
      reference: parsed.reference,
    };
  } catch {
    return null;
  }
}

function isStoredRequestContact(value: unknown): value is RequestCartContact {
  if (!isRecord(value) || !exactKeys(value, [
    "address", "companyName", "deliveryLocation", "email", "message", "name", "neededBy", "phone", "vatInvoice",
  ])) return false;
  const limits: Record<RequestCartField, number> = {
    address: 300,
    companyName: 160,
    deliveryLocation: 120,
    email: 254,
    message: 2_000,
    name: 120,
    neededBy: 120,
    phone: 24,
    vatInvoice: 10,
  };
  for (const [field, maxLength] of Object.entries(limits) as Array<[RequestCartField, number]>) {
    if (typeof value[field] !== "string" || value[field].length > maxLength) return false;
  }
  return value.vatInvoice === "" || value.vatInvoice === "yes" || value.vatInvoice === "no";
}

const CONTACT_FIELDS: RequestCartField[] = [
  "address", "companyName", "deliveryLocation", "email", "message", "name", "neededBy", "phone", "vatInvoice",
];
const SUBMIT_FAILURE_MESSAGE = "Không thể gửi yêu cầu lúc này. Vui lòng thử lại.";

/**
 * Idempotency key for one logical request. Held across retries of the same attempt so a
 * timeout that already reached the Sheet returns the original `Mã` instead of duplicating it.
 */
export function createRequestId(source: Crypto | { getRandomValues: (target: Uint8Array) => Uint8Array } = globalThis.crypto): string {
  if ("randomUUID" in source && typeof source.randomUUID === "function") return source.randomUUID();

  const bytes = source.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The JSON branch of `/api/contact` accepts the RFQ contact fields and no client money. */
export function buildSubmitBody(input: {
  contact: RequestCartContact;
  lines: RequestCartLineKey[];
  requestId: string;
  snapshotToken: string;
}): SubmitBody {
  return {
    address: input.contact.address.trim(),
    companyName: input.contact.companyName.trim(),
    deliveryLocation: input.contact.deliveryLocation.trim(),
    email: input.contact.email.trim(),
    lines: buildRevalidateBody(input.lines).lines,
    message: input.contact.message.trim(),
    name: input.contact.name.trim(),
    neededBy: input.contact.neededBy.trim(),
    phone: input.contact.phone.trim(),
    requestId: input.requestId,
    snapshotToken: input.snapshotToken,
    source: REQUEST_CART_SOURCE,
    vatInvoice: input.contact.vatInvoice.trim(),
  };
}

export function parseSubmitResponse(status: number, body: unknown): SubmitResult {
  const message = failureMessage(body, SUBMIT_FAILURE_MESSAGE);

  if (status === 202 && isRecord(body) && body.ok === true) {
    const reference = typeof body.reference === "string" ? body.reference.trim() : "";
    if (reference !== "") {
      return {
        message: failureMessage(body, "Yêu cầu của bạn đã được tiếp nhận."),
        receivedAt: readReceivedAt(body),
        reference,
        status: "accepted",
      };
    }
    return { message: SUBMIT_FAILURE_MESSAGE, status: "failed" };
  }
  if (status === 400) {
    return { errors: fieldErrors(body), message, status: "invalid" };
  }
  if (status === 409) {
    const cart = isRecord(body) && isResolvedRequestCart(body.cart) ? body.cart : null;
    const code = isRecord(body) && typeof body.code === "string" ? body.code : "";
    return { cart, code, message, status: "conflict" };
  }
  if (status === 502 || status === 504) {
    return { message: REQUEST_CART_INDETERMINATE_MESSAGE, status: "indeterminate" };
  }
  return { message, status: "failed" };
}

function readReceivedAt(body: Record<string, unknown>): string | null {
  if (typeof body.receivedAt !== "string" || !Number.isFinite(Date.parse(body.receivedAt))) return null;
  return body.receivedAt;
}

function fieldErrors(body: unknown): Partial<Record<RequestCartField, string>> {
  if (!isRecord(body) || !isRecord(body.errors)) return {};
  const errors: Partial<Record<RequestCartField, string>> = {};
  for (const field of CONTACT_FIELDS) {
    const value = body.errors[field];
    if (typeof value === "string" && value.trim() !== "") errors[field] = value.trim();
  }
  return errors;
}
