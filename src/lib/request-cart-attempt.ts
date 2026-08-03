export const REQUEST_CART_ATTEMPT_STORAGE_KEY = "giacong.request-cart-attempt.v1";
export const REQUEST_CART_ATTEMPT_SCHEMA_VERSION = 1;
export const REQUEST_CART_ATTEMPT_TTL_MS = 6 * 60 * 60 * 1000;
export const REQUEST_CART_ATTEMPT_MAX_BYTES = 2048;

const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SNAPSHOT_TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

export interface RequestCartAttemptContext {
  requestId: string;
  schemaVersion: number;
  snapshotToken: string;
  updatedAt: string;
}

export interface RequestCartAttemptStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function readRequestCartAttempt(
  storage: RequestCartAttemptStorage,
  expectedSnapshotToken: string,
  now = Date.now(),
): RequestCartAttemptContext | null {
  let raw: string | null;
  try {
    raw = storage.getItem(REQUEST_CART_ATTEMPT_STORAGE_KEY);
  } catch {
    return null;
  }

  if (raw === null) return null;
  if (byteLength(raw) > REQUEST_CART_ATTEMPT_MAX_BYTES) {
    clearRequestCartAttempt(storage);
    return null;
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    clearRequestCartAttempt(storage);
    return null;
  }

  if (!isValidAttempt(value, expectedSnapshotToken, now)) {
    clearRequestCartAttempt(storage);
    return null;
  }

  return value;
}

export function writeRequestCartAttempt(
  storage: RequestCartAttemptStorage,
  attempt: RequestCartAttemptContext,
): void {
  const payload: RequestCartAttemptContext = {
    requestId: attempt.requestId,
    schemaVersion: attempt.schemaVersion,
    snapshotToken: attempt.snapshotToken,
    updatedAt: attempt.updatedAt,
  };

  try {
    storage.setItem(REQUEST_CART_ATTEMPT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Browser storage is an optimization for retries, never a reason to block a submit.
  }
}

export function clearRequestCartAttempt(storage: RequestCartAttemptStorage): void {
  try {
    storage.removeItem(REQUEST_CART_ATTEMPT_STORAGE_KEY);
  } catch {
    // Private browsing and quota policies can make removeItem fail; the next read will repair it.
  }
}

export function isRequestCartAttemptFresh(
  attempt: RequestCartAttemptContext,
  expectedSnapshotToken: string,
  now = Date.now(),
): boolean {
  return isValidAttempt(attempt, expectedSnapshotToken, now);
}

export function readBrowserRequestCartAttempt(
  expectedSnapshotToken: string,
  now = Date.now(),
): RequestCartAttemptContext | null {
  try {
    if (typeof window === "undefined") return null;
    return readRequestCartAttempt(window.sessionStorage, expectedSnapshotToken, now);
  } catch {
    return null;
  }
}

export function writeBrowserRequestCartAttempt(attempt: RequestCartAttemptContext): void {
  try {
    if (typeof window === "undefined") return;
    writeRequestCartAttempt(window.sessionStorage, attempt);
  } catch {
    // A browser without session storage can still submit normally.
  }
}

export function clearBrowserRequestCartAttempt(): void {
  try {
    if (typeof window === "undefined") return;
    clearRequestCartAttempt(window.sessionStorage);
  } catch {
    // A browser without session storage can still submit normally.
  }
}

function isValidAttempt(
  value: unknown,
  expectedSnapshotToken: string,
  now: number,
): value is RequestCartAttemptContext {
  if (!isRecord(value) || !hasExactKeys(value, ["requestId", "schemaVersion", "snapshotToken", "updatedAt"])) {
    return false;
  }
  if (value.schemaVersion !== REQUEST_CART_ATTEMPT_SCHEMA_VERSION) return false;
  if (typeof value.requestId !== "string" || !REQUEST_ID_PATTERN.test(value.requestId)) return false;
  if (typeof value.snapshotToken !== "string" || !SNAPSHOT_TOKEN_PATTERN.test(value.snapshotToken)) return false;
  if (value.snapshotToken !== expectedSnapshotToken) return false;
  if (typeof value.updatedAt !== "string") return false;

  const updatedAt = Date.parse(value.updatedAt);
  if (!Number.isFinite(updatedAt)) return false;
  const age = now - updatedAt;
  return age <= REQUEST_CART_ATTEMPT_TTL_MS && age >= -CLOCK_SKEW_TOLERANCE_MS;
}

function hasExactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const actual = Object.keys(value).sort();
  const expectedKeys = expected.slice().sort();
  return actual.length === expectedKeys.length && actual.every((key, index) => key === expectedKeys[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}
