ALTER TABLE articles ADD COLUMN archived_at TEXT;

CREATE INDEX IF NOT EXISTS idx_articles_archive_state
  ON articles(archived_at, status, published_at DESC, id DESC);
