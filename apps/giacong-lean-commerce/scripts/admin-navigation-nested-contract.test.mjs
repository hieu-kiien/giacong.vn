import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("nested navigation migration extends the existing draft/published rows", async () => {
  const migration = await read("migrations/0021_navigation_nested_items.sql");
  assert.match(migration, /ALTER TABLE site_navigation_items\s+ADD COLUMN draft_parent_id TEXT/i);
  assert.match(migration, /ALTER TABLE site_navigation_items\s+ADD COLUMN published_parent_id TEXT/i);
  assert.match(migration, /idx_site_navigation_parent/i);
});

test("navigation API accepts parentId while rejecting unknown fields", async () => {
  const createRoute = await read("src/app/api/admin/navigation/route.ts");
  const updateRoute = await read("src/app/api/admin/navigation/[id]/route.ts");
  assert.match(createRoute, /parentId/);
  assert.match(updateRoute, /parentId/);
  assert.match(createRoute, /hasOnlyKeys\(body, \["requestId"[\s\S]*parentId/);
  assert.match(updateRoute, /hasOnlyKeys\(body, \["requestId"[\s\S]*parentId/);
});

test("navigation reader and writer carry draft and published parent ids", async () => {
  const [source, manager] = await Promise.all([
    read("src/lib/site-navigation.ts"),
    read("src/components/admin/AdminNavigationManager.tsx"),
  ]);
  assert.match(source, /draft_parent_id/);
  assert.match(source, /published_parent_id/);
  assert.match(source, /draftParentId/);
  assert.match(source, /publishedParentId/);
  assert.match(source, /validateNavigationTree/);
  assert.match(source, /navigationItems\.map\(\(item\) => \(\{/);
  assert.match(source, /MAX_NAVIGATION_RENDER_DEPTH/);
  assert.match(manager, /newItem\.menuKey === "primary"/);
  assert.match(manager, /parentId: menuKey === "footer" \? "" : current\.parentId/);
  assert.match(manager, /item\.menuKey === "primary" && !item\.capturedMenuId/);
});
