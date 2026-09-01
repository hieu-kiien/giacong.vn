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
  assert.match(members, /Granular RBAC/);
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

test("blocked admin sessions offer a direct Cloudflare Access login handoff", async () => {
  const shell = await readSource("components", "admin", "AdminShell.tsx");

  assert.match(shell, /data-testid="link-admin-access-login"[\s\S]*?href="\/admin"/);
  assert.doesNotMatch(shell, /cdn-cgi\/access\/login/);
  assert.match(shell, /Đăng nhập Cloudflare Access/);
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
