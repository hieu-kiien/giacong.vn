import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const {
  DemoCatalogFallbackTimeoutError,
  demoCatalogForced,
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

test("can explicitly force the complete demo catalog only outside production", () => {
  assert.equal(demoCatalogForced({ NODE_ENV: "development", CATALOG_DEMO_FALLBACK: "force" }), true);
  assert.equal(demoCatalogForced({ NODE_ENV: "development", CATALOG_DEMO_FALLBACK: "1" }), false);
  assert.equal(demoCatalogForced({ NODE_ENV: "production", CATALOG_DEMO_FALLBACK: "force" }), false);
});

test("the live Bagisto catalog is not retained across storefront requests", async () => {
  const source = await readFile(path.join(import.meta.dirname, "..", "src", "lib", "bagisto-catalog.ts"), "utf8");

  assert.doesNotMatch(source, /unstable_cache/, "an Admin save must be visible on the next page load");
});
