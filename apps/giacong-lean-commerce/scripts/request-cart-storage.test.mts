import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyRequestCart,
  readRequestCart,
  removeRequestCartLine,
  REQUEST_CART_STORAGE_KEY,
  setRequestCartQuantity,
  upsertRequestCartLine,
} from "../src/lib/request-cart-storage.ts";

function storage(initial: Record<string, string> = {}) {
  const values = new Map<string, string>(Object.entries(initial));
  return {
    values,
    getItem(key: string) { return values.get(key) ?? null; },
    removeItem(key: string) { values.delete(key); },
    setItem(key: string, value: string) { values.set(key, value); },
  };
}

const line = { parentSlug: "bot-gao-lut-xay-min", quantity: 10, variantSku: "SKU-DEMO-01" };

test("empty storage returns a stable empty cart", () => {
  assert.deepEqual(readRequestCart(storage()), { state: emptyRequestCart(), status: "empty" });
});

test("repairs malformed duplicate lines and persists the sanitized state", () => {
  const store = storage({
    [REQUEST_CART_STORAGE_KEY]: JSON.stringify({
      lines: [line, line, { parentSlug: "bad slug", quantity: 1, variantSku: "SKU-2" }],
      schemaVersion: 1,
      updatedAt: "2026-08-16T00:00:00.000Z",
    }),
  });
  const result = readRequestCart(store);
  assert.equal(result.status, "repaired");
  if (result.status === "repaired") assert.equal(result.dropped, 2);
  assert.equal(result.state.lines.length, 1);
});

test("upsert, quantity update, and removal keep line identity stable", () => {
  const first = upsertRequestCartLine(emptyRequestCart(), line);
  assert.equal(first.status, "ok");
  const updated = setRequestCartQuantity(first.state, line.variantSku, 25);
  assert.equal(updated.status, "ok");
  const removed = removeRequestCartLine(updated.state, line.variantSku);
  assert.equal(removed.lines.length, 0);
});