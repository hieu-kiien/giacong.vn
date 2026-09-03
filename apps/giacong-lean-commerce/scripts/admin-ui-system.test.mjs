import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readSource(...segments) {
  return readFile(new URL(`../src/${segments.join("/")}`, import.meta.url), "utf8");
}

test("the toast system renders a live region and auto-dismisses without alert()", async () => {
  const source = await readSource("components", "admin", "AdminToast.tsx");

  assert.match(source, /aria-live="polite"/);
  assert.doesNotMatch(source, /\balert\(/, "admin feedback must not use window.alert");
  assert.match(source, /AUTO_DISMISS_MS/);
  assert.match(source, /export function useAdminToast/);
  assert.match(source, /export function AdminToastProvider/);
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

test("form fields keep label, hint and error wiring consistent", async () => {
  const field = await readSource("components", "admin", "AdminField.tsx");

  assert.match(field, /htmlFor=\{id\}/);
  assert.match(field, /role="alert"/);
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
  assert.match(builder, /Page builder chỉ nhận schema an toàn/);
  assert.doesNotMatch(builder, /dangerouslySetInnerHTML/);
  assert.match(navigation, /\/api\/admin\/navigation/);
  assert.match(navigation, /Phát hành tất cả/);
  assert.match(members, /\/api\/admin\/members/);
  assert.match(members, /Tài khoản quản trị & quyền/);
  assert.match(members, /Thêm tài khoản quản trị/);
  assert.match(members, /Tài khoản đăng nhập Cloudflare Access/);
  assert.match(members, /Quản lý tài khoản quản trị/);
  assert.match(members, /currentMemberId=\{session\.memberId\}/);
  assert.match(members, /member\.id === currentMemberId/);
  assert.match(members, /label: "Chủ sở hữu \(toàn quyền\)"/);
  assert.match(members, /label: "Quản lý nội dung"/);
  assert.match(members, /label: "Quản lý catalog"/);
  assert.match(members, /label: "Quản lý yêu cầu"/);
  assert.match(members, /label: "Người xem"/);
  assert.match(members, /Vai trò quản trị/);
  assert.match(members, /Tài khoản hiện tại không thể tự hạ quyền hoặc vô hiệu hóa/);
  assert.match(members, /createFieldErrors/);
  assert.match(members, /memberFieldErrors\[member\.id\]/);
  assert.match(members, /error=\{createFieldErrors\.accessSubject\}/);
  assert.match(members, /aria-invalid=\{Boolean\(createFieldErrors\.accessSubject\)\}/);
});

test("the shell groups routes in plain-language control-plane sections", async () => {
  const shell = await readSource("components", "admin", "AdminShell.tsx");

  for (const label of [
    "Chỉnh sửa website",
    "Catalog",
    "Nội dung",
    "Yêu cầu khách hàng",
    "Cài đặt",
    "Tài khoản & quyền",
  ]) {
    assert.match(shell, new RegExp(label.replace(/[&]/g, "\\&")));
  }
  assert.match(shell, /Vai trò/);
  assert.match(shell, /Xem storefront/);
  assert.match(shell, /aria-current=\{pathname === href \|\| pathname\.startsWith\(\`\$\{href\}\/\`\)/);
  assert.match(shell, /Lịch sử thay đổi/);
});

test("protected sidebar links do not prefetch every admin route on first paint", async () => {
  const shell = await readSource("components", "admin", "AdminShell.tsx");
  const navLink = shell.match(/className="admin-nav-link"[\s\S]*?\n\s+>/)?.[0];

  assert.ok(navLink, "the protected sidebar link opening tag should remain explicit");
  assert.match(navLink, /prefetch=\{false\}/);
});

test("blocked admin sessions offer a direct Cloudflare Access login handoff", async () => {
  const shell = await readSource("components", "admin", "AdminShell.tsx");

  assert.match(shell, /<button[\s\S]*?data-testid="button-admin-access-login"[\s\S]*?onClick=\{\(\) => window\.location\.reload\(\)\}/);
  assert.doesNotMatch(shell, /data-testid="link-admin-access-login"/);
  assert.match(shell, /Đăng nhập Cloudflare Access/);
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

  assert.match(shell, /const showLoginLink = isBlocked \|\| error\?\.code === "NETWORK_ERROR"/);
  assert.match(shell, /showLoginLink \? \(/);
});

test("shared admin states explain readiness without infrastructure jargon", async () => {
  const primitives = await readSource("components", "admin", "AdminPrimitives.tsx");
  const shell = await readSource("components", "admin", "AdminShell.tsx");

  assert.match(primitives, /isMigration \? "Dữ liệu chưa sẵn sàng" :/);
  assert.match(primitives, /Hệ thống chưa hoàn tất phần chuẩn bị dữ liệu/);
  assert.match(primitives, /Danh sách thành viên/);
  assert.match(primitives, /Lịch sử thay đổi/);
  assert.match(primitives, /Dữ liệu được đọc trực tiếp từ hệ thống/);
  assert.match(primitives, /Một số phần dữ liệu chưa được chuẩn bị/);
  assert.doesNotMatch(primitives, /Dữ liệu chưa sẵn sàng trong D1/);
  assert.doesNotMatch(primitives, /schema hoặc binding D1/);
  assert.doesNotMatch(primitives, /chưa được migrate/);
  assert.doesNotMatch(primitives, /Dữ liệu được đọc trực tiếp từ API admin/);
  assert.match(shell, /Dữ liệu hiển thị trực tiếp từ hệ thống/);
  assert.doesNotMatch(shell, /Dữ liệu hiển thị trực tiếp từ D1/);
});

test("read-only roles do not receive lead/news mutation affordances or private dashboard lead names", async () => {
  const [leads, news, dashboard, dashboardApi] = await Promise.all([
    readSource("app", "admin", "yeu-cau", "page.tsx"),
    readSource("app", "admin", "tin-tuc", "page.tsx"),
    readSource("app", "admin", "page.tsx"),
    readFile(new URL("../src/app/api/admin/dashboard/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(leads, /canManageLeads\(session\.role\)/);
  assert.match(leads, /!canManageLeads\(session\.role\)/);
  assert.match(news, /canManageNews\(session\.role\)/);
  assert.match(news, /if \(!canManage\)/);
  assert.match(dashboard, /canManageLeads\(session\.role\)/);
  assert.match(dashboard, /canManageServices\(session\.role\)/);
  assert.match(dashboardApi, /includeRecentLeads/);
});
