import assert from "node:assert/strict";
import test from "node:test";

const { handleContactSubmission } = await import("../src/lib/contact-webhook" + ".ts");
const { CONTACT_MAX_BODY_BYTES, resolveRequestCart } = await import("../src/lib/request-cart" + ".ts");

const validSubmission = {
  email: "  customer@example.test  ",
  message: "  Cần tư vấn số lượng lớn.  ",
  name: "  Nguyễn Văn A  ",
  phone: " 0900 000 000 ",
  source: " /lien-he/ ",
};

function requestWithForm(fields: Record<string, string> = validSubmission): Request {
  const form = new FormData();
  Object.entries(fields).forEach(([name, value]) => form.set(name, value));
  return new Request("http://localhost/api/contact", { method: "POST", body: form });
}

function environment(overrides: Record<string, string | undefined> = {}) {
  return {
    GOOGLE_SHEETS_WEBHOOK_SECRET: "shared-secret",
    GOOGLE_SHEETS_WEBHOOK_URL: "https://script.google.com/macros/s/example/exec",
    ...overrides,
  };
}

const catalogProduct = {
  name: "Bột dinh dưỡng",
  variants: [{
    contactFromQuantity: 20,
    isAvailable: true,
    label: "Vị vani",
    minimumOrderQuantity: 10,
    quantityStep: 5,
    sku: "B2B-DEMO-VANILLA",
  }],
};

function productFields(overrides: Record<string, string> = {}) {
  return {
    ...validSubmission,
    product: "bot-dinh-duong",
    qty: "10",
    variant: "B2B-DEMO-VANILLA",
    ...overrides,
  };
}

test("forwards normalized contact fields and optional secret to an approved Apps Script webhook", async () => {
  let receivedUrl = "";
  let receivedInit: RequestInit | undefined;
  const response = await handleContactSubmission(requestWithForm(), {
    environment: environment(),
    fetch: async (url: string | URL | Request, init?: RequestInit) => {
      receivedUrl = String(url);
      receivedInit = init;
      return new Response(JSON.stringify({ ok: true, reference: "YC-20260725-001" }), {
        headers: { "Content-Type": "application/json" },
      });
    },
    timeoutMs: 100,
  });

  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), {
    message: "Yêu cầu của bạn đã được tiếp nhận.",
    ok: true,
    reference: "YC-20260725-001",
  });
  assert.equal(receivedUrl, "https://script.google.com/macros/s/example/exec");
  assert.equal(receivedInit?.method, "POST");
  assert.equal(new Headers(receivedInit?.headers).get("content-type"), "application/json");
  assert.deepEqual(JSON.parse(String(receivedInit?.body)), {
    email: "customer@example.test",
    message: "Cần tư vấn số lượng lớn.",
    name: "Nguyễn Văn A",
    phone: "0900 000 000",
    product: "",
    qty: "",
    request_type: "Tư vấn dịch vụ",
    secret: "shared-secret",
    service: "",
    source: "/lien-he/",
    variant: "",
  });
});

test("returns 429 with Retry-After when the contact rate limiter rejects the client", async () => {
  let webhookCalled = false;
  let limitedKey = "";
  const response = await handleContactSubmission(
    new Request("http://localhost/api/contact", {
      body: (() => {
        const form = new FormData();
        Object.entries(validSubmission).forEach(([name, value]) => form.set(name, value));
        return form;
      })(),
      headers: { "CF-Connecting-IP": "203.0.113.7" },
      method: "POST",
    }),
    {
      contactRateLimiter: {
        limit: async (options: { key: string }) => {
          limitedKey = options.key;
          return { success: false };
        },
      },
      environment: environment(),
      fetch: async () => {
        webhookCalled = true;
        return new Response(JSON.stringify({ ok: true, reference: "YC-X" }), {
          headers: { "Content-Type": "application/json" },
        });
      },
      timeoutMs: 100,
    },
  );

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "60");
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.equal(webhookCalled, false, "a rate-limited submit must never reach the webhook or D1");
  assert.equal(limitedKey, "203.0.113.7", "the client key is the connecting IP");
});

