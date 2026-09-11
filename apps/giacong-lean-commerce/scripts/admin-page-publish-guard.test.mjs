import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const builderPath = new URL("../src/components/admin/AdminPageBuilder.tsx", import.meta.url);

function extractPublishGuard(source) {
  const match = /async function publishPage\(\) \{\s*if \((?<cond>[\s\S]+?)\) return;/.exec(source);
  assert.ok(match?.groups?.cond !== undefined, "phải tìm thấy guard if (...) return; trong publishPage");
  return match.groups.cond;
}

function extractPublishButtonDisabled(source) {
  const buttons = [...source.matchAll(/<button[^>]*disabled=\{(?<expr>[^}]+)\}[^>]*>(?<inner>[\s\S]*?)<\/button>/g)];
  const hit = buttons.find((m) => m.groups?.inner?.includes("Đăng lên web"));
  assert.ok(hit?.groups?.expr !== undefined, "phải tìm thấy nút Đăng lên web với disabled={...}");
  return hit.groups.expr;
}

test("guard publishPage chan khi KHONG dirty, mo khi dirty (dong nhat nut Dang len web)", async () => {
  const source = await readFile(builderPath, "utf8");
  const guard = extractPublishGuard(source);

  // Guard phải chặn khi chưa có gì để đăng (!dirty), chứ không phải chặn ngược khi dirty=true.
  assert.match(guard, /!selectedPage\.dirty/, "guard publishPage phải chứa !selectedPage.dirty");
  assert.doesNotMatch(guard, /[^!]selectedPage\.dirty\s*\|\|/, "guard không được chặn ngược khi dirty=true");
  // Giữ nguyên các điều kiện an toàn khác: quyền, thay đổi chưa lưu, chống 2 mutation hiệu lực.
  assert.match(guard, /!canPublish/, "guard phải giữ kiểm tra quyền !canPublish");
  assert.match(guard, /blocksChanged\(\)/, "guard phải giữ kiểm tra blocksChanged()");
  assert.match(guard, /publishInFlight\.current/, "guard phải giữ chống double-click publishInFlight");
});

test("trang mới nằm trong khu vực tùy chọn nâng cao", async () => {
  const source = await readFile(builderPath, "utf8");

  assert.match(source, /<details className="admin-builder-advanced"/);
  assert.match(source, /Tùy chọn nâng cao/);
  assert.match(source, /Tạo trang mới/);
});

test("nut Dang len web chi bat khi dirty va khong blocksChanged (guard phai dong nhat)", async () => {
  const source = await readFile(builderPath, "utf8");
  const guard = extractPublishGuard(source);
  const disabled = extractPublishButtonDisabled(source);

  assert.match(disabled, /!selectedPage\.dirty/, "button disabled phải chứa !selectedPage.dirty");
  assert.match(disabled, /blocksChanged\(\)/, "button disabled phải chứa blocksChanged()");
  assert.match(disabled, /canPublish/, "button disabled phải xét quyền canPublish");

  // Đồng nhất: cả guard và disabled đều dùng cùng cực !dirty + blocksChanged.
  assert.ok(guard.includes("!selectedPage.dirty") && disabled.includes("!selectedPage.dirty"),
    "guard và disabled phải đồng nhất cực !selectedPage.dirty");
  assert.ok(guard.includes("blocksChanged()") && disabled.includes("blocksChanged()"),
    "guard và disabled phải đồng nhất blocksChanged()");
});

test("publishPage giu inFlight, requestId reuse va shouldRetry logic", async () => {
  const source = await readFile(builderPath, "utf8");
  assert.match(source, /getPageRequestId\(publishRequest, JSON\.stringify\(payload\)\)/,
    "publishPage phải giữ requestId reuse qua getPageRequestId(publishRequest, ...)");
  assert.match(source, /publishInFlight\.current = true/, "publishPage phải giữ cờ inFlight khi chạy");
  assert.match(source, /publishInFlight\.current = false/, "publishPage phải hạ cờ inFlight trong finally");
  assert.match(source, /if \(!shouldRetryPageRequest\(reason\)\) publishRequest\.current = null/,
    "publishPage phải giữ shouldRetry logic cho publishRequest");
});
