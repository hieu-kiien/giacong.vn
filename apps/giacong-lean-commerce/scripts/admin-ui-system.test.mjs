import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { appendAdminToast } from "../src/lib/admin-toast-state.ts";

async function readSource(...segments) {
  return readFile(new URL(`../src/${segments.join("/")}`, import.meta.url), "utf8");
}

test("four distinct errors stay available until dismissed when more toasts arrive", () => {
  let toasts = [];
  for (let id = 1; id <= 4; id += 1) {
    toasts = appendAdminToast(toasts, { id, kind: "error", message: `Lỗi ${id}` });
  }

  assert.deepEqual(toasts.map(({ id }) => id), [1, 2, 3, 4]);
  assert.deepEqual(
    appendAdminToast(toasts, { id: 5, kind: "success", message: "Đã lưu" }).filter(({ kind }) => kind === "error").map(({ id }) => id),
    [1, 2, 3, 4],
  );
});

test("the toast stack bounds a long error backlog and keeps the most recent diagnostics", () => {
  let toasts = [];
  for (let id = 1; id <= 12; id += 1) {
    toasts = appendAdminToast(toasts, { id, kind: "error", message: `Lỗi ${id} · Mã yêu cầu: req-${id}` });
  }

  assert.deepEqual(toasts.map(({ id }) => id), [7, 8, 9, 10, 11, 12]);
});

test("the toast stack replaces its oldest routine message before dropping an error", () => {
  const initial = [
    { id: 1, kind: "success", message: "Đã lưu" },
    { id: 2, kind: "info", message: "Đang tải" },
    { id: 3, kind: "error", message: "Không lưu được" },
  ];

  assert.deepEqual(
    appendAdminToast(initial, { id: 4, kind: "success", message: "Đã xóa" }).map(({ id }) => id),
    [2, 3, 4],
  );
});

test("the toast system keeps actionable errors visible until dismissed and auto-dismisses routine feedback", async () => {
  const source = await readSource("components", "admin", "AdminToast.tsx");

  assert.match(source, /role=\{kind === "error" \? "alert" : "status"\}/);
  assert.doesNotMatch(source, /aria-live="polite"/);
  assert.doesNotMatch(source, /\balert\(/, "admin feedback must not use window.alert");
  assert.match(source, /kind !== "error"[\s\S]*?setTimeout/);
  assert.match(source, /clearTimeout\(timeout\)/);
  assert.match(source, /useEffect\(\(\) => \(\) => \{[\s\S]*?clearTimeout\(timeout\)/);
  assert.match(source, /AUTO_DISMISS_MS/);
  assert.match(source, /export function useAdminToast/);
  assert.match(source, /export function AdminToastProvider/);
});

test("admin toasts stay below the sticky topbar and move to the bottom at tablet widths", async () => {
  const styles = await readSource("styles", "admin.css");
  const stack = [...styles.matchAll(/\.admin-toast-stack\s*\{([^}]+)\}/g)]
    .map((match) => match[1])
    .find((rule) => /position:\s*fixed/.test(rule)) ?? "";
  const tabletStack = styles.match(/@media \(max-width: 768px\)\s*\{\s*\.admin-toast-stack\s*\{([^}]+)\}/)?.[1] ?? "";
  const sharedTokens = styles.match(/\.admin-app,\s*\.admin-toast-stack\s*\{([^}]+)\}/)?.[1] ?? "";
  const inlineError = styles.match(/\.admin-editor-error\s*\{([^}]+)\}/)?.[1] ?? "";
  const closeButton = styles.match(/\.admin-toast-close\s*\{([^}]+)\}/)?.[1] ?? "";

  assert.match(stack, /top:\s*calc\(54px\s*\+\s*12px\)/);
  assert.match(stack, /max-height:\s*calc\(100dvh\s*-\s*78px\)/);
  assert.match(stack, /overflow-y:\s*auto/);
  assert.match(stack, /font-family:\s*"Admin Sans"/);
  assert.match(sharedTokens, /--admin-surface:/);
  assert.match(styles, /\.admin-toast-message\s*\{[^}]*min-width:\s*0[^}]*overflow-wrap:\s*anywhere/);
  assert.match(inlineError, /overflow-wrap:\s*anywhere/);
  assert.match(closeButton, /height:\s*24px/);
  assert.match(closeButton, /width:\s*24px/);
  assert.match(styles, /\.admin-toast-close:focus-visible\s*\{/);
  assert.match(tabletStack, /bottom:\s*120px/);
  assert.match(tabletStack, /max-height:\s*calc\(100dvh\s*-\s*136px\)/);
  assert.match(tabletStack, /top:\s*auto/);
});