test("fails open when the rate limiter itself errors", async () => {
  let webhookCalled = false;
  const response = await handleContactSubmission(requestWithForm(), {
    contactRateLimiter: {
      limit: async () => {
        throw new Error("limiter unavailable");
      },
    },
    environment: environment(),
    fetch: async () => {
      webhookCalled = true;
      return new Response(JSON.stringify({ ok: true, reference: "YC-Y" }), {
        headers: { "Content-Type": "application/json" },
      });
    },
    timeoutMs: 100,
  });

  assert.equal(response.status, 202);
  assert.equal(webhookCalled, true, "abuse protection must never take intake down with it");
});

test("does not include secret when it is not configured", async () => {  let receivedBody = "";
  const response = await handleContactSubmission(requestWithForm(), {
    environment: environment({ GOOGLE_SHEETS_WEBHOOK_SECRET: undefined }),
    fetch: async (_url: string | URL | Request, init?: RequestInit) => {
      receivedBody = String(init?.body);
      return new Response(JSON.stringify({ ok: true, reference: "YC-2" }), {
        headers: { "Content-Type": "application/json" },
      });
    },
    timeoutMs: 100,
  });

  assert.equal(response.status, 202);
  assert.equal("secret" in JSON.parse(receivedBody), false);
});

test("derives canonical product requests at MOQ and the inclusive contact threshold", async () => {
  const cases = [
    { qty: "10", requestType: "Đặt sản phẩm" },
    { qty: "20", requestType: "Tư vấn số lượng lớn" },
  ] as const;

  for (const sample of cases) {
    let receivedBody = "";
    const response = await handleContactSubmission(requestWithForm(productFields({
      qty: sample.qty,
      request_type: "Đặt sản phẩm",
    })), {
      environment: environment(),
      fetch: async (_url: string | URL | Request, init?: RequestInit) => {
        receivedBody = String(init?.body);
        return new Response(JSON.stringify({ ok: true, reference: "YC-PRODUCT" }), {
          headers: { "Content-Type": "application/json" },
        });
      },
      productResolver: async (slug: string) => {
        assert.equal(slug, "bot-dinh-duong");
        return catalogProduct;
      },
      timeoutMs: 100,
    });

    assert.equal(response.status, 202, sample.qty);
    assert.deepEqual(JSON.parse(receivedBody), {
      email: "customer@example.test",
      message: "Cần tư vấn số lượng lớn.",
      name: "Nguyễn Văn A",
      phone: "0900 000 000",
      product: "Bột dinh dưỡng",
      qty: Number(sample.qty),
      request_type: sample.requestType,
      secret: "shared-secret",
      service: "",
      source: "/lien-he/",
      variant: "Vị vani",
    }, sample.qty);
  }
});

test("accepts the single canonical service and preserves legacy generic contact without context", async () => {
  const bodies: string[] = [];
  const fetch = async (_url: string | URL | Request, init?: RequestInit) => {
    bodies.push(String(init?.body));
    return new Response(JSON.stringify({ ok: true, reference: `YC-${bodies.length}` }), {
      headers: { "Content-Type": "application/json" },
    });
  };

  const serviceResponse = await handleContactSubmission(requestWithForm({
    ...validSubmission,
    service: "say-thuc-pham-say",
  }), { environment: environment(), fetch, timeoutMs: 100 });
  const genericResponse = await handleContactSubmission(requestWithForm(), {
    environment: environment(),
    fetch,
    timeoutMs: 100,
  });

  assert.equal(serviceResponse.status, 202);
  assert.equal(genericResponse.status, 202);
  assert.deepEqual(JSON.parse(bodies[0]), {
    email: "customer@example.test",
    message: "Cần tư vấn số lượng lớn.",
    name: "Nguyễn Văn A",
    phone: "0900 000 000",
    product: "",
    qty: "",
    request_type: "Tư vấn dịch vụ",
    secret: "shared-secret",
    service: "Sấy & thực phẩm sấy",
    source: "/lien-he/",
    variant: "",
  });
  assert.deepEqual(JSON.parse(bodies[1]), {
    email: "customer@example.test",
    message: "Cần tư vấn số lượng lớn.",
    name: "Nguyễn Văn A",
    phone: "0900 000 000",
    product: "",
    qty: "",
    request_type: "Tư vấn dịch vụ",
    secret: "shared-secret",
    service: "",
    source: "/lien-he/",
    variant: "",
  });
});

