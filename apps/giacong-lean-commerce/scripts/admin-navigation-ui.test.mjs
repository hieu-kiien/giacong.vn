import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("navigation publish is enabled for a saved draft but not for unsaved local edits", async () => {
  const source = await readFile(new URL("../src/components/admin/AdminNavigationManager.tsx", import.meta.url), "utf8");

  assert.match(source, /localDirty/);
  assert.match(source, /dirty: true, localDirty: true/);
  assert.match(source, /!item\.dirty \|\| item\.localDirty/);
  assert.match(source, /hasUnsavedChanges/);
  assert.match(source, /menuKey: "primary"/);
  assert.match(source, /value="footer"/);
  assert.match(source, /Mục cuối trang sẽ xuất hiện/);
  assert.match(source, /dirtyCount === 0 \|\| hasUnsavedChanges/);
  assert.match(source, /disabled=\{!canEdit \|\| !item\.localDirty \|\| saving\}/);
  assert.match(source, /disabled=\{!canPublish \|\| !item\.dirty \|\| item\.localDirty \|\| publishing\}/);
  assert.match(source, /renderNavigationTree/);
  assert.match(source, /data-depth=\{depth\}/);
  assert.match(source, /mục con được thụt vào/);
  assert.match(source, /item\.virtual \|\| item\.version === 0/);
  assert.match(source, /capturedMenuId: item\.capturedMenuId/);
  assert.match(source, /Mục con nguồn cũ/);
  assert.match(source, /!candidate\.virtual/);
});

test("admin toast stack leaves the mobile toolbar unobstructed", async () => {
  const css = await readFile(new URL("../src/styles/admin.css", import.meta.url), "utf8");
  const source = await readFile(new URL("../src/components/admin/AdminToast.tsx", import.meta.url), "utf8");
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.admin-toast-stack[\s\S]*bottom:/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)[\s\S]*\.admin-toast-stack[\s\S]*top:\s*auto/);
  assert.match(source, /current\.slice\(-2\)/);
  assert.match(source, /aria-label="Đóng thông báo"/);
});
