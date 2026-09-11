import assert from "node:assert/strict";
import test from "node:test";
import { handleAdminSession } from "../src/lib/admin-session.ts";

test("single admin session refuses every retired role", async () => {
  for (const role of ["content_manager", "catalog_manager", "sales_manager", "viewer"]) {
    const response = await handleAdminSession(new Request("https://admin.example.test/api/admin/session"), {
      admit: async () => ({ actor: { subject: "retired-actor" }, ok: true }),
      requestId: () => "retired-session",
      resolveRole: async () => ({memberId:"retired-member",role}),
    });
    assert.equal(response.status,403,role);
    assert.equal((await response.json()).ok,false);
  }
});

test("returns an authenticated session carrying the operator role", async () => {
  const response = await handleAdminSession(new Request("https://admin.example.test/api/admin/session"), {
    admit: async () => ({ actor: { subject: "demo-actor" }, ok: true }),
    requestId: () => "request-1",
    resolveRole: async () => ({ memberId: "owner-1", role: "owner" }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    data: { authenticated: true, memberId: "owner-1", role: "owner", subject: "demo-actor" },
    ok: true,
    requestId: "request-1",
  });
});

test("returns the resolved member id so the UI can protect the current account", async () => {
  const response = await handleAdminSession(new Request("https://admin.example.test/api/admin/session"), {
    admit: async () => ({ actor: { subject: "access-subject" }, ok: true }),
    requestId: () => "request-member-id",
    resolveRole: async () => ({ memberId: "owner-1", role: "owner" }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, {
    authenticated: true,
    memberId: "owner-1",
    role: "owner",
    subject: "access-subject",
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
      return null;
    },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.data.role, "owner");
  assert.equal(resolveRoleCalled, false);
});

test("an unknown Access identity is blocked instead of being presented as viewer", async () => {
  const response = await handleAdminSession(new Request("https://admin.example.test/api/admin/session"), {
    admit: async () => ({ actor: { subject: "unknown-actor" }, ok: true }),
    requestId: () => "request-3",
    resolveRole: async () => null,
  });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    code: "FORBIDDEN",
    message: "Tài khoản chưa được cấp quyền trong admin.",
    ok: false,
    requestId: "request-3",
  });
});

test("a failed role lookup returns a safe unavailable response", async () => {
  const response = await handleAdminSession(new Request("https://admin.example.test/api/admin/session"), {
    admit: async () => ({ actor: { subject: "unknown-actor" }, ok: true }),
    requestId: () => "request-3b",
    resolveRole: async () => {
      throw new Error("d1 unavailable");
    },
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    code: "INTERNAL_ERROR",
    message: "Không thể xác minh quyền admin lúc này.",
    ok: false,
    requestId: "request-3b",
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