test("rejects malformed, incomplete, and mixed contact context without calling the webhook", async () => {
  const invalidContexts = [
    productFields({ product: "", qty: "10" }),
    productFields({ qty: "10", variant: "" }),
    productFields({ qty: "1.5" }),
    { ...validSubmission, service: "khong-ton-tai" },
    productFields({ service: "say-thuc-pham-say" }),
  ];

  for (const fields of invalidContexts) {
    let called = false;
    const response = await handleContactSubmission(requestWithForm(fields), {
      environment: environment(),
      fetch: async () => {
        called = true;
        return new Response();
      },
      timeoutMs: 100,
    });
    assert.equal(response.status, 400);
    assert.equal(called, false);
  }
});

test("rejects invalid catalog product, variant, availability, and quantity rules without calling the webhook", async () => {
  const cases = [
    { fields: productFields(), productResolver: async () => null },
    { fields: productFields({ variant: "UNKNOWN-SKU" }), productResolver: async () => catalogProduct },
    {
      fields: productFields(),
      productResolver: async () => ({
        ...catalogProduct,
        variants: [{ ...catalogProduct.variants[0], isAvailable: false }],
      }),
    },
    { fields: productFields({ qty: "5" }), productResolver: async () => catalogProduct },
    { fields: productFields({ qty: "12" }), productResolver: async () => catalogProduct },
  ];

  for (const sample of cases) {
    let called = false;
    const response = await handleContactSubmission(requestWithForm(sample.fields), {
      environment: environment(),
      fetch: async () => {
        called = true;
        return new Response();
      },
      productResolver: sample.productResolver,
      timeoutMs: 100,
    });
    assert.equal(response.status, 400);
    assert.equal(called, false);
  }
});

test("safely fails if product resolution is unavailable without calling the webhook", async () => {
  let called = false;
  const response = await handleContactSubmission(requestWithForm(productFields()), {
    environment: environment(),
    fetch: async () => {
      called = true;
      return new Response();
    },
    productResolver: async () => {
      throw new Error("catalog unavailable");
    },
    timeoutMs: 100,
  });

  assert.equal(response.status, 502);
  assert.equal(called, false);
  assert.deepEqual(await response.json(), {
    message: "Không thể xác thực sản phẩm. Vui lòng thử lại.",
    ok: false,
  });
});

test("rejects missing or unsafe webhook configuration without calling upstream", async () => {
  const unsafeUrls = [
    undefined,
    "http://script.google.com/macros/s/example/exec",
    "https://example.com/collect",
    "https://user:pass@script.google.com/macros/s/example/exec",
    "https://script.google.com/macros/s/example/exec#fragment",
  ];

  for (const webhookUrl of unsafeUrls) {
    let called = false;
    const response = await handleContactSubmission(requestWithForm(), {
      environment: environment({ GOOGLE_SHEETS_WEBHOOK_URL: webhookUrl }),
      fetch: async () => {
        called = true;
        return new Response();
      },
      timeoutMs: 100,
    });

    assert.equal(response.status, 503, webhookUrl);
    assert.equal(called, false, webhookUrl);
    assert.deepEqual(await response.json(), {
      message: "Dịch vụ tiếp nhận yêu cầu chưa được cấu hình.",
      ok: false,
    });
  }
});

test("preserves validation and safe upstream failure responses", async () => {
  const invalid = await handleContactSubmission(requestWithForm({ ...validSubmission, name: "x" }), {
    environment: environment(),
    fetch: async () => new Response(),
    timeoutMs: 100,
  });
  assert.equal(invalid.status, 400);
  assert.deepEqual(await invalid.json(), {
    errors: { name: "Vui lòng nhập họ và tên." },
    message: "Vui lòng kiểm tra lại thông tin liên hệ.",
    ok: false,
  });

  const malformed = await handleContactSubmission(requestWithForm(), {
    environment: environment(),
    fetch: async () => new Response(JSON.stringify({ ok: true, data: { reference: "old-contract" } }), {
      headers: { "Content-Type": "application/json" },
    }),
    timeoutMs: 100,
  });
  assert.equal(malformed.status, 502);
  assert.deepEqual(await malformed.json(), {
    message: "Dịch vụ tiếp nhận yêu cầu trả về dữ liệu không hợp lệ.",
    ok: false,
  });
});

