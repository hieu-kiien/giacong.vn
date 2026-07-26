// Client-side request cart. Preview only: no server state, no cart table, no PII and no price.
// Everything read back from browser storage is untrusted input (other tabs, extensions, stale schemas).
import type { RequestCartLineKey, RequestCartState } from "../types/request-cart.ts";

export const REQUEST_CART_STORAGE_KEY = "giacong.request-cart.v1";
export const REQUEST_CART_SCHEMA_VERSION = 1;
export const REQUEST_CART_MAX_LINES = 20;
export const REQUEST_CART_MAX_QUANTITY = 1_000_000;
export const REQUEST_CART_MAX_BYTES = 32_768;

const PARENT_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,159}$/;
const VARIANT_SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/;

type ReadableStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;
type WritableStorage = Pick<Storage, "setItem">;

export type RequestCartReadResult =
  | { state: RequestCartState; status: "empty" }
  | { state: RequestCartState; status: "ok" }
  | { dropped: number; state: RequestCartState; status: "repaired" }
  | { reason: "oversize" | "unparseable" | "version"; state: RequestCartState; status: "reset" };

export type RequestCartMutationResult =
  | { state: RequestCartState; status: "invalid" | "line_limit" | "not_found" | "ok" };

export function emptyRequestCart(): RequestCartState {
  return { lines: [], schemaVersion: REQUEST_CART_SCHEMA_VERSION, updatedAt: new Date(0).toISOString() };
}

export function isRequestCartLineKey(value: unknown): value is RequestCartLineKey {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const line = value as Record<string, unknown>;
  return typeof line.parentSlug === "string"
    && PARENT_SLUG_PATTERN.test(line.parentSlug)
    && typeof line.variantSku === "string"
    && VARIANT_SKU_PATTERN.test(line.variantSku)
    && isRequestCartQuantity(line.quantity);
}

export function isRequestCartQuantity(value: unknown): value is number {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= 1
    && value <= REQUEST_CART_MAX_QUANTITY;
}

export function readRequestCart(storage: ReadableStorage): RequestCartReadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(REQUEST_CART_STORAGE_KEY);
  } catch {
    return { state: emptyRequestCart(), status: "empty" };
  }
  if (raw === null) return { state: emptyRequestCart(), status: "empty" };
  if (byteLength(raw) > REQUEST_CART_MAX_BYTES) return reset(storage, "oversize");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return reset(storage, "unparseable");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return reset(storage, "unparseable");
  }

  const candidate = parsed as Record<string, unknown>;
  if (candidate.schemaVersion !== REQUEST_CART_SCHEMA_VERSION) return reset(storage, "version");
  if (!Array.isArray(candidate.lines)) return reset(storage, "unparseable");

  const lines: RequestCartLineKey[] = [];
  const seen = new Set<string>();
  let dropped = 0;
  for (const entry of candidate.lines) {
    if (lines.length >= REQUEST_CART_MAX_LINES || !isRequestCartLineKey(entry) || seen.has(entry.variantSku)) {
      dropped += 1;
      continue;
    }
    seen.add(entry.variantSku);
    lines.push({ parentSlug: entry.parentSlug, quantity: entry.quantity, variantSku: entry.variantSku });
  }

  const updatedAt = typeof candidate.updatedAt === "string" ? candidate.updatedAt : emptyRequestCart().updatedAt;
  const state: RequestCartState = { lines, schemaVersion: REQUEST_CART_SCHEMA_VERSION, updatedAt };
  if (dropped === 0) return { state, status: "ok" };
  writeRequestCart(storage, state);
  return { dropped, state, status: "repaired" };
}

export function writeRequestCart(storage: WritableStorage, state: RequestCartState): void {
  try {
    storage.setItem(REQUEST_CART_STORAGE_KEY, JSON.stringify({
      lines: state.lines.map((line) => ({
        parentSlug: line.parentSlug,
        quantity: line.quantity,
        variantSku: line.variantSku,
      })),
      schemaVersion: REQUEST_CART_SCHEMA_VERSION,
      updatedAt: state.updatedAt,
    }));
  } catch {
    // A full or blocked storage must never break the storefront; the cart stays in memory.
  }
}

export function upsertRequestCartLine(
  state: RequestCartState,
  line: RequestCartLineKey,
): RequestCartMutationResult {
  if (!isRequestCartLineKey(line)) return { state, status: "invalid" };

  const index = state.lines.findIndex((item) => item.variantSku === line.variantSku);
  if (index === -1) {
    if (state.lines.length >= REQUEST_CART_MAX_LINES) return { state, status: "line_limit" };
    return { state: withLines([...state.lines, line]), status: "ok" };
  }

  const lines = state.lines.map((item, position) => (position === index
    ? { ...item, quantity: Math.min(item.quantity + line.quantity, REQUEST_CART_MAX_QUANTITY) }
    : item));
  return { state: withLines(lines), status: "ok" };
}

export function setRequestCartQuantity(
  state: RequestCartState,
  variantSku: string,
  quantity: number,
): RequestCartMutationResult {
  if (!isRequestCartQuantity(quantity)) return { state, status: "invalid" };
  if (!state.lines.some((line) => line.variantSku === variantSku)) return { state, status: "not_found" };

  const lines = state.lines.map((line) => (line.variantSku === variantSku ? { ...line, quantity } : line));
  return { state: withLines(lines), status: "ok" };
}

export function removeRequestCartLine(state: RequestCartState, variantSku: string): RequestCartState {
  const lines = state.lines.filter((line) => line.variantSku !== variantSku);
  return lines.length === state.lines.length ? state : withLines(lines);
}

export function toRequestCartKeys(state: RequestCartState): RequestCartLineKey[] {
  return state.lines.map((line) => ({
    parentSlug: line.parentSlug,
    quantity: line.quantity,
    variantSku: line.variantSku,
  }));
}

function withLines(lines: RequestCartLineKey[]): RequestCartState {
  return { lines, schemaVersion: REQUEST_CART_SCHEMA_VERSION, updatedAt: new Date().toISOString() };
}

function reset(storage: ReadableStorage, reason: "oversize" | "unparseable" | "version"): RequestCartReadResult {
  try {
    storage.removeItem(REQUEST_CART_STORAGE_KEY);
  } catch {
    // Nothing else to do: the caller still gets an empty cart.
  }
  return { reason, state: emptyRequestCart(), status: "reset" };
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}
