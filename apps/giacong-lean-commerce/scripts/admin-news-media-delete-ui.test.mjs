import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentUrl = new URL("../src/components/admin/NewsMediaLibrary.tsx", import.meta.url);

test("News media library deletes only through the reference-safe article asset API", async () => {
  const source = await readFile(componentUrl, "utf8");

  assert.match(source, /mutateAdmin/);
  assert.match(source, /`\/api\/admin\/news\/\$\{articleId\}\/media\/\$\{asset\.id\}`/);
  assert.match(source, /\{ method: "DELETE" \}/);
  assert.match(source, /window\.confirm/);
  assert.match(source, /button-news-media-delete-/);
  assert.match(source, /admin-button-danger/);
});

test("News media library prevents deleting the editor-selected asset and surfaces server conflicts", async () => {
  const source = await readFile(componentUrl, "utf8");

  assert.match(source, /selectedUrl === asset\.publicUrl/);
  assert.match(source, /"MEDIA_IN_USE"/);
  assert.match(source, /disabled=\{selected \|\| deleting\}/);
  assert.match(source, /Hãy chọn và lưu ảnh đại diện khác trước khi xóa/);
  assert.match(source, /error\.code \? `\$\{error\.code\} · `/);
});

test("News media delete UI removes the logical asset and explains deferred R2 cleanup", async () => {
  const source = await readFile(componentUrl, "utf8");

  assert.match(source, /storageDeleted: boolean/);
  assert.match(source, /setMedia\(\(items\) => items\.filter\(\(item\) => item\.id !== asset\.id\)\)/);
  assert.match(source, /R2 cleanup chưa hoàn tất và có thể được retry an toàn/);
  assert.doesNotMatch(source, /onSelect\(""\)/);
});
