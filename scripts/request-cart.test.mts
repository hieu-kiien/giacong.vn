import assert from "node:assert/strict";
import test from "node:test";

const {
  REQUEST_CART_MAX_BODY_BYTES,
  handleCartRevalidation,
} = await import("../src/lib/request-cart" + ".ts");
const {
  demoCartFallbackAllowed,
  resolveDemoCartProduct,
} = await import("../src/lib/request-cart-demo" + ".ts");

interface CartVariantFixture {
  contactFromQuantity: number;
  isAvailable: boolean;
  label: string;
  minimumOrderQuantity: number;
  quantityStep: number;
  sku: string;
  tierPrices: Array<{ minQuantity: number; price: number }>;
  unit: string;
}

const vanilla: CartVariantFixture = {
  contactFromQuantity: 30,
  isAvailable: true,
  label: "Vị vani",
  minimumOrderQuantity: 10,
  quantityStep: 5,
  sku: "B2B-DEMO-VANILLA",
  tierPrices: [
    { minQuantity: 10, price: 90_000 },
    { minQuantity: 25, price: 84_000 },
  ],
  unit: "gói",
};

const lowSugar: CartVariantFixture = {
  ...vanilla,
  label: "Vị ít ngọt",
  sku: "B2B-DEMO-LOWSUGAR",
  tierPrices: [{ minQuantity: 10, price: 95_000 }],
};

test("the demo cart resolver is available outside production and refuses production", () => {
  assert.equal(demoCartFallbackAllowed("development"), true);
  assert.equal(demoCartFallbackAllowed("test"), true);
  assert.equal(demoCartFallbackAllowed("production"), false);
});

test("the demo cart resolver projects the same canonical product and price fields", () => {
  const product = resolveDemoCartProduct("la-tia-to-say-lanh");

  assert.ok(product);
  assert.equal(product.slug, "la-tia-to-say-lanh");
  assert.equal(product.variants.length, 1);
  assert.equal(product.variants[0]?.sku, "B2B-DEMO-LTT-03");
  assert.equal(product.variants[0]?.tierPrices[0]?.price, 742_000);
  assert.equal(resolveDemoCartProduct("khong-ton-tai"), null);
});

interface CartProductFixture {
  name: string;
  slug: string;
  variants: CartVariantFixture[];
}

type CartResolverFixture = (slug: string) => Promise<CartProductFixture | null>;

function catalog(variants: CartVariantFixture[] = [vanilla, lowSugar]): CartProductFixture {
  return { name: "Bột dinh dưỡng", slug: "b2b-demo-bot-dinh-duong", variants };
}

function cartRequest(body: unknown, contentType = "application/json"): Request {
  return new Request("http://localhost/api/gui-yeu-cau/xac-thuc", {
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": contentType },
    method: "POST",
  });
}

function line(variantSku: string, quantity: number, parentSlug = "b2b-demo-bot-dinh-duong") {
  return { parentSlug, quantity, variantSku };
}

const defaultResolver: CartResolverFixture = async () => catalog();

async function revalidate(body: unknown, resolver: CartResolverFixture = defaultResolver) {
  const response = await handleCartRevalidation(cartRequest(body), { cartResolver: resolver });
  return { body: await response.json(), response };
}

