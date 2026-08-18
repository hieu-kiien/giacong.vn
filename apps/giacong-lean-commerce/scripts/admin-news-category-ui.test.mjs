import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("Admin navigation exposes the News category desk", async () => {
  const shell = await source("src/components/admin/AdminShell.tsx");
  assert.match(shell, /Tags/);
  assert.match(shell, /href: "\/admin\/chuyen-muc-tin-tuc"/);
  assert.match(shell, /label: "Chuyên mục tin tức"/);
});

test("News category UI reads and mutates only the canonical category API", async () => {
  const page = await source("src/app/admin/chuyen-muc-tin-tuc/page.tsx");
  assert.match(page, /fetchAdmin<CategoryListResponse>\("\/api\/admin\/news\/categories"/);
  assert.match(page, /`\/api\/admin\/news\/categories\/\$\{editor\.id\}`/);
  assert.match(page, /`\/api\/admin\/news\/categories\/\$\{category\.id\}`/);
  assert.doesNotMatch(page, /mock|demoCategory|article_categories\.json/);
});

test("News category mutations are role gated and send explicit revision tokens", async () => {
  const page = await source("src/app/admin/chuyen-muc-tin-tuc/page.tsx");
  assert.match(page, /session\.role === "owner" \|\| session\.role === "content_manager"/);
  assert.match(page, /\.\.\.\(editor\.id \? \{ revision: editor\.revision \} : \{\}\)/);
  assert.match(page, /body: \{ revision: category\.revision \}/);
  assert.match(page, /canManage \? \(/);
});

test("News category UI handles stale writes and protects unsaved changes", async () => {
  const page = await source("src/app/admin/chuyen-muc-tin-tuc/page.tsx");
  assert.match(page, /beforeunload/);
  assert.match(page, /Bạn có thay đổi chuyên mục chưa lưu/);
  assert.match(page, /error\.code === "STALE_WRITE"/);
  assert.match(page, /Tải bản mới nhất/);
  assert.match(page, /fetchAdmin<\{ category: NewsCategory \}>\(`\/api\/admin\/news\/categories\/\$\{editor\.id\}`\)/);
});

test("News category UI makes hide-vs-delete semantics explicit", async () => {
  const page = await source("src/app/admin/chuyen-muc-tin-tuc/page.tsx");
  assert.match(page, /Tạm ẩn thay vì xóa/);
  assert.match(page, /không còn bài viết tham chiếu/);
  assert.match(page, /checkbox-news-category-active/);
  assert.match(page, /sortOrder/);
});
