import assert from "node:assert/strict";
import test from "node:test";
import { allowsStagingDirectQaRequest, STAGING_DIRECT_QA_MODE } from "../src/lib/staging-direct-qa.ts";

function request(path: string, method = "GET", host = "giacong-vn-staging.example.workers.dev") {
  return new Request(`https://${host}${path}`, { method });
}

test("custom staging host is unaffected by the direct QA policy", () => {
  assert.equal(allowsStagingDirectQaRequest(request("/api/contact", "POST", "staging.kienhieu.id.vn"), undefined), true);
});

test("workers.dev fails closed unless the staging-only mode is explicitly configured", () => {
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

test("temporary workers.dev never exposes admin or state-changing intake", () => {
  for (const path of ["/admin", "/admin/news", "/api/admin", "/api/admin/news"]) {
    assert.equal(allowsStagingDirectQaRequest(request(path), STAGING_DIRECT_QA_MODE), false, path);
  }
  assert.equal(allowsStagingDirectQaRequest(request("/api/contact", "POST"), STAGING_DIRECT_QA_MODE), false);
  assert.equal(allowsStagingDirectQaRequest(request("/api/gui-yeu-cau/xac-thuc", "DELETE"), STAGING_DIRECT_QA_MODE), false);
});
