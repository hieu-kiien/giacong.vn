import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the demo cart resolver does not wait for Bagisto before pricing a demo cart", async () => {
  const source = await readFile(new URL("../src/lib/request-cart-resolver.ts", import.meta.url), "utf8");

  assert.match(
    source,
    /if \(demoAllowed\) return resolveDemoCartProduct\(slug\);/,
    "The explicit demo mode must resolve its local catalog before any Bagisto request.",
  );
});
