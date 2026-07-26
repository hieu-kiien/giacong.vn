import assert from "node:assert/strict";
import test from "node:test";

const {
  REQUEST_CART_DRIFT_MESSAGE,
  REQUEST_CART_REVALIDATE_ENDPOINT,
  buildRevalidateBody,
  driftNotice,
  hydrationNotice,
  isResolvedRequestCart,
  parseRevalidateResponse,
} = await import("../src/lib/request-cart-client" + ".ts");

const line = { parentSlug: "b2b-demo-bot-dinh-duong", quantity: 15, variantSku: "B2B-DEMO-VANILLA" };

function resolvedLine(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    adjustments: [],
    contactFromQuantity: 100,
    isAvailable: true,
    isSubmittable: true,
    lineTotal: 10_800_000,
    minimumOrderQuantity: 10,
    parentSlug: line.parentSlug,
    priceOnRequest: false,
    productName: "Bột dinh dưỡng",
    quantity: 15,
    quantityStep: 5,
    unit: "thùng",
    unitPrice: 720_000,
    variantLabel: "Vani",
    variantSku: line.variantSku,
    ...overrides,
  };
}

function resolvedCart(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    currency: "VND",
    hasPriceOnRequest: false,
    isSubmittable: true,
    lineCount: 1,
    lines: [resolvedLine()],
    pricedSubtotal: 10_800_000,
    requestType: "Đặt sản phẩm",
    snapshotToken: "a".repeat(64),
    totalQuantity: 15,
    uniformUnit: "thùng",
    ...overrides,
  };
}

test("the revalidate endpoint is the only cart route the client calls", () => {
  assert.equal(REQUEST_CART_REVALIDATE_ENDPOINT, "/api/gui-yeu-cau/xac-thuc");
});

test("the revalidate body carries only the three minimal line keys", () => {
  const body = buildRevalidateBody([{ ...line, unitPrice: 1, lineTotal: 2 } as never]);

  assert.deepEqual(Object.keys(body), ["lines"]);
  assert.deepEqual(Object.keys(body.lines[0]).sort(), ["parentSlug", "quantity", "variantSku"]);
  assert.deepEqual(body.lines, [line]);
});

test("a well formed cart response is accepted", () => {
  const parsed = parseRevalidateResponse(200, { cart: resolvedCart(), ok: true });

  assert.equal(parsed.status, "ok");
  assert.equal(parsed.status === "ok" ? parsed.cart.pricedSubtotal : null, 10_800_000);
});

test("a server error message is surfaced instead of a cart", () => {
  const parsed = parseRevalidateResponse(502, { message: "Không thể xác thực giỏ yêu cầu. Vui lòng thử lại.", ok: false });

  assert.equal(parsed.status, "error");
  assert.equal(
    parsed.status === "error" ? parsed.message : null,
    "Không thể xác thực giỏ yêu cầu. Vui lòng thử lại.",
  );
});

test("an unusable error body still produces a retryable message", () => {
  for (const body of [null, "<html>", { ok: false }, { message: 42, ok: false }]) {
    const parsed = parseRevalidateResponse(500, body);
    assert.equal(parsed.status, "error", JSON.stringify(body));
    assert.equal(
      parsed.status === "error" ? parsed.message : null,
      "Không thể xác thực giỏ yêu cầu. Vui lòng thử lại.",
      JSON.stringify(body),
    );
  }
});

test("a 200 response whose cart fails the contract is treated as an error", () => {
  for (const cart of [
    resolvedCart({ currency: "USD" }),
    resolvedCart({ pricedSubtotal: "10800000" }),
    resolvedCart({ snapshotToken: "short" }),
    resolvedCart({ lines: [] }),
    resolvedCart({ lines: [resolvedLine({ unitPrice: "720000" })] }),
    resolvedCart({ requestType: "Đặt hàng" }),
  ]) {
    const parsed = parseRevalidateResponse(200, { cart, ok: true });
    assert.equal(parsed.status, "error", JSON.stringify(cart).slice(0, 120));
  }
});

