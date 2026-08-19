import assert from "node:assert/strict";
import test from "node:test";
import {
  allowsStagingDirectQaRequest,
  allowsStagingDirectQaRuntimeRequest,
  STAGING_ADMIN_PREVIEW_MODE,
  STAGING_DIRECT_QA_MODE,
  STAGING_G2_PREVIEW_MODE,
} from "../src/lib/staging-direct-qa.ts";

function request(path: string, method = "GET", host = "giacong-vn-staging.example.workers.dev", body?: string) {
  return new Request(`https://${host}${path}`, { ...(body === undefined ? {} : { body }), method });
}

test("custom staging host is unaffected by the direct QA policy", () => {
  assert.equal(allowsStagingDirectQaRequest(request("/api/contact", "POST", "staging.kienhieu.id.vn"), undefined), true);
});

test("workers.dev fails closed unless a staging-only mode is explicitly configured", () => {
  assert.equal(allowsStagingDirectQaRequest(request("/"), undefined), false);
  assert.equal(allowsStagingDirectQaRequest(request("/"), "unexpected"), false);
});

test("temporary workers.dev allows only public reads and cart revalidation", () => {
  assert.equal(allowsStagingDirectQaRequest(request("/"), STAGING_DIRECT_QA_MODE), true);
  assert.equal(allowsStagingDirectQaRequest(request("/san-pham"), STAGING_DIRECT_QA_MODE), true);
  assert.equal(allowsStagingDirectQaRequest(request("/media/products/example.jpg"), STAGING_DIRECT_QA_MODE), true);
  assert.equal(allowsStagingDirectQaRequest(request("/api/catalog/products/example"), STAGING_DIRECT_QA_MODE), true);
  assert.equal(allowsStagingDirectQaRequest(request("/api/gui-yeu-cau/xac-thuc", "POST"), STAGING_DIRECT_QA_MODE), true);
});

test("temporary workers.dev never exposes admin or arbitrary state-changing intake", async () => {
  for (const path of ["/admin", "/admin/news", "/api/admin", "/api/admin/news"]) {
    assert.equal(allowsStagingDirectQaRequest(request(path), STAGING_DIRECT_QA_MODE), false, path);
  }
  assert.equal(allowsStagingDirectQaRequest(request("/api/contact", "POST"), STAGING_DIRECT_QA_MODE), false);
  assert.equal(allowsStagingDirectQaRequest(request("/api/gui-yeu-cau/xac-thuc", "DELETE"), STAGING_DIRECT_QA_MODE), false);

  const arbitraryContact = request("/api/contact", "POST", undefined, JSON.stringify({
    email: "attacker@example.com",
    requestId: "11111111-1111-4111-8111-111111111111",
    snapshotToken: "a".repeat(64),
    source: "internet",
  }));
  assert.equal(await allowsStagingDirectQaRuntimeRequest(arbitraryContact, STAGING_DIRECT_QA_MODE), false);
});

test("Access-protected admin preview mode admits only admin API paths to the application auth boundary", async () => {
  for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
    assert.equal(allowsStagingDirectQaRequest(request("/api/admin/news", method), STAGING_ADMIN_PREVIEW_MODE), true, method);
  }
  for (const path of ["/", "/admin", "/admin/tin-tuc", "/api/contact", "/api/catalog/products/example", "/media/products/example.jpg"]) {
    assert.equal(allowsStagingDirectQaRequest(request(path), STAGING_ADMIN_PREVIEW_MODE), false, path);
  }
  assert.equal(
    await allowsStagingDirectQaRuntimeRequest(request("/api/contact", "POST", undefined, "{}"), STAGING_ADMIN_PREVIEW_MODE),
    false,
  );
});

test("Access-protected G2 preview admits Admin APIs plus read-only public rendering, but no Admin UI or non-Admin writes", async () => {
  for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
    assert.equal(allowsStagingDirectQaRequest(request("/api/admin/news", method), STAGING_G2_PREVIEW_MODE), true, method);
  }
  for (const path of ["/", "/tin-tuc", "/tin-tuc/g2-example", "/media/news/articles/1/example.png", "/api/catalog/products/example"]) {
    assert.equal(allowsStagingDirectQaRequest(request(path, "GET"), STAGING_G2_PREVIEW_MODE), true, path);
    assert.equal(allowsStagingDirectQaRequest(request(path, "HEAD"), STAGING_G2_PREVIEW_MODE), true, `${path} HEAD`);
  }
  for (const path of ["/admin", "/admin/tin-tuc"]) {
    assert.equal(allowsStagingDirectQaRequest(request(path), STAGING_G2_PREVIEW_MODE), false, path);
  }
  for (const [path, method] of [["/api/contact", "POST"], ["/api/gui-yeu-cau/xac-thuc", "POST"], ["/tin-tuc", "POST"], ["/media/news/example.png", "DELETE"]]) {
    assert.equal(allowsStagingDirectQaRequest(request(path, method), STAGING_G2_PREVIEW_MODE), false, `${method} ${path}`);
  }
  assert.equal(
    await allowsStagingDirectQaRuntimeRequest(request("/api/contact", "POST", undefined, "{}"), STAGING_G2_PREVIEW_MODE),
    false,
  );
});

test("temporary workers.dev admits only the two non-persisting contact drift probes", async () => {
  const safePayload = JSON.stringify({
    email: "qa@example.com",
    lines: [{ parentSlug: "bot-gao-lut-xay-min", variantSku: "B2B-DEMO-BGL-05", quantity: 25 }],
    message: "staging QA only",
    name: "Staging QA",
    phone: "0868408115",
    requestId: "00000000-0000-4000-8000-000000000001",
    snapshotToken: "0".repeat(64),
    source: "staging-deep-qa",
  });
  assert.equal(
    await allowsStagingDirectQaRuntimeRequest(request("/api/contact", "POST", undefined, safePayload), STAGING_DIRECT_QA_MODE),
    true,
  );
  assert.equal(
    await allowsStagingDirectQaRuntimeRequest(request("/api/contact", "POST", undefined, "{bad json"), STAGING_DIRECT_QA_MODE),
    true,
  );
});
