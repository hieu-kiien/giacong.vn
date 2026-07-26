import assert from "node:assert/strict";
import test from "node:test";

const {
  REQUEST_CART_MAX_BYTES,
  REQUEST_CART_MAX_LINES,
  REQUEST_CART_MAX_QUANTITY,
  REQUEST_CART_SCHEMA_VERSION,
  REQUEST_CART_STORAGE_KEY,
  emptyRequestCart,
  readRequestCart,
  removeRequestCartLine,
  setRequestCartQuantity,
  toRequestCartKeys,
  upsertRequestCartLine,
  writeRequestCart,
} = await import("../src/lib/request-cart-storage" + ".ts");

type CartLine = { parentSlug: string; quantity: number; variantSku: string };

class FakeStorage {
  readonly writes: string[] = [];
  readonly removals: string[] = [];
  #values = new Map<string, string>();
  #failOnSet: boolean;

  constructor(initial?: string, failOnSet = false) {
    if (initial !== undefined) this.#values.set(REQUEST_CART_STORAGE_KEY, initial);
    this.#failOnSet = failOnSet;
  }

  getItem(key: string): string | null {
    return this.#values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.#failOnSet) throw new Error("QuotaExceededError");
    this.writes.push(value);
    this.#values.set(key, value);
  }

  removeItem(key: string): void {
    this.removals.push(key);
    this.#values.delete(key);
  }
}

function stored(lines: unknown, overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    lines,
    schemaVersion: REQUEST_CART_SCHEMA_VERSION,
    updatedAt: "2026-07-26T10:15:00.000Z",
    ...overrides,
  });
}

const validLine: CartLine = {
  parentSlug: "b2b-demo-bot-dinh-duong",
  quantity: 15,
  variantSku: "B2B-DEMO-VANILLA",
};

test("reads a well-formed versioned cart without repairing it", () => {
  const storage = new FakeStorage(stored([validLine]));
  const result = readRequestCart(storage);

  assert.equal(result.status, "ok");
  assert.deepEqual(result.state.lines, [validLine]);
  assert.equal(result.state.schemaVersion, REQUEST_CART_SCHEMA_VERSION);
  assert.deepEqual(storage.writes, []);
});

test("treats a missing key as an empty cart instead of an error", () => {
  const result = readRequestCart(new FakeStorage());

  assert.equal(result.status, "empty");
  assert.deepEqual(result.state, emptyRequestCart());
  assert.deepEqual(result.state.lines, []);
});

test("resets unparseable, wrong-shape, and foreign-version payloads", () => {
  const cases: Array<{ payload: string; reason: string }> = [
    { payload: "{not json", reason: "unparseable" },
    { payload: JSON.stringify(["array-root"]), reason: "unparseable" },
    { payload: JSON.stringify(null), reason: "unparseable" },
    { payload: stored([validLine], { schemaVersion: 2 }), reason: "version" },
    { payload: stored([validLine], { schemaVersion: "1" }), reason: "version" },
    { payload: stored("not-an-array"), reason: "unparseable" },
  ];

  for (const sample of cases) {
    const storage = new FakeStorage(sample.payload);
    const result = readRequestCart(storage);
    assert.equal(result.status, "reset", sample.payload);
    assert.equal(result.status === "reset" && result.reason, sample.reason, sample.payload);
    assert.deepEqual(result.state.lines, [], sample.payload);
    assert.deepEqual(storage.removals, [REQUEST_CART_STORAGE_KEY], sample.payload);
  }
});

test("resets a payload larger than the byte limit before parsing it", () => {
  const oversized = stored([{ ...validLine, parentSlug: "a".repeat(REQUEST_CART_MAX_BYTES) }]);
  assert.ok(oversized.length > REQUEST_CART_MAX_BYTES);

  const storage = new FakeStorage(oversized);
  const result = readRequestCart(storage);

  assert.equal(result.status, "reset");
  assert.equal(result.status === "reset" && result.reason, "oversize");
  assert.deepEqual(result.state.lines, []);
  assert.deepEqual(storage.removals, [REQUEST_CART_STORAGE_KEY]);
});

test("drops individually malformed lines and keeps the valid ones", () => {
  const storage = new FakeStorage(stored([
    validLine,
    { ...validLine, quantity: 1.5, variantSku: "B2B-FLOAT" },
    { ...validLine, quantity: "20", variantSku: "B2B-STRING" },
    { ...validLine, quantity: -1, variantSku: "B2B-NEGATIVE" },
    { ...validLine, quantity: 0, variantSku: "B2B-ZERO" },
    { ...validLine, quantity: REQUEST_CART_MAX_QUANTITY + 1, variantSku: "B2B-HUGE" },
    { ...validLine, quantity: Number.NaN, variantSku: "B2B-NAN" },
    { ...validLine, parentSlug: "Bad Slug", variantSku: "B2B-BAD-SLUG" },
    { ...validLine, parentSlug: "", variantSku: "B2B-EMPTY-SLUG" },
    { ...validLine, variantSku: "" },
    { ...validLine, variantSku: "sku with space" },
    { ...validLine, variantSku: "=cmd" },
    { parentSlug: "b2b-demo-bot-dinh-duong", quantity: 10 },
    "not-an-object",
    null,
    { ...validLine, quantity: 20, variantSku: "B2B-DEMO-LOWSUGAR", extra: "field" },
  ]));

  const result = readRequestCart(storage);

  assert.equal(result.status, "repaired");
  assert.deepEqual(result.state.lines, [
    validLine,
    { parentSlug: "b2b-demo-bot-dinh-duong", quantity: 20, variantSku: "B2B-DEMO-LOWSUGAR" },
  ]);
  assert.equal(result.status === "repaired" && result.dropped, 14);
  assert.equal(storage.writes.length, 1);
  assert.deepEqual(JSON.parse(storage.writes[0]).lines, result.state.lines);
});

