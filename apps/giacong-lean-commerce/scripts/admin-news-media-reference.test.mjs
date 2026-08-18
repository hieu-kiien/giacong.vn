import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("News media reference guard maps stale internal thumbnails to a conflict", async () => {
  const [migration, collectionRoute, articleRoute] = await Promise.all([
    source("migrations/0010_news_media_reference_guard.sql"),
    source("src/app/api/admin/news/route.ts"),
    source("src/app/api/admin/news/[id]/route.ts"),
  ]);

  assert.match(migration, /INVALID_NEWS_MEDIA_REFERENCE/);
  assert.match(migration, /m\.article_id = NEW\.id/);
  assert.match(migration, /m\.status = 'active'/);
  assert.match(collectionRoute, /MEDIA_REFERENCE_CONFLICT/);
  assert.match(collectionRoute, /thumbnailUrl/);
  assert.match(articleRoute, /MEDIA_REFERENCE_CONFLICT/);
  assert.match(articleRoute, /Hãy chọn lại một ảnh đang hoạt động trong Media bài viết/);
});