test("returns a timeout without exposing upstream details", async () => {
  const response = await handleContactSubmission(requestWithForm(), {
    environment: environment(),
    fetch: async (_url: string | URL | Request, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("upstream secret failure")));
    }),
    timeoutMs: 1,
  });

  assert.equal(response.status, 504);
  assert.deepEqual(await response.json(), {
    message: "Dịch vụ tiếp nhận yêu cầu phản hồi quá chậm.",
    ok: false,
  });
});

test("follows an allowlisted 302 by re-POSTing the JSON body to the trusted host", async () => {
  const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
  const response = await handleContactSubmission(requestWithForm(), {
    environment: environment(),
    fetch: async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      if (requests.length === 1) {
        return new Response(null, {
          headers: { Location: "https://script.googleusercontent.com/macros/redirect" },
          status: 302,
        });
      }
      return new Response(JSON.stringify({ ok: true, reference: "YC-REDIRECT" }), {
        headers: { "Content-Type": "application/json" },
      });
    },
    timeoutMs: 100,
  });

  assert.equal(response.status, 202);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].init?.method, "POST");
  assert.equal(requests[0].init?.redirect, "manual");
  assert.equal(requests[1].url, "https://script.googleusercontent.com/macros/redirect");
  // Google Apps Script redirects POST /exec to its content service and expects
  // the JSON body again; dropping it makes doPost see an empty payload.
  assert.equal(requests[1].init?.method, "POST");
  assert.equal(new Headers(requests[1].init?.headers).get("content-type"), "application/json");
});

test("rejects a redirect outside the allowlist before it can receive the JSON body", async () => {
  let calls = 0;
  const response = await handleContactSubmission(requestWithForm(), {
    environment: environment(),
    fetch: async () => {
      calls += 1;
      return new Response(null, {
        headers: { Location: "https://attacker.example/collect" },
        status: 307,
      });
    },
    timeoutMs: 100,
  });

  assert.equal(response.status, 502);
  assert.equal(calls, 1);
});

test("returns 504 when a JSON response starts but its body never completes", { timeout: 200 }, async () => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"ok":true,"reference":"'));
    },
  });
  const response = await handleContactSubmission(requestWithForm(), {
    environment: environment(),
    fetch: async () => new Response(body, {
      headers: { "Content-Type": "application/json" },
    }),
    timeoutMs: 1,
  });

  assert.equal(response.status, 504);
  assert.deepEqual(await response.json(), {
    message: "Dịch vụ tiếp nhận yêu cầu phản hồi quá chậm.",
    ok: false,
  });
});

const vanillaVariant = {
  contactFromQuantity: 30,
  isAvailable: true,
  label: "Vị vani",
  minimumOrderQuantity: 10,
  quantityStep: 5,
  sku: "B2B-DEMO-VANILLA",
  tierPrices: [{ minQuantity: 10, price: 90_000 }, { minQuantity: 25, price: 84_000 }],
  unit: "gói",
};

const lowSugarVariant = {
  ...vanillaVariant,
  label: "Vị ít ngọt",
  sku: "B2B-DEMO-LOWSUGAR",
  tierPrices: [{ minQuantity: 10, price: 95_000 }],
};

const cartCatalog = {
  name: "Bột dinh dưỡng",
  slug: "b2b-demo-bot-dinh-duong",
  variants: [vanillaVariant, lowSugarVariant],
};

const cartResolver = async () => cartCatalog;

const REQUEST_ID = "6b1e0f7a-6c2f-4c1a-9c3e-8f5b2d0a1e44";

function cartLine(variantSku: string, quantity: number, parentSlug = "b2b-demo-bot-dinh-duong") {
  return { parentSlug, quantity, variantSku };
}

const twoLineCart = [cartLine("B2B-DEMO-VANILLA", 25), cartLine("B2B-DEMO-LOWSUGAR", 10)];

async function snapshotFor(lines = twoLineCart, resolver = cartResolver) {
  return (await resolveRequestCart(lines, resolver)).snapshotToken;
}

function requestWithJson(body: unknown, contentType = "application/json"): Request {
  return new Request("http://localhost/api/contact", {
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": contentType },
    method: "POST",
  });
}