test("keeps only the first of duplicate variant lines when repairing storage", () => {
  const storage = new FakeStorage(stored([
    validLine,
    { ...validLine, quantity: 25 },
  ]));

  const result = readRequestCart(storage);

  assert.equal(result.status, "repaired");
  assert.deepEqual(result.state.lines, [validLine]);
  assert.equal(result.status === "repaired" && result.dropped, 1);
});

test("truncates a cart above the line limit instead of accepting it", () => {
  const lines = Array.from({ length: REQUEST_CART_MAX_LINES + 4 }, (_, index) => ({
    ...validLine,
    variantSku: `B2B-DEMO-${index}`,
  }));
  const storage = new FakeStorage(stored(lines));

  const result = readRequestCart(storage);

  assert.equal(result.status, "repaired");
  assert.equal(result.state.lines.length, REQUEST_CART_MAX_LINES);
  assert.equal(result.status === "repaired" && result.dropped, 4);
  assert.equal(result.state.lines[0].variantSku, "B2B-DEMO-0");
});

test("never persists contact identity fields into browser storage", () => {
  const storage = new FakeStorage(stored([validLine]));
  const state = upsertRequestCartLine(readRequestCart(storage).state, validLine).state;
  writeRequestCart(storage, state);

  const persisted = storage.writes.at(-1) ?? "";
  assert.deepEqual(Object.keys(JSON.parse(persisted)).sort(), ["lines", "schemaVersion", "updatedAt"]);
  assert.deepEqual(Object.keys(JSON.parse(persisted).lines[0]).sort(), ["parentSlug", "quantity", "variantSku"]);
  for (const forbidden of ["name", "phone", "email", "message", "unitPrice", "price", "lineTotal", "subtotal"]) {
    assert.equal(persisted.includes(forbidden), false, forbidden);
  }
});

test("swallows a storage quota failure instead of breaking the caller", () => {
  const storage = new FakeStorage(undefined, true);
  assert.doesNotThrow(() => writeRequestCart(storage, emptyRequestCart()));
});

test("merges the same variant by summing quantity and clamping at the maximum", () => {
  const first = upsertRequestCartLine(emptyRequestCart(), validLine);
  assert.equal(first.status, "ok");
  const second = upsertRequestCartLine(first.state, { ...validLine, quantity: 25 });

  assert.equal(second.status, "ok");
  assert.deepEqual(second.state.lines, [{ ...validLine, quantity: 40 }]);

  const clamped = upsertRequestCartLine(second.state, { ...validLine, quantity: REQUEST_CART_MAX_QUANTITY });
  assert.deepEqual(clamped.state.lines, [{ ...validLine, quantity: REQUEST_CART_MAX_QUANTITY }]);
});

test("refuses a new line beyond the limit without mutating the cart", () => {
  let state = emptyRequestCart();
  for (let index = 0; index < REQUEST_CART_MAX_LINES; index += 1) {
    state = upsertRequestCartLine(state, { ...validLine, variantSku: `B2B-DEMO-${index}` }).state;
  }

  const overflow = upsertRequestCartLine(state, { ...validLine, variantSku: "B2B-DEMO-OVERFLOW" });

  assert.equal(overflow.status, "line_limit");
  assert.equal(overflow.state.lines.length, REQUEST_CART_MAX_LINES);
  assert.equal(overflow.state, state);
});

test("rejects an invalid line instead of writing it to the cart", () => {
  const invalid = upsertRequestCartLine(emptyRequestCart(), { ...validLine, quantity: 0 });

  assert.equal(invalid.status, "invalid");
  assert.deepEqual(invalid.state.lines, []);
});

test("removes and re-quantifies lines by variant sku only", () => {
  const state = upsertRequestCartLine(
    upsertRequestCartLine(emptyRequestCart(), validLine).state,
    { ...validLine, quantity: 30, variantSku: "B2B-DEMO-LOWSUGAR" },
  ).state;

  const requantified = setRequestCartQuantity(state, "B2B-DEMO-VANILLA", 20);
  assert.deepEqual(requantified.state.lines.map((line: CartLine) => line.quantity), [20, 30]);
  assert.equal(setRequestCartQuantity(state, "B2B-DEMO-VANILLA", 0).status, "invalid");
  assert.equal(setRequestCartQuantity(state, "MISSING", 20).status, "not_found");

  const removed = removeRequestCartLine(state, "B2B-DEMO-VANILLA");
  assert.deepEqual(removed.lines.map((line: CartLine) => line.variantSku), ["B2B-DEMO-LOWSUGAR"]);
  assert.deepEqual(removeRequestCartLine(state, "MISSING").lines.length, 2);
});

test("exposes only the minimal server key for each line", () => {
  const state = upsertRequestCartLine(emptyRequestCart(), validLine).state;

  assert.deepEqual(toRequestCartKeys(state), [{
    parentSlug: "b2b-demo-bot-dinh-duong",
    quantity: 15,
    variantSku: "B2B-DEMO-VANILLA",
  }]);
});
