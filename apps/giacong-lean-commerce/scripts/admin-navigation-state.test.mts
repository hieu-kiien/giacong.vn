import assert from "node:assert/strict";
import test from "node:test";

import { isAdminNavItemActive, isStagingAdminHost } from "../src/lib/admin-navigation.ts";

test("the admin overview link is active only on the overview route", () => {
  assert.equal(isAdminNavItemActive("/admin", "/admin"), true);
  assert.equal(isAdminNavItemActive("/admin/yeu-cau", "/admin"), false);
  assert.equal(isAdminNavItemActive("/admin/audit", "/admin"), false);
});

test("admin section links stay active on their nested routes", () => {
  assert.equal(isAdminNavItemActive("/admin/san-pham", "/admin/san-pham"), true);
  assert.equal(isAdminNavItemActive("/admin/san-pham/123", "/admin/san-pham"), true);
  assert.equal(isAdminNavItemActive("/admin/dich-vu", "/admin/san-pham"), false);
});

test("the staging marker is limited to the staging admin hostname", () => {
  assert.equal(isStagingAdminHost("admin-staging.kienhieu.id.vn"), true);
  assert.equal(isStagingAdminHost("admin.kienhieu.id.vn"), false);
  assert.equal(isStagingAdminHost("admin-staging.kienhieu.id.vn.evil.test"), false);
});
