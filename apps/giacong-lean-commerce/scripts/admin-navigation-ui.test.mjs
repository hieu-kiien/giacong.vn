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
  assert.match(source, /Mục footer sẽ xuất hiện/);
  assert.match(source, /dirtyCount === 0 \|\| hasUnsavedChanges/);
  assert.match(source, /disabled=\{!canEdit \|\| !item\.localDirty \|\| saving\}/);
  assert.match(source, /disabled=\{!canPublish \|\| !item\.dirty \|\| item\.localDirty \|\| publishing\}/);
});
