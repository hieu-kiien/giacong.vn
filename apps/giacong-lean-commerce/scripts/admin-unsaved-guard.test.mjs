import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("màn nội dung hỏi lại trước khi tải lại lúc còn ô chưa lưu", async () => {
  const source = await readSource("../src/app/admin/noi-dung/page.tsx");

  assert.match(source, /AdminConfirmDialog/);
  assert.match(source, /from "@\/components\/admin\/AdminDialog"/);
  assert.doesNotMatch(source, /window\.confirm/);
  assert.match(source, /unsavedKeys\.size > 0/);
  assert.match(source, /showReloadConfirm/);
  assert.match(source, /requestReload/);
  assert.match(source, /data-testid="button-content-refresh"/);
  assert.match(source, /onClick=\{requestReload\}/);
  assert.match(source, /Còn .*chỗ chưa lưu\. Tải lại sẽ mất\. Vẫn tải lại\?/);
  assert.match(source, /Vẫn tải lại/);
  assert.match(source, /<AdminConfirmDialog/);
});

test("màn thiết kế trang hỏi lại trước khi chuyển tab lúc khối đang sửa dở", async () => {
  const source = await readSource("../src/components/admin/AdminPageBuilder.tsx");

  assert.match(source, /AdminConfirmDialog/);
  assert.doesNotMatch(source, /window\.confirm/);
  assert.match(source, /blocksChanged\(\)/);
  assert.match(source, /pendingPage/);
  assert.match(source, /requestSelectPage/);
  assert.match(source, /confirmSelectPage/);
  assert.match(source, /onClick=\{\(\) => requestSelectPage\(page\)\}/);
  assert.match(source, /Còn thay đổi chưa lưu\. Chuyển trang sẽ mất\. Vẫn chuyển\?/);
  assert.match(source, /Vẫn chuyển/);
  assert.match(source, /Chuyển trang sẽ mất bản nháp\?/);
});
