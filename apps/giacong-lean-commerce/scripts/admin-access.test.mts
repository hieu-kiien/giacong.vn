import assert from "node:assert/strict";
import test from "node:test";
import { admitAdminRequest, normalizeAdminAccessConfig } from "../src/lib/admin-access.ts";

const baseConfig = {
  adminHostname: "admin-staging.example.test",
  additionalAdminHostnames: ["staging-worker.example.test"],
  policyAudience: "audience-1234567890",
  teamDomain: "https://team.example.cloudflareaccess.com",
};

test("normalizes exact admin hostnames and origins", () => {
  const config = normalizeAdminAccessConfig({
    ...baseConfig,
    adminHostname: " Admin-Staging.Example.Test ",
    additionalAdminHostnames: ["staging-worker.example.test", "ADMIN-STAGING.EXAMPLE.TEST"],
  });
  assert.ok(config);
  assert.deepEqual(config.adminHostnames, ["admin-staging.example.test", "staging-worker.example.test"]);
  assert.deepEqual(config.adminOrigins, [
    "https://admin-staging.example.test",
    "https://staging-worker.example.test",
  ]);
});

test("admits the explicit public staging actor only on an allowlisted host", async () => {
  const allowed = await admitAdminRequest(
    new Request("https://staging-worker.example.test/api/admin/products"),
    { ...baseConfig, publicAdmin: true, publicSubject: "demo-actor" },
  );
  assert.deepEqual(allowed, { actor: { publicAdmin: true, subject: "demo-actor" }, ok: true });

  const preview = await admitAdminRequest(
    new Request("https://preview.example.test/api/admin/products"),
    { ...baseConfig, publicAdmin: true },
  );
  assert.equal(preview.ok, false);
  if (!preview.ok) assert.equal(preview.status, 404);
});

test("requires same-origin mutations even in public staging mode", async () => {
  const config = { ...baseConfig, publicAdmin: true };
  const missingOrigin = await admitAdminRequest(
    new Request("https://staging-worker.example.test/api/admin/products", { method: "POST" }),
    config,
  );
  assert.equal(missingOrigin.ok, false);
  if (!missingOrigin.ok) assert.equal(missingOrigin.status, 403);

  const sameOrigin = await admitAdminRequest(
    new Request("https://staging-worker.example.test/api/admin/products", {
      headers: { Origin: "https://staging-worker.example.test" },
      method: "POST",
    }),
    config,
  );
  assert.equal(sameOrigin.ok, true);
});

test("requires and verifies Access JWTs when public mode is off", async () => {
  let calls = 0;
  const verify = async (token: string) => {
    calls += 1;
    assert.equal(token, "signed-token");
    return { subject: "access-user" };
  };
  const request = new Request("https://admin-staging.example.test/api/admin/session", {
    headers: { "cf-access-jwt-assertion": "signed-token" },
  });
  const result = await admitAdminRequest(request, baseConfig, verify);
  assert.deepEqual(result, { actor: { subject: "access-user" }, ok: true });
  assert.equal(calls, 1);
});