async function cartBody(overrides: Record<string, unknown> = {}) {
  return {
    email: "customer@example.test",
    lines: twoLineCart,
    message: "Cần báo giá cho 2 vị.",
    name: "Nguyễn Văn A",
    phone: "0900 000 000",
    requestId: REQUEST_ID,
    snapshotToken: await snapshotFor(),
    source: "/gui-yeu-cau/",
    ...overrides,
  };
}

test("forwards a canonical multi-line cart with server-computed prices and totals", async () => {
  let receivedBody = "";
  const response = await handleContactSubmission(requestWithJson(await cartBody()), {
    cartResolver,
    environment: environment(),
    fetch: async (_url: string | URL | Request, init?: RequestInit) => {
      receivedBody = String(init?.body);
      return new Response(JSON.stringify({ ok: true, reference: "YC-CART" }), {
        headers: { "Content-Type": "application/json" },
      });
    },
    timeoutMs: 100,
  });

  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), {
    message: "Yêu cầu của bạn đã được tiếp nhận.",
    ok: true,
    reference: "YC-CART",
  });
  assert.deepEqual(JSON.parse(receivedBody), {
    cart: [
      {
        index: 1,
        line_total: 2_100_000,
        note: "SKU B2B-DEMO-VANILLA",
        product: "Bột dinh dưỡng",
        qty: 25,
        unit: "gói",
        unit_price: 84_000,
        variant: "Vị vani",
      },
      {
        index: 2,
        line_total: 950_000,
        note: "SKU B2B-DEMO-LOWSUGAR",
        product: "Bột dinh dưỡng",
        qty: 10,
        unit: "gói",
        unit_price: 95_000,
        variant: "Vị ít ngọt",
      },
    ],
    cart_price_incomplete: false,
    cart_subtotal: 3_050_000,
    email: "customer@example.test",
    message: "Cần báo giá cho 2 vị.",
    name: "Nguyễn Văn A",
    phone: "0900 000 000",
    product: "Giỏ hàng (2 dòng)",
    qty: "",
    request_id: REQUEST_ID,
    request_type: "Đặt sản phẩm",
    secret: "shared-secret",
    service: "",
    source: "/gui-yeu-cau/",
    variant: "",
  });
});

test("assigns the highest cart tier and blanks price on request lines", async () => {
  const lines = [cartLine("B2B-DEMO-VANILLA", 30), cartLine("B2B-DEMO-LOWSUGAR", 10)];
  let receivedBody = "";
  const response = await handleContactSubmission(requestWithJson(await cartBody({
    lines,
    snapshotToken: await snapshotFor(lines),
  })), {
    cartResolver,
    environment: environment(),
    fetch: async (_url: string | URL | Request, init?: RequestInit) => {
      receivedBody = String(init?.body);
      return new Response(JSON.stringify({ ok: true, reference: "YC-BULK" }), {
        headers: { "Content-Type": "application/json" },
      });
    },
    timeoutMs: 100,
  });

  assert.equal(response.status, 202);
  const payload = JSON.parse(receivedBody);
  assert.equal(payload.request_type, "Tư vấn số lượng lớn");
  assert.equal(payload.product, "Giỏ hàng (2 dòng)");
  assert.equal(payload.variant, "");
  assert.equal(payload.qty, "");
  assert.equal(payload.cart[0].unit_price, "");
  assert.equal(payload.cart[0].line_total, "");
  assert.equal(payload.cart[0].note, "SKU B2B-DEMO-VANILLA · Liên hệ báo giá");
  assert.equal(payload.cart_subtotal, 950_000);
  assert.equal(payload.cart_price_incomplete, true);
});

test("refuses any client-supplied price, total, or request type instead of trusting it", async () => {
  const pricedBodies = [
    { ...await cartBody(), cart_subtotal: 1 },
    { ...await cartBody(), request_type: "Tư vấn dịch vụ" },
    { ...await cartBody(), service: "say-thuc-pham-say" },
    { ...await cartBody(), lines: twoLineCart.map((line) => ({ ...line, unitPrice: 1 })) },
    { ...await cartBody(), lines: twoLineCart.map((line) => ({ ...line, lineTotal: 1 })) },
  ];

  for (const body of pricedBodies) {
    let called = false;
    const response = await handleContactSubmission(requestWithJson(body), {
      cartResolver,
      environment: environment(),
      fetch: async () => {
        called = true;
        return new Response();
      },
      timeoutMs: 100,
    });
    assert.equal(response.status, 400, JSON.stringify(body).slice(0, 100));
    assert.equal(called, false, JSON.stringify(body).slice(0, 100));
  }
});