test("destructive actions route through the confirm dialog, never window.confirm", async () => {
  const dialog = await readSource("components", "admin", "AdminDialog.tsx");

  assert.match(dialog, /export function AdminModal/);
  assert.match(dialog, /export function AdminConfirmDialog/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /aria-describedby=\{describedBy\}/);
  assert.match(dialog, /id="admin-confirm-message"/);
  assert.match(dialog, /event\.key !== "Tab"/);
  assert.match(dialog, /previouslyFocused/);
  assert.match(dialog, /Escape/);
  assert.doesNotMatch(dialog, /window\.confirm/);
});

test("modal overlays retain the admin design-token and button scope", async () => {
  const dialog = await readSource("components", "admin", "AdminDialog.tsx");

  assert.match(dialog, /className="admin-modal-overlay admin-app"/);
});

test("form fields keep label, hint and error wiring consistent", async () => {
  const field = await readSource("components", "admin", "AdminField.tsx");

  assert.match(field, /htmlFor=\{id\}/);
  assert.match(field, /role="alert"/);
});

test("form-level save error summaries do not announce alongside the shared error toast", async () => {
  const [products, services, leads] = await Promise.all([
    readSource("app", "admin", "san-pham", "page.tsx"),
    readSource("app", "admin", "dich-vu", "page.tsx"),
    readSource("app", "admin", "yeu-cau", "page.tsx"),
  ]);

  assert.equal(/className="admin-editor-error" role="alert"/.test(products), false, "the toast announces product network failures");
  assert.match(products, /error && Object\.keys\(error\.fieldErrors \?\? \{\}\)\.length > 0 \? \(\s*<p className="admin-editor-error">/, "product summary remains only for field validation and does not repeat standalone save errors");
  assert.equal(/className="admin-editor-error" role="alert"/.test(leads), false, "the toast announces request status failures");
  assert.ok(/role=\{Object\.keys\(error\.fieldErrors \?\? \{\}\)\.length > 0 \? undefined : "alert"\}/.test(services), "service failures announce inline only when no field errors can announce themselves");
  assert.ok(/Object\.keys\(parsed\.fieldErrors \?\? \{\}\)\.length === 0\) showToast\("error", validationError\.message\)/.test(products), "field validation stays with the fields instead of repeating through a toast");
});

test("the shell mounts the toast provider so every admin page shares feedback", async () => {
  const shell = await readSource("components", "admin", "AdminShell.tsx");

  assert.match(shell, /AdminToastProvider/);
});

test("the admin control plane exposes page, navigation and member management surfaces", async () => {
  const shell = await readSource("components", "admin", "AdminShell.tsx");
  const builder = await readSource("components", "admin", "AdminPageBuilder.tsx");
  const navigation = await readSource("components", "admin", "AdminNavigationManager.tsx");
  const members = await readSource("components", "admin", "AdminMembersManager.tsx");

  assert.match(shell, /\/admin\/thiet-ke/);
  assert.match(shell, /\/admin\/dieu-huong/);
  assert.match(shell, /\/admin\/thanh-vien/);
  assert.match(shell, /\/admin\/audit/);
  assert.match(shell, /ownerOnly/);
  assert.match(builder, /\/api\/admin\/pages/);
  assert.match(builder, /Bài dịch vụ đã gỡ khỏi nhóm vẫn ở đây để sửa, ẩn hoặc đăng lại/);
  assert.doesNotMatch(builder, /dangerouslySetInnerHTML/);
  assert.match(navigation, /\/api\/admin\/navigation/);
  assert.match(navigation, /Phát hành tất cả/);
  assert.match(members, /\/api\/admin\/members/);
  assert.match(members, /title="Tài khoản quản trị"/);
  assert.match(members, /Thêm tài khoản quản trị/);
  assert.match(members, /Email đăng nhập/);
  assert.match(members, /tự liên kết danh tính Cloudflare/);
  assert.doesNotMatch(members, /member-new-subject/);
  assert.match(members, /Quản lý tài khoản quản trị/);
  assert.match(members, /currentMemberId=\{session\.memberId\}/);
  assert.match(members, /member\.id === currentMemberId/);
  assert.match(members, /label: "Admin toàn quyền"/);
  assert.doesNotMatch(members, /label: "(?:Quản lý nội dung|Quản lý hàng hóa|Quản lý yêu cầu|Người xem)"/);
  assert.doesNotMatch(members, /readOnly value="Admin toàn quyền"/);
  assert.match(members, /Tài khoản hiện tại không thể tự hạ quyền hoặc vô hiệu hóa/);
  assert.match(members, /createFieldErrors/);
  assert.match(members, /memberFieldErrors\[member\.id\]/);
  assert.match(members, /error=\{createFieldErrors\.email\}/);
  assert.match(members, /aria-invalid=\{Boolean\(createFieldErrors\.email\)\}/);
});

