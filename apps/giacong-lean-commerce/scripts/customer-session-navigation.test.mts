import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { customerLoginDestination } from "../src/lib/customer-login-destination.ts";

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
