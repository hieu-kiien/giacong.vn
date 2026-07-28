import assert from "node:assert/strict";
import test from "node:test";

const {
  DemoCatalogFallbackTimeoutError,
  waitForDemoCatalogFallback,
} = await import("../src/lib/demo-catalog-policy" + ".ts");

test("falls back promptly in the local demo when the catalog source does not respond", async () => {
  const unavailable = new Promise<never>(() => undefined);

  await assert.rejects(
    waitForDemoCatalogFallback(unavailable, { NODE_ENV: "development" }, 1),
    DemoCatalogFallbackTimeoutError,
  );
});

test("keeps waiting for the real catalog source in production", async () => {
  const liveResult = new Promise<string>((resolve) => setTimeout(() => resolve("live"), 5));

  assert.equal(
    await waitForDemoCatalogFallback(liveResult, { NODE_ENV: "production" }, 1),
    "live",
  );
});
