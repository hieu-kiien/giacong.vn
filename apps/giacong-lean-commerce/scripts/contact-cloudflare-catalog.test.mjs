import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const contactRouteUrl = new URL("../src/app/api/contact/route.ts", import.meta.url);
const cartResolverUrl = new URL("../src/lib/request-cart-resolver.ts", import.meta.url);

test("contact intake resolves products from the Cloudflare-native catalog", async () => {
  const source = await readFile(contactRouteUrl, "utf8");

  assert.match(source, /getCatalogProduct\s*}\s*from\s*"@\/lib\/cloudflare-catalog"/);
  assert.doesNotMatch(source, /bagisto-catalog|bagisto-api|BAGISTO_API_URL/);
  assert.match(source, /cartBatchResolver:\s*resolveRequestCartFromCatalog/);
});

test("shared cart resolver keeps the same Cloudflare catalog boundary", async () => {
  const source = await readFile(cartResolverUrl, "utf8");

  assert.match(source, /getCatalogProduct\s*}\s*from\s*"@\/lib\/cloudflare-catalog"/);
  assert.doesNotMatch(source, /bagisto-catalog|bagisto-api|BAGISTO_API_URL/);
});
