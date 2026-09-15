-- Preserve public news URLs when an already-published post receives a new slug.
-- The redirect is metadata only; the published snapshot remains canonical.
CREATE TABLE IF NOT EXISTS news_slug_redirects (
  old_slug TEXT PRIMARY KEY,
  news_id INTEGER NOT NULL REFERENCES news_posts(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (length(trim(old_slug)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_news_slug_redirects_news_id
  ON news_slug_redirects(news_id);
