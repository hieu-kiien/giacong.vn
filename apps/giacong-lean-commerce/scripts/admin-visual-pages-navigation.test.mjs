import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("published managed pages render content without a second storefront editor", async () => {
  const [blocks, route, home] = await Promise.all([
    readSource("../src/components/site/PageBlocks.tsx"),
    readSource("../src/app/(storefront)/[...slug]/page.tsx"),
    readSource("../src/app/(storefront)/page.tsx"),
  ]);

  assert.doesNotMatch(blocks, /AdminPageContextualAction/);
  assert.match(route, /<PageBlocks blocks=\{managedPage\.blocks\} \/>/);
  assert.match(home, /<PageBlocks blocks=\{managedPage\.blocks\} \/>/);
});

test("content and page editors hand off to the real storefront instead of reconstructing a preview", async () => {
  const [content, builder, styles] = await Promise.all([
    readSource("../src/app/admin/noi-dung/page.tsx"),
    readSource("../src/components/admin/AdminPageBuilder.tsx"),
    readSource("../src/styles/admin.css"),
  ]);

  assert.doesNotMatch(content, /ContentPreview|admin-preview-page|Live draft preview|Preview dùng bản nháp/);
  assert.match(content, /Mở trang web thật/);
  assert.match(content, /href="\/"/);
  assert.doesNotMatch(builder, /PageBlocks|admin-builder-preview-frame|Live draft preview|Preview dùng draft/);
  assert.match(builder, /selectedPage\.routePath/);
  assert.match(builder, /Mở trang thật/);
  assert.doesNotMatch(styles, /admin-preview-|admin-content-preview|admin-builder-preview/);
  assert.match(styles, /admin-live-storefront-card/);
});

test("admin page builder honors a safe page deep-link through the canonical page API", async () => {
  const source = await readSource("../src/components/admin/AdminPageBuilder.tsx");

  assert.match(source, /useSearchParams/);
  assert.match(source, /searchParams\.get\(["']page["']\)/);
  assert.match(source, /page\.pageKey === requestedPage/);
  assert.match(source, /fetchAdmin<PagesResponse>\(["']\/api\/admin\/pages["']\)/);
  assert.doesNotMatch(source, /api\/admin\/visual/);
});

test("admin page builder keeps request IDs stable across retriable writes and locks duplicate submits", async () => {
  const source = await readSource("../src/components/admin/AdminPageBuilder.tsx");

  assert.match(source, /getPageRequestId/);
  assert.match(source, /crypto\.randomUUID\(\)/);
  assert.match(source, /requestId \}/);
  assert.match(source, /saveInFlight\.current/);
  assert.match(source, /publishInFlight\.current/);
  assert.match(source, /createInFlight\.current/);
  assert.match(source, /status === 0 \|\| reason\.status >= 500/);
});

test("managed page contextual control stays out of captured fallback paths", async () => {
  const source = await readSource("../src/app/(storefront)/[...slug]/page.tsx");

  assert.match(source, /if \(managedPage\?\.blocks\.length\)/);
  assert.match(source, /<PageBlocks blocks=\{managedPage\.blocks\} \/>/);
  assert.match(source, /const data = await readCapturedPath\(routePath\)/);
  assert.match(source, /return \(\s*<CapturedPage/);
  assert.match(source, /activeCapturedMenuId=\{resolveCapturedActiveMenuId\(routePath\)\}/);
});

test("remaining contextual actions have keyboard and responsive affordances", async () => {
  const styles = await readSource("../src/components/admin/AdminNewsContextualAction.module.css");

  assert.match(styles, /max-width/);
  assert.match(styles, /@media/);
  assert.match(styles, /focus-visible/);
});

test("contact contextual action binds and removes a live editor click handler", async () => {
  const source = await readSource("../src/components/admin/AdminContactContextualAction.tsx");

  assert.match(source, /const handleClick = \(\) => \{\s*void openEditor\(\);\s*\};/);
  assert.match(source, /button\.addEventListener\("click", handleClick\)/);
  assert.match(source, /button\.removeEventListener\("click", handleClick\)/);
});

test("contact contextual action clears the captured header hit area", async () => {
  const styles = await readSource("../src/app/globals.css");

  assert.match(styles, /\.admin-contact-contextual-action\s*\{[\s\S]*padding:\s*84px\s+15px\s+0;/);
});

test("contact editor distinguishes draft values from the value currently published", async () => {
  const source = await readSource("../src/components/admin/AdminContactContextualAction.tsx");

  assert.match(source, /Bản nháp đang để trống/);
  assert.match(source, /bản đã phát hành/);
  assert.match(source, /giá trị mặc định/);
});

test("page builder confirms section removal before changing the draft", async () => {
  const source = await readSource("../src/components/admin/AdminPageBuilder.tsx");

  assert.match(source, /AdminConfirmDialog/);
  assert.match(source, /pendingRemove/);
  assert.match(source, /Xóa khối khỏi bản nháp/);
  assert.match(source, /Bạn có thể hủy trước khi lưu bản nháp/);
});
