import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("Admin navigation exposes the News desk", async () => {
  const shell = await source("src/components/admin/AdminShell.tsx");
  assert.match(shell, /Newspaper/);
  assert.match(shell, /href: "\/admin\/tin-tuc"/);
  assert.match(shell, /label: "Tin tức"/);
});

test("Admin News UI reads canonical API and only content roles can mutate", async () => {
  const page = await source("src/app/admin/tin-tuc/page.tsx");
  assert.match(page, /fetchAdmin<NewsListResponse>\(`\/api\/admin\/news\?/);
  assert.match(page, /session\.role === "owner" \|\| session\.role === "content_manager"/);
  assert.match(page, /canManage \? <button[^>]*button-news-create/);
  assert.doesNotMatch(page, /tin-tuc\.json|CapturedPage|mock|demoArticle/);
});

test("Admin News list filters canonically by category", async () => {
  const [page, route, data] = await Promise.all([
    source("src/app/admin/tin-tuc/page.tsx"),
    source("src/app/api/admin/news/route.ts"),
    source("src/lib/admin-news-data.ts"),
  ]);

  assert.match(page, /data-testid="select-news-filter-category"/);
  assert.match(page, /params\.set\("categoryId", categoryId\)/);
  assert.match(page, /setCategoryId\(""\)/);
  assert.match(route, /const categoryId = parsePositiveInt\(url\.searchParams\.get\("categoryId"\), 0\) \|\| undefined/);
  assert.match(route, /listAdminNewsArticles\(guard\.database, \{\s*categoryId,/);
  assert.match(data, /input: \{ categoryId\?: number;/);
  assert.match(data, /where\.push\("a\.category_id = \?"\)/);
  assert.match(data, /SELECT COUNT\(\*\) AS total FROM articles a WHERE \$\{whereSql\}/);
});

test("Admin News mutations carry explicit revisions and handle stale writes without overwriting", async () => {
  const page = await source("src/app/admin/tin-tuc/page.tsx");
  assert.match(page, /\.\.\.\(editor\.id \? \{ revision: editor\.revision \} : \{\}\)/);
  assert.match(page, /body: \{ revision: article\.revision \}/);
  assert.match(page, /error\.code === "STALE_WRITE"/);
  assert.match(page, /Tải bản mới nhất/);
  assert.match(page, /fetchAdmin<\{ article: AdminNewsArticle \}>\(`\/api\/admin\/news\/\$\{editor\.id\}`\)/);
});

test("Admin News editor remains a plain-text CMS boundary", async () => {
  const page = await source("src/app/admin/tin-tuc/page.tsx");
  assert.match(page, /input-news-content/);
  assert.match(page, /V1 lưu plain text an toàn/);
  assert.doesNotMatch(page, /dangerouslySetInnerHTML|__html/);
});

test("Admin News editor protects unsaved changes and supports scheduled publishing", async () => {
  const page = await source("src/app/admin/tin-tuc/page.tsx");
  assert.match(page, /beforeunload/);
  assert.match(page, /Bạn có thay đổi chưa lưu/);
  assert.match(page, /type="datetime-local"/);
  assert.match(page, /new Date\(editor\.publishedAt\)\.toISOString\(\)/);
  assert.match(page, /Bài mới luôn được tạo ở draft/);
});

test("Admin News only links to articles already visible on the public read path", async () => {
  const page = await source("src/app/admin/tin-tuc/page.tsx");
  assert.match(page, /isPubliclyVisible\(article\)/);
  assert.match(page, /article\.status !== "published" \|\| !article\.publishedAt/);
  assert.match(page, /publishedAt\.valueOf\(\) <= Date\.now\(\)/);
  assert.doesNotMatch(page, /article\.status === "published" \? \(\s*<Link/);
});
