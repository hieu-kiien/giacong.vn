-- R2-backed media owned by News articles. Article thumbnail selection remains an
-- explicit article PATCH so optimistic revision protection stays authoritative.
CREATE TABLE IF NOT EXISTS news_media_assets (
  id TEXT PRIMARY KEY,
  article_id INTEGER NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  checksum_sha256 TEXT NOT NULL,
  alt_text TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_news_media_assets_article
  ON news_media_assets(article_id, status, created_at);
