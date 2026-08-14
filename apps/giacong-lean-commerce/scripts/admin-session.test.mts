import assert from "node:assert/strict";
import test from "node:test";

const { handleAdminSession } = await import("../src/lib/admin-session" + ".ts");

const request = new Request("https://admin-staging.kienhieu.id.vn/api/admin/session");

function assertHardenedJsonHeaders(response: Response) {
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.match(response.headers.get("content-security-policy") ?? "", /default-src 'none'/);
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
}

test("session probe returns only the safe Access subject for an admitted operator", async () => {
  const response = await handleAdminSession(request, {
    admit: async () => ({ actor: { subject: "access-subject-42" }, ok: true }),
    requestId: () => "11111111-1111-4111-8111-111111111111",
  });

  assert.equal(response.status, 200);
  assertHardenedJsonHeaders(response);
  assert.deepEqual(await response.json(), {
    data: { authenticated: true, subject: "access-subject-42" },
    ok: true,
    requestId: "11111111-1111-4111-8111-111111111111",
  });
});

test("session probe maps admission failure to a no-store safe error envelope", async () => {
  const response = await handleAdminSession(request, {
    admit: async () => ({
      code: "FORBIDDEN",
      message: "Phiên quản trị không hợp lệ.",
      ok: false,
      status: 401,
    }),
    requestId: () => "22222222-2222-4222-8222-222222222222",
  });

  assert.equal(response.status, 401);
  assertHardenedJsonHeaders(response);
  assert.deepEqual(await response.json(), {
    code: "FORBIDDEN",
    message: "Phiên quản trị không hợp lệ.",
    ok: false,
    requestId: "22222222-2222-4222-8222-222222222222",
  });
});

test("error envelope omits empty fieldErrors", async () => {
  const response = await handleAdminSession(request, {
    admit: async () => ({ code: "NOT_FOUND", message: "Không tìm thấy.", ok: false, status: 404 }),
    requestId: () => "33333333-3333-4333-8333-333333333333",
  });
  const body = await response.json() as Record<string, unknown>;
  assert.equal("fieldErrors" in body, false);
});
