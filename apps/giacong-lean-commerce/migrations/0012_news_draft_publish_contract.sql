-- News draft/published contract.
-- Existing unprefixed columns remain as the editable draft snapshot for
-- compatibility; published_* is the immutable public snapshot until an
-- explicit publish mutation copies the draft into it.

ALTER TABLE news_posts ADD COLUMN draft_slug TEXT NOT NULL DEFAULT '';
ALTER TABLE news_posts ADD COLUMN draft_title TEXT NOT NULL DEFAULT '';
ALTER TABLE news_posts ADD COLUMN draft_excerpt TEXT NOT NULL DEFAULT '';
ALTER TABLE news_posts ADD COLUMN draft_content TEXT NOT NULL DEFAULT '';
ALTER TABLE news_posts ADD COLUMN draft_cover_image_url TEXT;
ALTER TABLE news_posts ADD COLUMN published_slug TEXT;
ALTER TABLE news_posts ADD COLUMN published_title TEXT;
ALTER TABLE news_posts ADD COLUMN published_excerpt TEXT;
ALTER TABLE news_posts ADD COLUMN published_content TEXT;
ALTER TABLE news_posts ADD COLUMN published_cover_image_url TEXT;
ALTER TABLE news_posts ADD COLUMN last_request_id TEXT;

UPDATE news_posts
SET draft_slug = slug,
    draft_title = title,
    draft_excerpt = excerpt,
    draft_content = content,
    draft_cover_image_url = cover_image_url,
    published_slug = CASE WHEN is_published = 1 THEN slug ELSE NULL END,
    published_title = CASE WHEN is_published = 1 THEN title ELSE NULL END,
    published_excerpt = CASE WHEN is_published = 1 THEN excerpt ELSE NULL END,
    published_content = CASE WHEN is_published = 1 THEN content ELSE NULL END,
    published_cover_image_url = CASE WHEN is_published = 1 THEN cover_image_url ELSE NULL END,
    published_at = CASE WHEN is_published = 1 THEN COALESCE(published_at, updated_at) ELSE published_at END;

CREATE UNIQUE INDEX IF NOT EXISTS idx_news_posts_published_slug
  ON news_posts(published_slug)
  WHERE published_slug IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_news_posts_last_request_id
  ON news_posts(last_request_id)
  WHERE last_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_news_posts_draft_updated
  ON news_posts(updated_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS admin_news_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE CHECK (length(request_id) = 36),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actor_subject TEXT NOT NULL CHECK (length(actor_subject) BETWEEN 1 AND 255),
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  operation TEXT NOT NULL CHECK (operation IN ('draft', 'publish', 'unpublish', 'delete')),
  entity_type TEXT NOT NULL CHECK (entity_type = 'news_post'),
  entity_key TEXT NOT NULL CHECK (length(entity_key) BETWEEN 1 AND 80),
  previous_revision INTEGER CHECK (previous_revision IS NULL OR previous_revision > 0),
  resulting_revision INTEGER CHECK (resulting_revision IS NULL OR resulting_revision > 0),
  payload_sha256 TEXT NOT NULL CHECK (
    length(payload_sha256) = 64
    AND payload_sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  bulk_request_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_news_audit_entity
  ON admin_news_audit(entity_key, id DESC);

CREATE INDEX IF NOT EXISTS idx_admin_news_audit_bulk
  ON admin_news_audit(bulk_request_id, id ASC);

CREATE TABLE IF NOT EXISTS admin_news_bulk_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE CHECK (length(request_id) = 36),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actor_subject TEXT NOT NULL CHECK (length(actor_subject) BETWEEN 1 AND 255),
  action TEXT NOT NULL CHECK (action = 'update'),
  operation TEXT NOT NULL CHECK (operation = 'status_batch'),
  payload_sha256 TEXT NOT NULL CHECK (
    length(payload_sha256) = 64
    AND payload_sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  selected_count INTEGER NOT NULL CHECK (selected_count >= 0),
  changed_count INTEGER NOT NULL CHECK (
    changed_count >= 0
    AND changed_count <= selected_count
  )
);

CREATE INDEX IF NOT EXISTS idx_admin_news_bulk_audit_created
  ON admin_news_bulk_audit(created_at DESC, id DESC);
