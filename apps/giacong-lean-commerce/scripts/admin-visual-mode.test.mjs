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

test("contextual homepage editor exposes the complete supported content region", async () => {
  const source = await readSource("../src/components/admin/AdminVisualEditor.tsx");

  for (const key of [
    "hero_eyebrow",
    "hero_title",
    "hero_description",
    "hero_primary_cta_label",
    "hero_primary_cta_url",
    "hero_secondary_cta_label",
    "hero_secondary_cta_url",
    "hero_image_url",
    "about_title",
    "about_description",
  ]) {
    assert.match(source, new RegExp(`\\\"${key}\\\"`), `homepage region should expose ${key}`);
  }
  assert.match(source, /homepageDirectTargets/);
  assert.match(source, /dataset\.adminDirectTarget/);
  assert.match(source, /Bấm vào nội dung trên trang để sửa ngay tại chỗ/);
  assert.doesNotMatch(source, /DraftPreview/);
  assert.doesNotMatch(source, /Xem trước draft/);
});

test("direct editing targets the rendered storefront nodes and keeps draft changes in place", async () => {
  const [source, targets] = await Promise.all([
    readSource("../src/components/admin/AdminVisualEditor.tsx"),
    readSource("../src/components/admin/admin-visual-targets.ts"),
  ]);

  for (const key of [
    "brand_tagline",
    "hero_eyebrow",
    "hero_title",
    "hero_description",
    "hero_primary_cta_label",
    "hero_secondary_cta_label",
    "about_title",
    "about_description",
  ]) {
    assert.match(targets, new RegExp(`key: [\"']${key}[\"']`), `direct target should expose ${key}`);
  }
  assert.match(source, /findAdminVisualTarget\(document/);
  assert.match(targets, /selector: ["']#section_250108065 h3["']/);
  assert.match(source, /addEventListener\("click"/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /applyDirectSettingValue/);
  assert.match(source, /setSelectedKey/);
  assert.match(source, /Lưu draft/);
  assert.match(source, /Xuất bản/);
});

test("contextual editor hides edit affordances for read-only roles", async () => {
  const source = await readSource("../src/components/admin/AdminVisualEditor.tsx");

  assert.match(source, /const editableRoles = new Set\(\["owner",\s*"content_manager"\]\)/);
  assert.match(source, /if \(!editableRoles\.has\(session\.role\)\) return null/);
  assert.match(source, /if \(!canEdit \|\| changed\.length === 0\) return;/);
  assert.match(source, /if \(!canEdit \|\| hasLocalChanges \|\| !hasDraft\) return;/);
});

test("contextual editor traps focus and restores the opener on every close path", async () => {
  const source = await readSource("../src/components/admin/AdminVisualEditor.tsx");

  assert.match(source, /const restoreFocusRef = useRef<HTMLElement \| null>\(null\)/);
  assert.match(source, /event\.key === "Escape"[\s\S]*?closeEditor\(\)/);
  assert.match(source, /event\.key !== "Tab"/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /restoreFocusRef\.current\?\.focus\(\)/);
});

test("contextual editor exposes explicit dialog and tab relationships", async () => {
  const source = await readSource("../src/components/admin/AdminVisualEditor.tsx");

  assert.match(source, /aria-labelledby="admin-visual-editor-title"/);
  assert.match(source, /aria-describedby="admin-visual-editor-description"/);
  assert.match(source, /<h2 id="admin-visual-editor-title">/);
  assert.match(source, /<p id="admin-visual-editor-description">/);
  assert.match(source, /role="tablist"/);
  assert.match(source, /role="tab"/);
  assert.match(source, /aria-controls=\{`admin-visual-editor-panel-\$\{item\}`\}/);
  assert.match(source, /role="tabpanel"/);
  assert.match(source, /aria-labelledby=\{`admin-visual-editor-tab-\$\{region\}`\}/);
  assert.match(source, /tabIndex=\{region === item \? 0 : -1\}/);
});

test("contextual editor marks loading content and disables motion when requested", async () => {
  const [source, styles] = await Promise.all([
    readSource("../src/components/admin/AdminVisualEditor.tsx"),
    readSource("../src/components/admin/AdminVisualEditor.module.css"),
  ]);

  assert.match(source, /aria-busy="true"/);
  assert.match(source, /aria-label="Đang tải bản nháp"/);
  assert.match(styles, /transition:/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*transition: none/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration/);
});

test("admin visual mode mounts contextual controls only after a ready admin session", async () => {
  const source = await readSource("../src/components/admin/AdminVisualMode.tsx");

  assert.match(source, /<AdminVisualEditor session=\{session\} \/>/);
  assert.match(source, /status === "ready"/);
  assert.doesNotMatch(source, /<AdminVisualEditor session=\{null\}/);
});
