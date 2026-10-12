import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { customerLoginDestination } from "../src/lib/customer-login-destination.ts";
import { resolveCustomerSessionView } from "../src/lib/customer-session-state.ts";

test("session transport failures hide private data without claiming the user signed out", () => {
  const verified = { revoked: false, pending: false, error: null, expectedUserId: "owner", user: { id: "owner", emailVerified: true } };
  assert.equal(resolveCustomerSessionView(verified), "verified");
  for (const error of [new Error("offline"), { status: 503 }, { status: 500 }]) {
    assert.equal(resolveCustomerSessionView({ ...verified, error, user: null }), "unavailable");
    assert.equal(resolveCustomerSessionView({ ...verified, error }), "unavailable");
  }
  assert.equal(resolveCustomerSessionView({ ...verified, revoked: true, error: new Error("offline") }), "expired");
  assert.equal(resolveCustomerSessionView({ ...verified, pending: true, user: null }), "pending");
  assert.equal(resolveCustomerSessionView({ ...verified, user: null }), "expired");
  assert.equal(resolveCustomerSessionView({ ...verified, user: { id: "owner", emailVerified: false } }), "expired");
  assert.equal(resolveCustomerSessionView({ ...verified, user: { id: "other", emailVerified: true } }), "changed");
});

test("account boundary uses the session decision and offers recovery for transport errors", () => {
  const source = readFileSync(new URL("../src/components/site/CustomerSessionBoundary.tsx", import.meta.url), "utf8");
  assert.match(source, /resolveCustomerSessionView\(/);
  assert.match(source, /view === "unavailable"/);
  assert.match(source, /Thử lại/);
});

test("login returns to a local requested page without permitting external redirects", () => {
  assert.equal(customerLoginDestination("admin"), "/admin/");
  assert.equal(customerLoginDestination("gui-yeu-cau"), "/gui-yeu-cau/");
  assert.equal(customerLoginDestination("/san-pham/test/?a=1"), "/san-pham/test/?a=1");
  for (const value of ["//evil.example", "https://evil.example", "/\\evil.example", "/api/auth/sign-out", "/tai-khoan/dang-nhap/"]) {
    assert.equal(customerLoginDestination(value), "/tai-khoan/");
  }
});

test("all website logout entries notify other open tabs after successful sign out", () => {
  const storefront = readFileSync(new URL("../src/app/(storefront)/tai-khoan/CustomerSignOutButton.tsx", import.meta.url), "utf8");
  const admin = readFileSync(new URL("../src/components/admin/AdminShell.tsx", import.meta.url), "utf8");
  assert.match(storefront, /notifyWebsiteSignOut\(\)/);
  assert.equal((admin.match(/notifyWebsiteSignOut\(\)/g) ?? []).length, 2);
  assert.match(admin, /WEBSITE_SIGN_OUT_KEY/);
  assert.match(admin, /addEventListener\("focus"/);
});

test("sold quantities are drawn from confirmed sales, never from purchase requests", () => {
  const source = readFileSync(new URL("../src/lib/admin-data.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /SUM\(li\.quantity\) FROM lead_items li WHERE li\.product_slug = p\.slug/);
  assert.equal((source.match(/SUM\(si\.quantity\) FROM zalo_sale_items si INNER JOIN zalo_sales s ON s\.id = si\.sale_id/g) ?? []).length, 2);
});
