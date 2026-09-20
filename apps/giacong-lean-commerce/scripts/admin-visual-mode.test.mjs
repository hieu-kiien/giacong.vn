import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  isAdminSessionReady,
  isAdminStorefrontHost,
} from "../src/lib/admin-visual-contract.ts";

const adminConfig = {
  adminHostnames: ["admin-staging.example.test", "admin.example.test"],
};

const readSource = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("admin storefront mode accepts only an exact configured admin hostname", () => {
  assert.equal(isAdminStorefrontHost("admin-staging.example.test", adminConfig), true);
  assert.equal(isAdminStorefrontHost("admin.example.test", adminConfig), true);
  assert.equal(isAdminStorefrontHost("staging.example.test", adminConfig), false);
  assert.equal(isAdminStorefrontHost("preview.example.test", adminConfig), false);
  assert.equal(isAdminStorefrontHost("admin-staging.example.test.evil.test", adminConfig), false);
  assert.equal(isAdminStorefrontHost("admin-staging.example.test:443", adminConfig), false);
  assert.equal(isAdminStorefrontHost(null, adminConfig), false);
});

test("admin mode requires an authenticated session with a known role", () => {
  assert.equal(isAdminSessionReady({ authenticated: true, role: "owner" }), true);
  assert.equal(isAdminSessionReady({ authenticated: true, role: "viewer" }), false);
  assert.equal(isAdminSessionReady({ authenticated: true, role: "unknown" }), false);
  assert.equal(isAdminSessionReady({ authenticated: true, role: null }), false);
  assert.equal(isAdminSessionReady({ authenticated: false, role: "owner" }), false);
});

test("the storefront layout gates the lightweight admin context by request host", async () => {
  const source = await readSource("../src/app/(storefront)/layout.tsx");

  assert.match(source, /import\s+["']\.\.\/\.\.\/styles\/admin\.css["'];/);
  assert.match(source, /await headers\(\)/);
  assert.match(source, /getRuntimeAdminAccessConfig/);
  assert.match(source, /normalizeAdminAccessConfig/);
  assert.match(source, /isAdminStorefrontHost/);
  assert.match(source, /<AdminVisualMode>/);
  assert.match(source, /<>\{children\}<\/>/);
});

test("the visual context is read-only and leaves contextual actions to individual pages", async () => {
  const source = await readSource("../src/components/admin/AdminVisualMode.tsx");

  assert.match(source, /fetchAdmin<AdminSession>\("\/api\/admin\/session"/);
  assert.doesNotMatch(source, /AdminStorefrontContextualActions/);
  assert.doesNotMatch(source, /AdminVisualStatusBar|admin-visual-mode-banner/);
  assert.doesNotMatch(source, /Chế độ quản trị|Trung tâm quản trị|Đang kiểm tra quyền quản trị/);
  assert.doesNotMatch(source, /Cloudflare Access chưa xác nhận phiên|Không thể kiểm tra phiên quản trị|Thử lại/);
  assert.doesNotMatch(source, /AdminVisualEditor/);
  assert.doesNotMatch(source, /mutateAdmin/);
  assert.doesNotMatch(source, /method:\s*["'](?:POST|PATCH|PUT|DELETE)["']/);
});
