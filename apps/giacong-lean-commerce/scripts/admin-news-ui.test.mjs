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

test("Admin News editor mounts article-owned media without bypassing article save", async () => {
  const [page, media] = await Promise.all([
    source("src/app/admin/tin-tuc/page.tsx"),
    source("src/components/admin/NewsMediaLibrary.tsx"),
  ]);

  assert.match(page, /import \{ NewsMediaLibrary \} from "@\/components\/admin\/NewsMediaLibrary"/);
  assert.match(page, /<NewsMediaLibrary\s+articleId=\{form\.id\}/);
  assert.match(page, /onSelect=\{\(url\) => update\("thumbnailUrl", url\)\}/);
  assert.match(page, /URL này chỉ được ghi vào bài khi bạn bấm Lưu bài viết/);
  assert.match(media, /!articleId \? \(/);
  assert.match(media, /Hãy tạo và lưu bản nháp trước/);
  assert.doesNotMatch(media, /PATCH|updateAdminNewsArticle/);
  assert.doesNotMatch(media, /`\/api\/admin\/news\/\$\{articleId\}`/);
});

test("Admin News media library lists, uploads and deletes only through article-owned media APIs", async () => {
  const media = await source("src/components/admin/NewsMediaLibrary.tsx");

  assert.match(media, /fetchAdmin<\{ media: AdminNewsMediaAsset\[\] \}>\(/);
  assert.match(media, /`\/api\/admin\/news\/\$\{articleId\}\/media`/);
  assert.match(media, /const payload = new FormData\(\)/);
  assert.match(media, /payload\.set\("file", file\)/);
  assert.match(media, /payload\.set\("altText", altText\.trim\(\)\)/);
  assert.match(media, /uploadAdmin<\{ media: AdminNewsMediaAsset \}>\(/);
  assert.match(media, /onSelect\(result\.media\.publicUrl\)/);
  assert.match(media, /Hãy bấm Lưu bài viết để ghi thumbnail vào article revision hiện tại/);
  assert.match(media, /Dùng làm ảnh đại diện/);
  assert.match(media, /mutateAdmin<\{ media: AdminNewsMediaAsset; storageDeleted: boolean \}>\(/);
  assert.match(media, /`\/api\/admin\/news\/\$\{articleId\}\/media\/\$\{asset\.id\}`/);
  assert.match(media, /\{ method: "DELETE" \}/);
  assert.doesNotMatch(media, /method: "PATCH"/);
});

test("Admin multipart helper leaves the browser responsible for the boundary", async () => {
  const client = await source("src/lib/admin-client.ts");

  assert.match(client, /export async function uploadAdmin<T>/);
  assert.match(client, /body: form/);
  assert.match(client, /credentials: "include"/);
  assert.match(client, /headers: \{ Accept: "application\/json" \}/);
  const uploadSection = client.slice(client.indexOf("export async function uploadAdmin"), client.indexOf("export function formatAdminDate"));
  assert.doesNotMatch(uploadSection, /Content-Type|multipart\/form-data/);
});
