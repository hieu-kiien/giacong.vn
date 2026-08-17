import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { handleAdminSession } from "../src/lib/admin-session.ts";

test("returns the effective D1 member role in an authenticated admin session", async () => {
  const response = handleAdminSession({
    actorSubject: "access-subject-1",
    member: {
      accessSubject: "access-subject-1",
      displayName: "Owner Demo",
      email: "owner@example.com",
      id: "member-1",
      role: "owner",
    },
  }, "request-1");

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    data: {
      authenticated: true,
      member: {
        displayName: "Owner Demo",
        email: "owner@example.com",
        id: "member-1",
        role: "owner",
      },
      role: "owner",
      subject: "access-subject-1",
    },
    ok: true,
    requestId: "request-1",
  });
});

test("session route goes through requireAdmin membership guard instead of Access admission alone", async () => {
  const [route, guard] = await Promise.all([
    readFile(new URL("../src/app/api/admin/session/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/admin-guard.ts", import.meta.url), "utf8"),
  ]);

  assert.match(route, /requireAdmin\(request\)/);
  assert.doesNotMatch(route, /admitRuntimeAdminRequest/);
  assert.match(guard, /findAdminMember/);
  assert.match(guard, /Tài khoản chưa được cấp quyền trong admin/);
});
