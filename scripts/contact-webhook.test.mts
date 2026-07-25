import assert from "node:assert/strict";
import test from "node:test";

const { handleContactSubmission } = await import("../src/lib/contact-webhook" + ".ts");

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

test("does not include secret when it is not configured", async () => {
  let receivedBody = "";
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

test("follows an allowlisted 302 manually without forwarding the JSON body", async () => {
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
  assert.equal(requests[1].init?.method, "GET");
  assert.equal(requests[1].init?.body, undefined);
  assert.equal(new Headers(requests[1].init?.headers).get("content-type"), null);
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