test("derives the forwarded price from the catalog, never from the request body", async () => {
  let receivedBody = "";
  const response = await handleContactSubmission(requestWithJson(await cartBody()), {
    cartResolver,
    environment: environment(),
    fetch: async (_url: string | URL | Request, init?: RequestInit) => {
      receivedBody = String(init?.body);
      return new Response(JSON.stringify({ ok: true, reference: "YC-SERVER-PRICED" }), {
        headers: { "Content-Type": "application/json" },
      });
    },
    timeoutMs: 100,
  });

  assert.equal(response.status, 202);
  const payload = JSON.parse(receivedBody);
  assert.equal(payload.request_type, "Đặt sản phẩm");
  assert.equal(payload.cart_subtotal, 3_050_000);
  assert.equal(payload.service, "");
  assert.equal(payload.cart[0].unit_price, 84_000);
});

test("returns 409 with a fresh snapshot when the cart drifted, without calling the webhook", async () => {
  let called = false;
  const response = await handleContactSubmission(requestWithJson(await cartBody({
    snapshotToken: "0".repeat(64),
  })), {
    cartResolver,
    environment: environment(),
    fetch: async () => {
      called = true;
      return new Response();
    },
    timeoutMs: 100,
  });

  assert.equal(response.status, 409);
  assert.equal(called, false);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.equal(body.code, "CART_DRIFTED");
  assert.equal(body.cart.snapshotToken, await snapshotFor());
  assert.equal(body.cart.pricedSubtotal, 3_050_000);
});

test("returns 409 when a price changes between revalidation and submit", async () => {
  const staleToken = await snapshotFor();
  let called = false;
  const response = await handleContactSubmission(requestWithJson(await cartBody({ snapshotToken: staleToken })), {
    cartResolver: async () => ({
      ...cartCatalog,
      variants: [
        { ...vanillaVariant, tierPrices: [{ minQuantity: 10, price: 90_000 }, { minQuantity: 25, price: 80_000 }] },
        lowSugarVariant,
      ],
    }),
    environment: environment(),
    fetch: async () => {
      called = true;
      return new Response();
    },
    timeoutMs: 100,
  });

  assert.equal(response.status, 409);
  assert.equal(called, false);
  assert.equal((await response.json()).cart.lines[0].unitPrice, 80_000);
});

test("blocks a cart submit whose lines fail validation and reports every failing line", async () => {
  const lines = [cartLine("B2B-DEMO-VANILLA", 12), cartLine("B2B-DEMO-LOWSUGAR", 5)];
  let called = false;
  const response = await handleContactSubmission(requestWithJson(await cartBody({
    lines,
    snapshotToken: await snapshotFor(lines),
  })), {
    cartResolver,
    environment: environment(),
    fetch: async () => {
      called = true;
      return new Response();
    },
    timeoutMs: 100,
  });

  assert.equal(response.status, 409);
  assert.equal(called, false);
  const body = await response.json();
  assert.equal(body.code, "CART_NOT_SUBMITTABLE");
  assert.deepEqual(body.cart.lines.map((line: { adjustments: Array<{ code: string }> }) => line.adjustments[0].code), [
    "QUANTITY_OFF_STEP",
    "QUANTITY_BELOW_MOQ",
  ]);
});

test("reports every invalid contact field of a cart submit in one error map", async () => {
  let called = false;
  const response = await handleContactSubmission(requestWithJson(await cartBody({
    email: "not-an-email",
    name: "x",
    phone: "12",
  })), {
    cartResolver,
    environment: environment(),
    fetch: async () => {
      called = true;
      return new Response();
    },
    timeoutMs: 100,
  });

  assert.equal(response.status, 400);
  assert.equal(called, false);
  assert.deepEqual(await response.json(), {
    errors: {
      email: "Địa chỉ email không hợp lệ.",
      name: "Vui lòng nhập họ và tên.",
      phone: "Số điện thoại không hợp lệ.",
    },
    message: "Vui lòng kiểm tra lại thông tin liên hệ.",
    ok: false,
  });
});