test("the shell groups routes in plain-language control-plane sections", async () => {
  const shell = await readSource("components", "admin", "AdminShell.tsx");
  const groups = shell.slice(shell.indexOf("const navGroups:"), shell.indexOf("const roleLabels:"));

  assert.match(groups, /id: "operations",\s*displayTitle: "VẬN HÀNH"[\s\S]*?href: "\/admin\/yeu-cau", label: "Yêu cầu báo giá"[\s\S]*?href: "\/admin\/khach-hang", label: "Khách hàng B2B"/);
  assert.match(groups, /id: "content",\s*displayTitle: "NỘI DUNG"[\s\S]*?href: "\/admin\/san-pham", label: "Sản phẩm"[\s\S]*?href: "\/admin\/dich-vu", label: "Dịch vụ"[\s\S]*?href: "\/admin\/tin-tuc", label: "Tin tức"/);
  assert.match(groups, /id: "website",\s*displayTitle: "WEBSITE"[\s\S]*?href: "\/admin\/dieu-huong", label: "Menu"/);
  assert.match(groups, /id: "system",\s*displayTitle: "HỆ THỐNG"[\s\S]*?href: "\/admin\/thanh-vien", label: "Tài khoản quản trị & quyền"[\s\S]*?href: "\/admin\/audit", label: "Lịch sử thay đổi"/);
  assert.doesNotMatch(shell, /Legacy section contract aliases preserved for static compatibility/);
  assert.match(shell, /Vai trò/);
  assert.match(shell, /Xem trang web/);
  assert.match(shell, /isAdminNavItemActive/);
  assert.match(shell, /badge-admin-environment/);
});

test("the account disclosure uses ordinary disclosure semantics and keyboard dismissal", async () => {
  const shell = await readSource("components", "admin", "AdminShell.tsx");

  assert.match(shell, /aria-expanded=\{userMenuOpen\}/);
  assert.match(shell, /aria-controls="admin-account-popover"/);
  assert.match(shell, /aria-label=\{`\$\{session\.email \?\? session\.subject\} · Menu tài khoản quản trị`\}/);
  assert.match(shell, /aria-hidden=\{!userMenuOpen\}/);
  assert.match(shell, /inert=\{!userMenuOpen\}/);
  assert.match(shell, /event\.key === "Escape"[\s\S]*?userMenuTriggerRef\.current\?\.focus\(\)/);
  assert.doesNotMatch(shell, /aria-haspopup="menu"|role="menu"|role="menuitem"/);
});

