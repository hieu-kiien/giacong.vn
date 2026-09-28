import assert from "node:assert/strict";
import test from "node:test";

import { adminErrorFrom } from "../src/lib/admin-error-mapping.ts";
import { AdminClientError, fetchAdmin, mutateAdmin } from "../src/lib/admin-client.ts";

test("internal admin API failures put the same request ID in the response and server log", async () => {
  const requestId = "req-7d9480";
  const internalError = new Error("D1 connection detail must stay server-side");
  const originalConsoleError = console.error;
  const logCalls: unknown[][] = [];
  console.error = (...args: unknown[]) => logCalls.push(args);

  try {
    const response = adminErrorFrom(requestId, internalError, "Không thể lưu sản phẩm.");
    const body = await response.json();

    assert.equal(response.status, 500);
    assert.equal(response.headers.get("X-Request-ID"), requestId);
    assert.equal(body.requestId, requestId);
    assert.equal(body.message, "Không thể lưu sản phẩm.");
    assert.doesNotMatch(JSON.stringify(body), /D1 connection detail/);
    assert.equal(logCalls.length, 1);
    assert.equal(logCalls[0]?.[0], "[admin] write failed");
    assert.deepEqual(logCalls[0]?.[1], { requestId, error: internalError });
  } finally {
    console.error = originalConsoleError;
  }
});

test("unexpected admin API failures expose a safe request ID through the client error", async () => {
  const requestId = "req-4ca171";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    code: "INTERNAL_ERROR",
    message: "Không thể lưu sản phẩm.",
    ok: false,
    requestId,
  }), { status: 500, headers: { "Content-Type": "application/json" } })) as typeof fetch;

  try {
    await assert.rejects(
      mutateAdmin("/api/admin/products", { method: "POST", body: { name: "Demo" } }),
      (error: unknown) => {
        assert.ok(error instanceof AdminClientError);
        assert.equal(error.requestId, requestId);
        assert.match(error.message, new RegExp(requestId));
        assert.match(error.message, /Không thể lưu sản phẩm/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("expected admin validation messages keep their wording while retaining correlation metadata", async () => {
  const requestId = "req-422";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    code: "VALIDATION_ERROR",
    fieldErrors: { name: "Hãy nhập tên sản phẩm." },
    message: "Dữ liệu chưa hợp lệ.",
    ok: false,
    requestId,
  }), { status: 422, headers: { "Content-Type": "application/json" } })) as typeof fetch;

  try {
    await assert.rejects(
      mutateAdmin("/api/admin/products", { method: "POST", body: { name: "" } }),
      (error: unknown) => {
        assert.ok(error instanceof AdminClientError);
        assert.equal(error.requestId, requestId);
        assert.equal(error.message, "Dữ liệu chưa hợp lệ.");
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("malformed admin error responses retain their request ID from the response header", async () => {
  const requestId = "req-malformed-json";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("<html>upstream failed</html>", {
    status: 500,
    headers: { "Content-Type": "text/html", "X-Request-ID": requestId },
  })) as typeof fetch;

  try {
    await assert.rejects(fetchAdmin("/api/admin/dashboard"), (error: unknown) => {
      assert.ok(error instanceof AdminClientError);
      assert.equal(error.requestId, requestId);
      assert.match(error.message, new RegExp(requestId));
      assert.match(error.message, /dữ liệu không hợp lệ/);
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
