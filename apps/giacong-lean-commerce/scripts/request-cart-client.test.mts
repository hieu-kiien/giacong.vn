import assert from "node:assert/strict";
import test from "node:test";

const {
  REQUEST_CART_DRIFT_MESSAGE,
  REQUEST_CART_INDETERMINATE_MESSAGE,
  REQUEST_CART_REVALIDATE_ENDPOINT,
  REQUEST_CART_ACCEPTED_STORAGE_KEY,
  REQUEST_CART_SOURCE,
  REQUEST_CART_SUBMIT_ENDPOINT,
  buildRevalidateBody,
  buildSubmitBody,
  createRequestId,
  driftNotice,
  hydrationNotice,
  isResolvedRequestCart,
  parseAcceptedRequest,
  parseRevalidateResponse,
  parseSubmitResponse,
  serializeAcceptedRequest,
} = await import("../src/lib/request-cart-client" + ".ts");

const line = { parentSlug: "b2b-demo-bot-dinh-duong", quantity: 15, variantSku: "B2B-DEMO-VANILLA" };

function resolvedLine(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    adjustments: [],
    contactFromQuantity: 100,
    imageUrl: "https://example.test/bot-dinh-duong.jpg",
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

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const contact = {
  address: " 12 phố Mẫu ",
  companyName: " Công ty B ",
  deliveryLocation: " Hà Nội ",
  email: " Ha@Example.com ",
  message: " 500 thung mỗi tháng ",
  name: " Trần Thị B ",
  neededBy: " Cuối tháng ",
  phone: " 0868 408 115 ",
  vatInvoice: "yes",
};

test("the submit endpoint and source identify the cart route", () => {
  assert.equal(REQUEST_CART_SUBMIT_ENDPOINT, "/api/contact");
  assert.equal(REQUEST_CART_SOURCE, "/gui-yeu-cau/");
});

test("a request id is a v4 UUID and is fresh on every call", () => {
  const first = createRequestId();
  assert.match(first, UUID_V4);
  assert.notEqual(first, createRequestId());
});

test("a request id still works without crypto.randomUUID", () => {
  const withoutRandomUuid = {
    getRandomValues: (target: Uint8Array) => {
      for (let index = 0; index < target.length; index += 1) target[index] = (index * 37 + 11) % 256;
      return target;
    },
  };
  const generated = createRequestId(withoutRandomUuid as never);
  assert.match(generated, UUID_V4, "a non-secure context must still produce a valid v4 UUID");
});

test("the submit body carries the RFQ contact contract and no client money", () => {
  const body = buildSubmitBody({
    contact,
    lines: [line],
    requestId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    snapshotToken: "a".repeat(64),
  });

  assert.deepEqual(
    Object.keys(body).sort(),
    ["address", "companyName", "deliveryLocation", "email", "lines", "message", "name", "neededBy", "phone", "requestId", "snapshotToken", "source", "vatInvoice"],
    "the JSON branch of /api/contact accepts the structured RFQ fields",
  );
  assert.equal(body.companyName, "Công ty B");
  assert.equal(body.deliveryLocation, "Hà Nội");
  assert.equal(body.vatInvoice, "yes");
  assert.equal(body.name, "Trần Thị B", "contact fields are trimmed");
  assert.equal(body.email, "Ha@Example.com");
  assert.equal(body.phone, "0868 408 115", "the server normalises phone punctuation itself");
  assert.equal(body.source, REQUEST_CART_SOURCE);
  assert.deepEqual(body.lines, [line], "submitted lines carry no price and no total");
  assert.deepEqual(Object.keys(body.lines[0]).sort(), ["parentSlug", "quantity", "variantSku"]);
});

test("an accepted submit returns the reference to show as Mã", () => {
  const parsed = parseSubmitResponse(202, { message: "Yêu cầu của bạn đã được tiếp nhận.", ok: true, receivedAt: "2026-09-15T12:30:00.000Z", reference: "YC-2607-0042" });

  assert.equal(parsed.status, "accepted");
  assert.equal(parsed.status === "accepted" ? parsed.reference : null, "YC-2607-0042");
  assert.equal(parsed.status === "accepted" ? parsed.receivedAt : null, "2026-09-15T12:30:00.000Z");
});

test("an accepted RFQ snapshot can be restored in the same browser session", () => {
  const snapshot = {
    cart: resolvedCart(),
    contact,
    receivedAt: "2026-09-15T12:30:00.000Z",
    reference: "LEAD-ABC1234567",
  };
  const restored = parseAcceptedRequest(serializeAcceptedRequest(snapshot));

  assert.equal(REQUEST_CART_ACCEPTED_STORAGE_KEY, "giacong.request-cart.accepted.v1");
  assert.deepEqual(restored, snapshot);
});

test("an invalid or tampered accepted snapshot is never rendered", () => {
  const snapshot = {
    cart: resolvedCart(),
    contact,
    receivedAt: "2026-09-15T12:30:00.000Z",
    reference: "LEAD-ABC1234567",
  };
  for (const value of [
    "not-json",
    JSON.stringify({ ...snapshot, contact: { ...contact, email: 7 } }),
    JSON.stringify({ ...snapshot, cart: { ...snapshot.cart, currency: "USD" } }),
    JSON.stringify({ ...snapshot, reference: "<script>" }),
  ]) {
    assert.equal(parseAcceptedRequest(value), null, value);
  }
});

test("an accepted submit without a usable reference is not treated as success", () => {
  for (const body of [{ ok: true }, { ok: true, reference: "" }, { ok: true, reference: 7 }, null]) {
    assert.notEqual(parseSubmitResponse(202, body).status, "accepted", JSON.stringify(body));
  }
});

test("field errors are returned per field so inputs keep their values", () => {
  const parsed = parseSubmitResponse(400, {
    errors: { name: "Vui lòng nhập họ và tên.", phone: "Số điện thoại không hợp lệ." },
    message: "Vui lòng kiểm tra lại thông tin liên hệ.",
    ok: false,
  });

  assert.equal(parsed.status, "invalid");
  assert.deepEqual(
    parsed.status === "invalid" ? parsed.errors : null,
    { name: "Vui lòng nhập họ và tên.", phone: "Số điện thoại không hợp lệ." },
  );
  assert.equal(parsed.status === "invalid" ? parsed.message : null, "Vui lòng kiểm tra lại thông tin liên hệ.");
});

test("a 400 with unusable errors still reports a message without inventing fields", () => {
  const parsed = parseSubmitResponse(400, { errors: { name: 5, nope: "x" }, message: "Dữ liệu gửi lên không hợp lệ.", ok: false });

  assert.equal(parsed.status, "invalid");
  assert.deepEqual(parsed.status === "invalid" ? parsed.errors : null, {});
});

test("a 409 returns the fresh cart so the customer reviews the real state", () => {
  const cart = resolvedCart({ snapshotToken: "f".repeat(64) });
  for (const code of ["CART_DRIFTED", "CART_NOT_SUBMITTABLE"]) {
    const parsed = parseSubmitResponse(409, { cart, code, message: "Giá hoặc tình trạng hàng đã thay đổi. Vui lòng xem lại giỏ yêu cầu.", ok: false });
    assert.equal(parsed.status, "conflict", code);
    assert.equal(parsed.status === "conflict" ? parsed.code : null, code);
    assert.equal(parsed.status === "conflict" ? parsed.cart?.snapshotToken : null, "f".repeat(64));
  }
});

test("a 409 whose cart fails the contract still blocks the submit", () => {
  const parsed = parseSubmitResponse(409, { cart: { currency: "USD" }, code: "CART_DRIFTED", message: "Giá đã thay đổi.", ok: false });

  assert.equal(parsed.status, "conflict");
  assert.equal(parsed.status === "conflict" ? parsed.cart : "not-null", null, "an untrusted cart is dropped, not rendered");
});

test("502 and 504 are indeterminate: the request may already be recorded", () => {
  for (const status of [502, 504]) {
    const parsed = parseSubmitResponse(status, { message: "Dịch vụ tiếp nhận yêu cầu phản hồi quá chậm.", ok: false });
    assert.equal(parsed.status, "indeterminate", String(status));
    assert.match(
      parsed.status === "indeterminate" ? parsed.message : "",
      /không rõ|chưa rõ|có thể đã/i,
      "an indeterminate outcome must not be reported as a plain failure",
    );
  }
  assert.match(REQUEST_CART_INDETERMINATE_MESSAGE, /Mã|liên hệ/i, "the indeterminate copy must tell the customer what to do next");
});

test("503 and other statuses are plain failures", () => {
  const parsed = parseSubmitResponse(503, { message: "Dịch vụ tiếp nhận yêu cầu chưa được cấu hình.", ok: false });
  assert.equal(parsed.status, "failed");
  assert.equal(parsed.status === "failed" ? parsed.message : null, "Dịch vụ tiếp nhận yêu cầu chưa được cấu hình.");
});

type Channel = { contact: string; copyFirst: boolean; demo: true; href: string; id: string; label: string };

const channelModule = await import("../src/lib/request-cart-channels" + ".ts");
const REQUEST_CART_CHANNELS = channelModule.REQUEST_CART_CHANNELS as readonly Channel[];
const buildHandoffMessage = channelModule.buildHandoffMessage as (reference: string, cart: never) => string;
const getRequestCartChannels = channelModule.getRequestCartChannels as (settings?: { contactEmail?: string }) => readonly Channel[];

test("the demo contact channels are exactly the locked values", () => {
  assert.deepEqual(
    REQUEST_CART_CHANNELS.map((channel) => channel.id),
    ["zalo", "messenger", "email", "hotline"],
  );

  const byId = new Map<string, Channel>(REQUEST_CART_CHANNELS.map((channel) => [channel.id, channel]));
  assert.equal(byId.get("zalo")?.href, "https://zalo.me/06408115");
  assert.equal(byId.get("zalo")?.contact, "06408115");
  assert.equal(byId.get("messenger")?.href, "https://m.me/qtudepdai");
  assert.equal(byId.get("email")?.href, "mailto:contact@kienhieu.id.vn");
  assert.equal(byId.get("hotline")?.href, "tel:0868408115");
  assert.equal(byId.get("hotline")?.contact, "0868408115");
});

test("request handoff uses the published contact email after a brand switch", () => {
  const channels = getRequestCartChannels({ contactEmail: "sales@kienhieu.id.vn" });
  const email = channels.find((channel) => channel.id === "email");

  assert.equal(email?.contact, "sales@kienhieu.id.vn");
  assert.equal(email?.href, "mailto:sales@kienhieu.id.vn");
  assert.doesNotMatch(email?.href ?? "", /giacong\.vn/i);
});

test("only the chat channels need prepared content copied first", () => {
  const copyFirst = REQUEST_CART_CHANNELS.filter((channel) => channel.copyFirst).map((channel) => channel.id);
  assert.deepEqual(copyFirst, ["zalo", "messenger"], "mailto and tel carry the reference themselves");
});

test("every channel is marked as demo data pending owner confirmation", () => {
  for (const channel of REQUEST_CART_CHANNELS) {
    assert.equal(channel.demo, true, `${channel.id} must be flagged as demo`);
  }
});

test("prepared handoff content carries the reference and the lines but no PII", () => {
  const cart = resolvedCart({
    hasPriceOnRequest: true,
    lineCount: 2,
    lines: [
      resolvedLine(),
      resolvedLine({
        adjustments: [{ code: "PRICE_ON_REQUEST", message: "Từ 100 thùng, giá được báo riêng theo số lượng." }],
        lineTotal: null,
        parentSlug: "b2b-demo-ngu-coc",
        priceOnRequest: true,
        productName: "Ngũ cốc dinh dưỡng",
        quantity: 120,
        unitPrice: null,
        variantLabel: "Hạt",
        variantSku: "B2B-DEMO-OAT",
      }),
    ],
    requestType: "Tư vấn số lượng lớn",
  }) as unknown as never;

  const message = buildHandoffMessage("YC-2607-0042", cart);

  assert.match(message, /YC-2607-0042/, "the reference is the whole point of the handoff");
  assert.match(message, /Bột dinh dưỡng/);
  assert.match(message, /Vani/);
  assert.match(message, /15 thùng/);
  assert.match(message, /Ngũ cốc dinh dưỡng/);
  assert.match(message, /120 thùng/);
  assert.match(message, /[Ll]iên hệ báo giá/, "a price-on-request line must say so instead of showing a total");
  for (const pii of [/Trần/, /0868/, /@example\.com/, /ha@/i]) {
    assert.doesNotMatch(message, pii, `prepared content must not carry ${pii}`);
  }
});

test("prepared handoff content stays inside a chat-safe length", () => {
  const manyLines = Array.from({ length: 20 }, (_unused, index) => resolvedLine({
    parentSlug: "b2b-demo-bot-dinh-duong",
    variantSku: `B2B-DEMO-SKU-${index}`,
  }));
  const message = buildHandoffMessage("YC-2607-0042", resolvedCart({ lineCount: 20, lines: manyLines }) as unknown as never);

  assert.ok(message.length <= 1_800, `prepared content must stay short enough to paste (received ${message.length})`);
  assert.match(message, /YC-2607-0042/, "truncation must never drop the reference");
});
