import assert from "node:assert/strict";
import test from "node:test";
import { hasRenderedAdminFailure } from "./qa-admin-staging-helpers.mjs";

test("does not treat the normal Cloudflare Access explanation as a rendered failure", () => {
  const body = "Cloudflare Access vẫn là lớp xác thực đầu vào bắt buộc.";

  assert.equal(hasRenderedAdminFailure(body), false);
});

test("detects the actual admin sign-in block screen and runtime failure messages", () => {
  assert.equal(hasRenderedAdminFailure("Khu vực này cần Cloudflare Access"), true);
  assert.equal(hasRenderedAdminFailure("Đăng nhập để vào khu vực quản trị"), true);
  assert.equal(hasRenderedAdminFailure("Tài khoản chưa được cấp quyền admin"), true);
  assert.equal(hasRenderedAdminFailure("Không thể tải dữ liệu"), true);
  assert.equal(hasRenderedAdminFailure("Worker exceeded resource limits (1102)"), true);
});
