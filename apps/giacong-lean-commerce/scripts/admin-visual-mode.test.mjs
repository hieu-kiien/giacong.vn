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
  assert.equal(isAdminSessionReady({ authenticated: true, role: "viewer" }), true);
  assert.equal(isAdminSessionReady({ authenticated: true, role: "unknown" }), false);
  assert.equal(isAdminSessionReady({ authenticated: true, role: null }), false);
  assert.equal(isAdminSessionReady({ authenticated: false, role: "owner" }), false);
});

test("the storefront layout gates the client admin context by request host", async () => {
  const source = await readSource("../src/app/(storefront)/layout.tsx");

  assert.match(source, /await headers\(\)/);
  assert.match(source, /getRuntimeAdminAccessConfig/);
  assert.match(source, /normalizeAdminAccessConfig/);
  assert.match(source, /isAdminStorefrontHost/);
  assert.match(source, /<AdminVisualMode>/);
  assert.match(source, /<>{children}<\/>/);
});

test("the visual context is read-only and explains every session state", async () => {
  const source = await readSource("../src/components/admin/AdminVisualMode.tsx");

  assert.match(source, /fetchAdmin<AdminSession>\("\/api\/admin\/session"/);
  assert.match(source, /Chế độ quản trị/);
  assert.match(source, /Trung tâm quản trị/);
  assert.match(source, /Đang kiểm tra quyền quản trị/);
  assert.match(source, /Cloudflare Access chưa xác nhận phiên/);
  assert.match(source, /Không thể kiểm tra phiên quản trị/);
  assert.match(source, /Thử lại/);
  assert.doesNotMatch(source, /mutateAdmin/);
  assert.doesNotMatch(source, /method:\s*["'](?:POST|PATCH|PUT|DELETE)["']/);
});

test("the storefront shell keeps admin context out of public source paths", async () => {
  const layout = await readSource("../src/app/(storefront)/layout.tsx");
  const visualMode = await readSource("../src/components/admin/AdminVisualMode.tsx");

  assert.match(layout, /isAdminStorefrontHost\([^)]*\)/);
  assert.match(layout, /isAdminHost\s*\?/);
  assert.match(visualMode, /data-testid={`admin-visual-/);
});

test("contextual editor uses the canonical site-settings draft and publish contract", async () => {
  const source = await readSource("../src/components/admin/AdminVisualEditor.tsx");
  const styles = await readSource("../src/components/admin/AdminVisualEditor.module.css");

  assert.match(source, /fetchAdmin<SiteSettingsResponse>\("\/api\/admin\/site-settings"/);
  assert.match(source, /mutateAdmin<\{ setting: AdminSiteSetting \}>\("\/api\/admin\/site-settings"/);
  assert.match(source, /mutateAdmin<\{ setting: AdminSiteSetting \}>\("\/api\/admin\/site-settings\/publish"/);
  assert.match(source, /expectedVersion: setting\.version/);
  assert.match(source, /draftValue/);
  assert.match(source, /setting\.dirty/);
  assert.match(source, /Mở trung tâm quản trị/);
  assert.match(source, /aria-modal="true"/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.doesNotMatch(source, /api\/admin\/visual/);
});

test("admin visual mode mounts contextual controls only after a ready admin session", async () => {
  const source = await readSource("../src/components/admin/AdminVisualMode.tsx");

  assert.match(source, /<AdminVisualEditor session=\{session\} \/>/);
  assert.match(source, /status === "ready"/);
  assert.doesNotMatch(source, /<AdminVisualEditor session=\{null\}/);
});
