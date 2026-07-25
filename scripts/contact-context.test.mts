import assert from "node:assert/strict";
import test from "node:test";

const { contactContextFromSearch } = await import(
  new URL("../src/lib/contact-context.ts", import.meta.url).href,
);

test("carries product, variant and quantity from a product request into the contact form", () => {
  assert.deepEqual(
    contactContextFromSearch("?intent=order&product=bot-dinh-duong&variant_sku=BOT-VANI&quantity=10"),
    { product: "bot-dinh-duong", qty: "10", variant: "BOT-VANI" },
  );
});

test("does not send a partial product context as a generic request", () => {
  assert.deepEqual(contactContextFromSearch("?product=bot-dinh-duong&quantity=10"), {});
});
