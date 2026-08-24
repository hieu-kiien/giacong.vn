import assert from "node:assert/strict";
import test from "node:test";
import { handleAdminSession } from "../src/lib/admin-session.ts";

test("returns an authenticated session carrying the operator role", async () => {
  const response = await handleAdminSession(new Request("https://admin.example.test/api/admin/session"), {
    admit: async () => ({ actor: { subject: "demo-actor" }, ok: true }),
    requestId: () => "request-1",
    resolveRole: async () => "owner",
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    data: { authenticated: true, role: "owner", subject: "demo-actor" },
    ok: true,
    requestId: "request-1",
  });
});

test("public demo actors are owners without a D1 role lookup", async () => {
  let resolveRoleCalled = false;
  const response = await handleAdminSession(new Request("https://admin.example.test/api/admin/session"), {
    admit: async () => ({
      actor: { publicAdmin: true, subject: "public-demo" },
      ok: true,
    }),
    requestId: () => "request-2",
    resolveRole: async () => {
      resolveRoleCalled = true;
      return "viewer";
    },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.role, "owner");
  assert.equal(resolveRoleCalled, false);
});

test("a failed role lookup degrades to viewer instead of blocking the session", async () => {
  const response = await handleAdminSession(new Request("https://admin.example.test/api/admin/session"), {
    admit: async () => ({ actor: { subject: "unknown-actor" }, ok: true }),
    requestId: () => "request-3",
    resolveRole: async () => {
      throw new Error("d1 unavailable");
    },
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.role, "viewer");
});

test("preserves admission failures in the standard admin envelope", async () => {
  const response = await handleAdminSession(new Request("https://admin.example.test/api/admin/session"), {
    admit: async () => ({
      code: "FORBIDDEN",
      message: "Cần xác thực quản trị.",
      ok: false,
      status: 401,
    }),
    requestId: () => "request-4",
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    code: "FORBIDDEN",
    message: "Cần xác thực quản trị.",
    ok: false,
    requestId: "request-4",
  });
});
