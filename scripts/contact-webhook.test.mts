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
    secret: "shared-secret",
    source: "/lien-he/",
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