test("a resolved cart is only trusted when every money field is a real number or null", () => {
  assert.equal(isResolvedRequestCart(resolvedCart()), true);
  assert.equal(isResolvedRequestCart(resolvedCart({ lines: [resolvedLine({ lineTotal: null, unitPrice: null, priceOnRequest: true })] })), true);
  assert.equal(isResolvedRequestCart(resolvedCart({ pricedSubtotal: Number.NaN })), false);
  assert.equal(isResolvedRequestCart(resolvedCart({ lines: [resolvedLine({ lineTotal: Number.POSITIVE_INFINITY })] })), false);
  assert.equal(isResolvedRequestCart(resolvedCart({ lines: [{ ...resolvedLine(), extra: true }] })), false);
  assert.equal(isResolvedRequestCart(resolvedCart({ lines: [resolvedLine({ adjustments: [{ code: "NOPE", message: "x" }] })] })), false);
  assert.equal(isResolvedRequestCart(null), false);
});

test("a silent server side price or stock change is reported as drift", () => {
  const before = resolvedCart() as unknown as never;

  assert.equal(driftNotice(null, before), null, "the first resolved cart cannot have drifted");
  assert.equal(driftNotice(before, before), null, "an unchanged cart must stay quiet");

  const repriced = resolvedCart({
    lines: [resolvedLine({ lineTotal: 11_250_000, unitPrice: 750_000 })],
    pricedSubtotal: 11_250_000,
    snapshotToken: "b".repeat(64),
  }) as unknown as never;
  assert.equal(driftNotice(before, repriced), REQUEST_CART_DRIFT_MESSAGE);

  const soldOut = resolvedCart({
    lines: [resolvedLine({ isAvailable: false, isSubmittable: false, lineTotal: null, unitPrice: null })],
    isSubmittable: false,
    pricedSubtotal: 0,
    snapshotToken: "c".repeat(64),
  }) as unknown as never;
  assert.equal(driftNotice(before, soldOut), REQUEST_CART_DRIFT_MESSAGE);
});

test("a customer edit is not reported as server side drift", () => {
  const before = resolvedCart() as unknown as never;
  const editedQuantity = resolvedCart({
    lines: [resolvedLine({ lineTotal: 14_400_000, quantity: 20 })],
    pricedSubtotal: 14_400_000,
    snapshotToken: "d".repeat(64),
    totalQuantity: 20,
  }) as unknown as never;
  assert.equal(driftNotice(before, editedQuantity), null, "a quantity the customer chose is not drift");

  const removedLine = resolvedCart({
    lines: [resolvedLine({ parentSlug: "b2b-demo-ngu-coc", variantSku: "B2B-DEMO-OAT" })],
    snapshotToken: "e".repeat(64),
  }) as unknown as never;
  assert.equal(driftNotice(before, removedLine), null, "a line the customer removed is not drift");
});

test("a repaired or reset local cart explains itself to the customer", () => {
  assert.equal(hydrationNotice({ status: "ok" }), null);
  assert.equal(hydrationNotice({ status: "empty" }), null);
  assert.equal(
    hydrationNotice({ dropped: 2, status: "repaired" }),
    "Đã bỏ 2 dòng không còn hợp lệ khỏi giỏ yêu cầu.",
  );
  assert.equal(
    hydrationNotice({ dropped: 1, status: "repaired" }),
    "Đã bỏ 1 dòng không còn hợp lệ khỏi giỏ yêu cầu.",
  );
  for (const reason of ["oversize", "unparseable", "version"] as const) {
    assert.equal(
      hydrationNotice({ reason, status: "reset" }),
      "Giỏ yêu cầu đã được làm mới vì dữ liệu lưu trên máy không còn dùng được.",
      reason,
    );
  }
});