test("product status filters keep the URL and selected tab in sync", async () => {
  const products = await readSource("app", "admin", "san-pham", "page.tsx");

  assert.match(products, /function updateStatusFilter\(nextStatus: "all" \| "active" \| "draft" \| "hidden"\)/);
  assert.match(products, /nextStatus === "all"\) url\.searchParams\.delete\("status"\)/);
  assert.match(products, /url\.searchParams\.set\("status", nextStatus\)/);
  assert.match(products, /window\.history\.pushState\(window\.history\.state, "",/);
  assert.match(products, /if \(sp === "draft" \|\| sp === "active" \|\| sp === "hidden"\) \{\s*setStatusFilter\(sp\);\s*\} else \{\s*setStatusFilter\("all"\);/);
  assert.match(products, /onClick=\{\(\) => updateStatusFilter\("all"\)\}/);
});

test("protected sidebar links do not prefetch every admin route on first paint", async () => {
  const shell = await readSource("components", "admin", "AdminShell.tsx");
  const navLink = shell.match(/className="admin-nav-link"[\s\S]*?\n\s+>/)?.[0];

  assert.ok(navLink, "the protected sidebar link opening tag should remain explicit");
  assert.match(navLink, /prefetch=\{false\}/);
});

test("blocked sessions keep the Access login handoff and let unassigned accounts sign out", async () => {
  const shell = await readSource("components", "admin", "AdminShell.tsx");

  assert.match(shell, /const isAdminMembershipDenied = isBlocked && error\?\.status === 403 && error\.code === "FORBIDDEN"/);
  assert.match(shell, /const showLoginLink = \(isBlocked && !isAdminMembershipDenied\) \|\| error\?\.code === "NETWORK_ERROR"/);
  assert.match(shell, /<button[\s\S]*?data-testid="button-admin-access-login"[\s\S]*?onClick=\{\(\) => window\.location\.reload\(\)\}/);
  assert.doesNotMatch(shell, /data-testid="link-admin-access-login"/);
  assert.match(shell, /Đăng nhập Cloudflare Access/);
  assert.match(shell, /data-testid="link-admin-access-logout"/);
  assert.match(shell, /href=\{CLOUDFLARE_ACCESS_LOGOUT_PATH\}/);
  assert.match(shell, /Đăng xuất tài khoản hiện tại/);
});

test("admin fallback screens use the bundled Vietnamese-safe font", async () => {
  const css = await readSource("styles", "admin.css");

  assert.match(css, /font-family: "Admin Sans";/);
  assert.match(css, /url\("\/styles\/fonts\/SFProDisplay-Regular\.woff2"\)/);
  assert.match(css, /url\("\/styles\/fonts\/SFProDisplay-Bold\.woff2"\)/);
  assert.match(css, /\.admin-app \{[\s\S]*?font-family: "Admin Sans", system-ui, sans-serif;/);
  assert.match(css, /\.admin-access-card h1 \{ font-family: "Admin Sans", system-ui, sans-serif;/);
});

test("admin loading and Access states inherit the admin design tokens", async () => {
  const shell = await readSource("components", "admin", "AdminShell.tsx");

  assert.match(shell, /function AdminLoadingScreen\(\) \{[\s\S]*?return \(\s*<div className="admin-app">\s*<div className="admin-access-page"/);
  assert.match(shell, /function AdminAccessScreen[\s\S]*?return \(\s*<div className="admin-app">\s*<div className="admin-access-page"/);
});

test("blocked admin sessions explain the next step without console jargon", async () => {
  const shell = await readSource("components", "admin", "AdminShell.tsx");

  assert.doesNotMatch(shell, /mở console/i);
  assert.match(shell, /hoàn tất xác minh/);
  assert.match(shell, /quay lại trang này/);
});

test("network-failed admin sessions keep the Access handoff visible", async () => {
  const shell = await readSource("components", "admin", "AdminShell.tsx");

  assert.match(shell, /const showLoginLink = \(isBlocked && !isAdminMembershipDenied\) \|\| error\?\.code === "NETWORK_ERROR"/);
  assert.match(shell, /showLoginLink \? \(/);
});

test("shared admin states explain readiness without infrastructure jargon", async () => {
  const primitives = await readSource("components", "admin", "AdminPrimitives.tsx");
  const shell = await readSource("components", "admin", "AdminShell.tsx");

  assert.match(primitives, /isMigration \? "Dữ liệu chưa sẵn sàng" :/);
  assert.match(primitives, /Hệ thống chưa hoàn tất phần chuẩn bị dữ liệu/);
  assert.match(primitives, /Danh sách thành viên/);
  assert.match(primitives, /Lịch sử thay đổi/);
  assert.match(primitives, /activeProducts: "Số sản phẩm đang hoạt động"/);
  assert.match(primitives, /activeServices: "Số dịch vụ đang hoạt động"/);
  assert.match(primitives, /newLeads: "Số yêu cầu mới"/);
  assert.match(primitives, /ready \? "Sẵn sàng" : "Chưa tải được"/);
  assert.doesNotMatch(primitives, /ready \? "Sẵn sàng" : "Chưa có"/);
  assert.match(primitives, /Dữ liệu được đọc trực tiếp từ hệ thống/);
  assert.match(primitives, /Một số phần dữ liệu chưa sẵn sàng hoặc chưa tải được/);
  assert.doesNotMatch(primitives, /Dữ liệu chưa sẵn sàng trong D1/);
  assert.doesNotMatch(primitives, /schema hoặc binding D1/);
  assert.doesNotMatch(primitives, /chưa được migrate/);
  assert.doesNotMatch(primitives, /Dữ liệu được đọc trực tiếp từ API admin/);
  assert.match(shell, /Dữ liệu hiển thị trực tiếp từ hệ thống/);
  assert.doesNotMatch(shell, /Dữ liệu hiển thị trực tiếp từ D1/);
});

test("request inbox is reachable from the Lean V1 admin control plane", async () => {
  const [shell, news, dashboard, dashboardApi] = await Promise.all([
    readSource("components", "admin", "AdminShell.tsx"),
    readSource("app", "admin", "tin-tuc", "page.tsx"),
    readSource("app", "admin", "page.tsx"),
    readFile(new URL("../src/app/api/admin/dashboard/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(shell, /\/admin\/yeu-cau/);
  assert.match(shell, /Yêu cầu báo giá/);
  assert.match(news, /canManageNews\(session\.role\)/);
  assert.match(news, /if \(!canManage\)/);
  assert.doesNotMatch(dashboard, /link-dashboard-leads/);
  assert.doesNotMatch(dashboard, /recent-leads-heading/);
  assert.doesNotMatch(dashboard, /metric-leads/);
  assert.match(dashboard, /canManage\(session\.role, "services\.read"\)/);
  assert.match(dashboard, /canManage\(session\.role, "catalog\.read"\)/);
  assert.match(dashboardApi, /includeRecentLeads/);
});