test("prices each line from its own tier and totals only the priced lines", async () => {
  const { body, response } = await revalidate({
    lines: [line("B2B-DEMO-VANILLA", 25), line("B2B-DEMO-LOWSUGAR", 10)],
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(body.ok, true);
  assert.equal(body.cart.currency, "VND");
  assert.deepEqual(body.cart.lines.map((item: { unitPrice: number }) => item.unitPrice), [84_000, 95_000]);
  assert.deepEqual(body.cart.lines.map((item: { lineTotal: number }) => item.lineTotal), [2_100_000, 950_000]);
  assert.equal(body.cart.pricedSubtotal, 3_050_000);
  assert.equal(body.cart.hasPriceOnRequest, false);
  assert.equal(body.cart.isSubmittable, true);
  assert.equal(body.cart.requestType, "Đặt sản phẩm");
  assert.equal(body.cart.totalQuantity, 35);
  assert.equal(body.cart.uniformUnit, "gói");
  assert.deepEqual(body.cart.lines[0].adjustments, []);
});

test("selects the tier at its lower boundary rather than the next one", async () => {
  const below = await revalidate({ lines: [line("B2B-DEMO-VANILLA", 20)] });
  const at = await revalidate({ lines: [line("B2B-DEMO-VANILLA", 25)] });

  assert.equal(below.body.cart.lines[0].unitPrice, 90_000);
  assert.equal(below.body.cart.lines[0].lineTotal, 1_800_000);
  assert.equal(at.body.cart.lines[0].unitPrice, 84_000);
});

test("marks a line at the contact threshold as price on request without a unit price", async () => {
  const { body } = await revalidate({
    lines: [line("B2B-DEMO-VANILLA", 30), line("B2B-DEMO-LOWSUGAR", 10)],
  });

  const [threshold, priced] = body.cart.lines;
  assert.equal(threshold.priceOnRequest, true);
  assert.equal(threshold.unitPrice, null);
  assert.equal(threshold.lineTotal, null);
  assert.equal(threshold.isSubmittable, true);
  assert.deepEqual(threshold.adjustments.map((item: { code: string }) => item.code), ["PRICE_ON_REQUEST"]);
  assert.equal(priced.priceOnRequest, false);
  assert.equal(body.cart.hasPriceOnRequest, true);
  assert.equal(body.cart.pricedSubtotal, 950_000);
  assert.equal(body.cart.requestType, "Tư vấn số lượng lớn");
  assert.equal(body.cart.isSubmittable, true);
});

test("blocks submission for MOQ and step violations and suggests a valid quantity", async () => {
  const { body } = await revalidate({
    lines: [line("B2B-DEMO-VANILLA", 5), line("B2B-DEMO-LOWSUGAR", 12)],
  });

  const [belowMoq, offStep] = body.cart.lines;
  assert.deepEqual(belowMoq.adjustments.map((item: { code: string }) => item.code), ["QUANTITY_BELOW_MOQ"]);
  assert.equal(belowMoq.adjustments[0].suggestedQuantity, 10);
  assert.equal(belowMoq.isSubmittable, false);
  assert.equal(belowMoq.unitPrice, null);
  assert.equal(belowMoq.lineTotal, null);
  assert.deepEqual(offStep.adjustments.map((item: { code: string }) => item.code), ["QUANTITY_OFF_STEP"]);
  assert.equal(offStep.adjustments[0].suggestedQuantity, 15);
  assert.equal(offStep.isSubmittable, false);
  assert.equal(body.cart.isSubmittable, false);
  assert.equal(body.cart.pricedSubtotal, 0);
});

test("reports availability as the boolean the catalog contract actually carries", async () => {
  const { body } = await revalidate({ lines: [line("B2B-DEMO-VANILLA", 10)] }, async () => catalog([
    { ...vanilla, isAvailable: false },
    lowSugar,
  ]));

  const [unavailable] = body.cart.lines;
  assert.equal(unavailable.isAvailable, false);
  assert.equal(unavailable.isSubmittable, false);
  assert.deepEqual(unavailable.adjustments.map((item: { code: string }) => item.code), ["VARIANT_UNAVAILABLE"]);
  assert.equal("availableQuantity" in unavailable, false);
  assert.equal(JSON.stringify(body).includes("INSUFFICIENT_STOCK"), false);
});

test("flags a missing product or variant per line without discarding the rest of the cart", async () => {
  const { body } = await revalidate({
    lines: [
      line("B2B-DEMO-VANILLA", 10),
      line("B2B-DEMO-GONE", 10),
      line("B2B-DEMO-VANILLA", 10, "b2b-demo-khong-ton-tai"),
    ],
  }, async (slug: string) => (slug === "b2b-demo-bot-dinh-duong" ? catalog() : null));

  assert.equal(body.cart.lines.length, 3);
  assert.deepEqual(body.cart.lines[1].adjustments.map((item: { code: string }) => item.code), ["VARIANT_NOT_FOUND"]);
  assert.deepEqual(body.cart.lines[2].adjustments.map((item: { code: string }) => item.code), ["PRODUCT_NOT_FOUND"]);
  assert.equal(body.cart.lines[0].isSubmittable, true);
  assert.equal(body.cart.isSubmittable, false);
  assert.equal(body.cart.lines[1].productName, "Bột dinh dưỡng");
  assert.equal(body.cart.lines[1].variantLabel, "");
  assert.equal(body.cart.lines[2].productName, "");
  assert.equal(body.cart.lines[2].unitPrice, null);
});

test("reports no uniform unit or total quantity when the cart mixes units", async () => {
  const { body } = await revalidate({
    lines: [line("B2B-DEMO-VANILLA", 10), line("B2B-DEMO-LOWSUGAR", 10)],
  }, async () => catalog([vanilla, { ...lowSugar, unit: "thùng" }]));

  assert.equal(body.cart.totalQuantity, null);
  assert.equal(body.cart.uniformUnit, null);
  assert.equal(body.cart.isSubmittable, true);
});

test("resolves each distinct parent slug exactly once for a multi-line cart", async () => {
  const slugs: string[] = [];
  await revalidate({
    lines: [
      line("B2B-DEMO-VANILLA", 10),
      line("B2B-DEMO-LOWSUGAR", 10),
      line("B2B-DEMO-VANILLA", 10, "b2b-demo-khac"),
    ],
  }, async (slug: string) => {
    slugs.push(slug);
    return catalog();
  });

  assert.deepEqual(slugs, ["b2b-demo-bot-dinh-duong", "b2b-demo-khac"]);
});

test("rejects an empty, oversized, duplicated, or malformed line list", async () => {
  const invalidBodies: unknown[] = [
    { lines: [] },
    { lines: Array.from({ length: 21 }, (_, index) => line(`B2B-DEMO-${index}`, 10)) },
    { lines: [line("B2B-DEMO-VANILLA", 10), line("B2B-DEMO-VANILLA", 15)] },
    { lines: "not-an-array" },
    {},
    { lines: [{ parentSlug: "b2b-demo-bot-dinh-duong", quantity: 10 }] },
    { lines: [line("B2B-DEMO-VANILLA", 1.5)] },
    { lines: [line("B2B-DEMO-VANILLA", 0)] },
    { lines: [line("B2B-DEMO-VANILLA", 9_007_199_254_740_990)] },
    { lines: [line("B2B-DEMO-VANILLA", 10, "Bad Slug")] },
    { lines: [line("=cmd", 10)] },
    { lines: [line("B2B-DEMO-VANILLA", 10)], extra: "field" },
  ];

  for (const body of invalidBodies) {
    let called = false;
    const response = await handleCartRevalidation(cartRequest(body), {
      cartResolver: async () => {
        called = true;
        return catalog();
      },
    });
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal(called, false, JSON.stringify(body));
    assert.equal((await response.json()).ok, false, JSON.stringify(body));
  }
});

test("rejects a non-JSON content type and unparseable JSON before resolving the catalog", async () => {
  for (const request of [
    cartRequest({ lines: [line("B2B-DEMO-VANILLA", 10)] }, "text/plain"),
    cartRequest("{not json"),
  ]) {
    let called = false;
    const response = await handleCartRevalidation(request, {
      cartResolver: async () => {
        called = true;
        return catalog();
      },
    });
    assert.equal(response.status, 400);
    assert.equal(called, false);
  }
});

test("rejects a body above the byte cap without parsing it", async () => {
  const padded = `{"lines":[{"parentSlug":"${"a".repeat(REQUEST_CART_MAX_BODY_BYTES)}","variantSku":"X","quantity":1}]}`;
  let called = false;
  const response = await handleCartRevalidation(cartRequest(padded), {
    cartResolver: async () => {
      called = true;
      return catalog();
    },
  });

  assert.equal(response.status, 413);
  assert.equal(called, false);
});

test("fails closed with 502 when the catalog cannot be read", async () => {
  const response = await handleCartRevalidation(cartRequest({ lines: [line("B2B-DEMO-VANILLA", 10)] }), {
    cartResolver: async () => {
      throw new Error("catalog unavailable");
    },
  });

  assert.equal(response.status, 502);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.equal("cart" in body, false);
  assert.equal(JSON.stringify(body).includes("catalog unavailable"), false);
});

test("derives a deterministic snapshot token that changes when priced state changes", async () => {
  const lines = [line("B2B-DEMO-VANILLA", 25), line("B2B-DEMO-LOWSUGAR", 10)];
  const first = await revalidate({ lines });
  const repeat = await revalidate({ lines });
  const reordered = await revalidate({ lines: [...lines].reverse() });
  const repriced = await revalidate({ lines }, async () => catalog([
    { ...vanilla, tierPrices: [{ minQuantity: 10, price: 90_000 }, { minQuantity: 25, price: 80_000 }] },
    lowSugar,
  ]));
  const requantified = await revalidate({ lines: [line("B2B-DEMO-VANILLA", 25), line("B2B-DEMO-LOWSUGAR", 15)] });

  assert.match(first.body.cart.snapshotToken, /^[0-9a-f]{64}$/);
  assert.equal(first.body.cart.snapshotToken, repeat.body.cart.snapshotToken);
  assert.equal(first.body.cart.snapshotToken, reordered.body.cart.snapshotToken);
  assert.notEqual(first.body.cart.snapshotToken, repriced.body.cart.snapshotToken);
  assert.notEqual(first.body.cart.snapshotToken, requantified.body.cart.snapshotToken);
});

test("never echoes a client-supplied price, total, or contact field", async () => {
  const response = await handleCartRevalidation(cartRequest({
    lines: [{ ...line("B2B-DEMO-VANILLA", 25), lineTotal: 1, unitPrice: 1 }],
    name: "Nguyễn Văn A",
    pricedSubtotal: 1,
  }), { cartResolver: defaultResolver });
  const body = await response.json();

  assert.equal(body.ok, false);
  assert.equal(JSON.stringify(body).includes("Nguyễn Văn A"), false);
});
