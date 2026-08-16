import assert from "node:assert/strict";
import test from "node:test";
import { handleAdminSession } from "../src/lib/admin-session.ts";

test("returns an authenticated admin session for an admitted actor", async () => {
  const response = await handleAdminSession(new Request("https://admin.example.test/api/admin/session"), {
    admit: async () => ({ actor: { subject: "demo-actor" }, ok: true }),
    requestId: () => "request-1",
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    data: { authenticated: true, subject: "demo-actor" },
    ok: true,
    requestId: "request-1",
  });
});

test("preserves admission failures in the standard admin envelope", async () => {
  const response = await handleAdminSession(new Request("https://admin.example.test/api/admin/session"), {
    admit: async () => ({
      code: "FORBIDDEN",
      message: "Cần xác thực quản trị.",
      ok: false,
      status: 401,
    }),
    requestId: () => "request-2",
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    code: "FORBIDDEN",
    message: "Cần xác thực quản trị.",
    ok: false,
    requestId: "request-2",
  });
});