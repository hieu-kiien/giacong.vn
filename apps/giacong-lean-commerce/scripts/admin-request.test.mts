import assert from "node:assert/strict";
import test from "node:test";
import {
  adminJsonBodyLimit,
  hasOnlyKeys,
  isAdminRequestId,
  readBoundedAdminJson,
} from "../src/lib/admin-request.ts";

test("admin JSON parser rejects a non-JSON content type before reading the body", async () => {
  const result = await readBoundedAdminJson(new Request("https://admin-staging.kienhieu.id.vn/api/admin/site-settings", {
    method: "PATCH",
    headers: { "content-type": "text/plain" },
    body: "{}",
  }));

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 415);
    assert.equal(result.code, "UNSUPPORTED_MEDIA");
  }
});

test("admin JSON parser enforces the byte limit before JSON parsing", async () => {
  const result = await readBoundedAdminJson(new Request("https://admin-staging.kienhieu.id.vn/api/admin/site-settings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: "x".repeat(adminJsonBodyLimit + 1),
  }));

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.status, 413);
});

test("admin JSON parser reports malformed JSON and accepts JSON charset parameters", async () => {
  const malformed = await readBoundedAdminJson(new Request("https://admin-staging.kienhieu.id.vn/api/admin/site-settings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: "{",
  }));
  assert.equal(malformed.ok, false);
  if (!malformed.ok) assert.equal(malformed.status, 400);

  const valid = await readBoundedAdminJson(new Request("https://admin-staging.kienhieu.id.vn/api/admin/site-settings", {
    method: "PATCH",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ ok: true }),
  }));
  assert.deepEqual(valid.ok ? valid.body : null, { ok: true });
});

test("admin request IDs are UUIDs and request bodies can be exact-key checked", () => {
  assert.equal(isAdminRequestId("11111111-1111-4111-8111-111111111111"), true);
  assert.equal(isAdminRequestId("not-a-request-id"), false);
  assert.equal(hasOnlyKeys({ requestId: "id", key: "brand_name" }, ["requestId", "key"]), true);
  assert.equal(hasOnlyKeys({ requestId: "id", unexpected: true }, ["requestId", "key"]), false);
});
