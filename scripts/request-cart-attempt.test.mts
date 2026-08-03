import assert from "node:assert/strict";
import test from "node:test";

const {
  REQUEST_CART_ATTEMPT_SCHEMA_VERSION,
  REQUEST_CART_ATTEMPT_STORAGE_KEY,
  REQUEST_CART_ATTEMPT_TTL_MS,
  clearRequestCartAttempt,
  clearBrowserRequestCartAttempt,
  readBrowserRequestCartAttempt,
  readRequestCartAttempt,
  writeBrowserRequestCartAttempt,
  writeRequestCartAttempt,
} = await import("../src/lib/request-cart-attempt.ts");

const NOW = Date.parse("2026-08-03T12:00:00.000Z");
const REQUEST_ID = "123e4567-e89b-42d3-a456-426614174000";
const SNAPSHOT_TOKEN = "a".repeat(64);

class FakeStorage {
  readonly writes: string[] = [];
  readonly removals: string[] = [];
  #value: string | null;
  #failOnGet: boolean;
  #failOnSet: boolean;
  #failOnRemove: boolean;

  constructor(
    initial: string | null = null,
    options: { failOnGet?: boolean; failOnSet?: boolean; failOnRemove?: boolean } = {},
  ) {
    this.#value = initial;
    this.#failOnGet = options.failOnGet ?? false;
    this.#failOnSet = options.failOnSet ?? false;
    this.#failOnRemove = options.failOnRemove ?? false;
  }

  getItem(key: string): string | null {
    if (this.#failOnGet) throw new Error("StorageUnavailable");
    return key === REQUEST_CART_ATTEMPT_STORAGE_KEY ? this.#value : null;
  }

  setItem(key: string, value: string): void {
    if (this.#failOnSet) throw new Error("QuotaExceededError");
    if (key === REQUEST_CART_ATTEMPT_STORAGE_KEY) this.#value = value;
    this.writes.push(value);
  }

  removeItem(key: string): void {
    if (this.#failOnRemove) throw new Error("StorageUnavailable");
    if (key === REQUEST_CART_ATTEMPT_STORAGE_KEY) this.#value = null;
    this.removals.push(key);
  }

  raw(): string | null {
    return this.#value;
  }
}

function validAttempt(overrides: Record<string, unknown> = {}) {
  return {
    requestId: REQUEST_ID,
    schemaVersion: REQUEST_CART_ATTEMPT_SCHEMA_VERSION,
    snapshotToken: SNAPSHOT_TOKEN,
    updatedAt: new Date(NOW - 60_000).toISOString(),
    ...overrides,
  };
}

test("round-trips one valid attempt for the matching snapshot", () => {
  const storage = new FakeStorage();
  const attempt = validAttempt();

  writeRequestCartAttempt(storage, attempt);

  assert.deepEqual(readRequestCartAttempt(storage, SNAPSHOT_TOKEN, NOW), attempt);
  assert.deepEqual(Object.keys(JSON.parse(storage.raw() ?? "{}")).sort(), [
    "requestId",
    "schemaVersion",
    "snapshotToken",
    "updatedAt",
  ]);
});

test("does not restore an attempt for a different snapshot", () => {
  const storage = new FakeStorage(JSON.stringify(validAttempt()));

  assert.equal(readRequestCartAttempt(storage, "b".repeat(64), NOW), null);
  assert.deepEqual(storage.removals, [REQUEST_CART_ATTEMPT_STORAGE_KEY]);
});

test("removes malformed, foreign-version, invalid-id, and expired attempts", () => {
  const samples = [
    "{not json",
    JSON.stringify(validAttempt({ schemaVersion: 2 })),
    JSON.stringify(validAttempt({ requestId: "not-a-uuid" })),
    JSON.stringify(validAttempt({ snapshotToken: "not-a-token" })),
    JSON.stringify(validAttempt({ updatedAt: new Date(NOW - REQUEST_CART_ATTEMPT_TTL_MS - 1).toISOString() })),
  ];

  for (const sample of samples) {
    const storage = new FakeStorage(sample);
    assert.equal(readRequestCartAttempt(storage, SNAPSHOT_TOKEN, NOW), null, sample);
    assert.deepEqual(storage.removals, [REQUEST_CART_ATTEMPT_STORAGE_KEY], sample);
  }
});

test("rejects unexpected fields instead of retaining them", () => {
  const storage = new FakeStorage(JSON.stringify(validAttempt({ email: "customer@example.com" })));

  assert.equal(readRequestCartAttempt(storage, SNAPSHOT_TOKEN, NOW), null);
  assert.deepEqual(storage.removals, [REQUEST_CART_ATTEMPT_STORAGE_KEY]);
});

test("clears a stored attempt and swallows storage failures", () => {
  const storage = new FakeStorage(JSON.stringify(validAttempt()));
  assert.doesNotThrow(() => clearRequestCartAttempt(storage));
  assert.equal(storage.raw(), null);

  assert.doesNotThrow(() => readRequestCartAttempt(new FakeStorage(null, { failOnGet: true }), SNAPSHOT_TOKEN, NOW));
  assert.doesNotThrow(() => writeRequestCartAttempt(new FakeStorage(null, { failOnSet: true }), validAttempt()));
  assert.doesNotThrow(() => clearRequestCartAttempt(new FakeStorage(null, { failOnRemove: true })));
});

test("browser helpers use session storage and remain safe during server rendering", () => {
  const storage = new FakeStorage();
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const attempt = validAttempt();

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { sessionStorage: storage },
  });

  try {
    writeBrowserRequestCartAttempt(attempt);
    assert.deepEqual(readBrowserRequestCartAttempt(SNAPSHOT_TOKEN, NOW), attempt);
    clearBrowserRequestCartAttempt();
    assert.equal(storage.raw(), null);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }

  assert.equal(readBrowserRequestCartAttempt(SNAPSHOT_TOKEN, NOW), null);
  assert.doesNotThrow(() => writeBrowserRequestCartAttempt(attempt));
  assert.doesNotThrow(() => clearBrowserRequestCartAttempt());
});