test("uses the canonical batch resolver for cart submission before any per-product resolver", async () => {
  const canonical = await resolveRequestCart(twoLineCart, cartResolver);
  let perProductResolverCalled = false;
  const response = await handleContactSubmission(requestWithJson(await cartBody({
    snapshotToken: canonical.snapshotToken,
  })), {
    cartBatchResolver: async () => canonical,
    cartResolver: async () => {
      perProductResolverCalled = true;
      return cartCatalog;
    },
    environment: environment(),
    fetch: async () => new Response(JSON.stringify({ ok: true, reference: "YC-BATCH" }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    }),
  } as never);

  assert.equal(response.status, 202);
  assert.equal(perProductResolverCalled, false);
});

test("requires an email address for a cart quote request", async () => {
  const response = await handleContactSubmission(requestWithJson(await cartBody({ email: "" })), {
    cartResolver,
    environment: environment(),
    fetch: async () => new Response(),
    timeoutMs: 100,
  });

  assert.equal(response.status, 400);
  assert.deepEqual((await response.json()).errors, { email: "Vui lòng nhập địa chỉ email." });
});

test("requires a well-formed request id and snapshot token before contacting the webhook", async () => {
  const invalidBodies = [
    await cartBody({ requestId: undefined }),
    await cartBody({ requestId: "not-a-uuid" }),
    await cartBody({ requestId: `${REQUEST_ID} ` }),
    await cartBody({ snapshotToken: undefined }),
    await cartBody({ snapshotToken: "short" }),
    await cartBody({ snapshotToken: "Z".repeat(64) }),
    await cartBody({ lines: [] }),
    await cartBody({ lines: Array.from({ length: 21 }, (_, index) => cartLine(`B2B-DEMO-${index}`, 10)) }),
    await cartBody({ lines: [cartLine("B2B-DEMO-VANILLA", 25), cartLine("B2B-DEMO-VANILLA", 25)] }),
    await cartBody({ lines: [{ parentSlug: "b2b-demo-bot-dinh-duong", quantity: 25 }] }),
    await cartBody({ extra: "field" }),
  ];

  for (const body of invalidBodies) {
    let called = false;
    const response = await handleContactSubmission(requestWithJson(body), {
      cartResolver,
      environment: environment(),
      fetch: async () => {
        called = true;
        return new Response();
      },
      timeoutMs: 100,
    });
    assert.equal(response.status, 400, JSON.stringify(body).slice(0, 120));
    assert.equal(called, false, JSON.stringify(body).slice(0, 120));
  }
});

test("rejects a cart body above the byte cap without parsing or resolving it", async () => {
  let called = false;
  const padded = `{"padding":"${"a".repeat(CONTACT_MAX_BODY_BYTES)}"}`;
  const response = await handleContactSubmission(requestWithJson(padded), {
    cartResolver: async () => {
      called = true;
      return cartCatalog;
    },
    environment: environment(),
    fetch: async () => new Response(),
    timeoutMs: 100,
  });

  assert.equal(response.status, 413);
  assert.equal(called, false);
});

test("fails a cart submit closed with 502 when the catalog cannot be re-read", async () => {
  let called = false;
  const response = await handleContactSubmission(requestWithJson(await cartBody()), {
    cartResolver: async () => {
      throw new Error("catalog unavailable");
    },
    environment: environment(),
    fetch: async () => {
      called = true;
      return new Response();
    },
    timeoutMs: 100,
  });

  assert.equal(response.status, 502);
  assert.equal(called, false);
  assert.equal(JSON.stringify(await response.json()).includes("catalog unavailable"), false);
});

test("keeps the cart request id out of the client response", async () => {
  const response = await handleContactSubmission(requestWithJson(await cartBody()), {
    cartResolver,
    environment: environment(),
    fetch: async () => new Response(JSON.stringify({ ok: true, reference: "YC-CART" }), {
      headers: { "Content-Type": "application/json" },
    }),
    timeoutMs: 100,
  });

  assert.deepEqual(Object.keys(await response.json()).sort(), ["message", "ok", "reference"]);
});
