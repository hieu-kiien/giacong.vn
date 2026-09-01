-- Request-scoped idempotency and audit coupling for navigation bulk publish.
-- Navigation items keep their existing draft/published model; this migration
-- only adds a per-item marker and a replayable bulk audit envelope.

ALTER TABLE site_navigation_items
  ADD COLUMN last_request_id TEXT;

CREATE INDEX IF NOT EXISTS idx_site_navigation_last_request_id
  ON site_navigation_items(last_request_id)
  WHERE last_request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS admin_navigation_bulk_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE CHECK (length(request_id) = 36),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actor_subject TEXT NOT NULL CHECK (length(actor_subject) BETWEEN 1 AND 255),
  action TEXT NOT NULL CHECK (action = 'update'),
  operation TEXT NOT NULL CHECK (operation = 'publish_all'),
  payload_sha256 TEXT NOT NULL CHECK (
    length(payload_sha256) = 64
    AND payload_sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  selected_count INTEGER NOT NULL CHECK (selected_count BETWEEN 0 AND 100),
  published_count INTEGER NOT NULL CHECK (
    published_count BETWEEN 0 AND selected_count
  ),
  selected_ids_json TEXT NOT NULL CHECK (length(selected_ids_json) BETWEEN 2 AND 20000)
);

CREATE TABLE IF NOT EXISTS admin_navigation_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE CHECK (length(request_id) = 36),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actor_subject TEXT NOT NULL CHECK (length(actor_subject) BETWEEN 1 AND 255),
  action TEXT NOT NULL CHECK (action = 'update'),
  operation TEXT NOT NULL CHECK (operation IN ('draft', 'publish')),
  entity_type TEXT NOT NULL CHECK (entity_type = 'site_navigation'),
  entity_key TEXT NOT NULL,
  previous_revision INTEGER NOT NULL CHECK (previous_revision >= 0),
  resulting_revision INTEGER NOT NULL CHECK (resulting_revision = previous_revision + 1),
  payload_sha256 TEXT NOT NULL CHECK (
    length(payload_sha256) = 64
    AND payload_sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  bulk_request_id TEXT,
  FOREIGN KEY (bulk_request_id) REFERENCES admin_navigation_bulk_audit(request_id) ON DELETE CASCADE,
  FOREIGN KEY (entity_key) REFERENCES site_navigation_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_navigation_audit_created
  ON admin_navigation_audit(created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_admin_navigation_audit_entity
  ON admin_navigation_audit(entity_key, id DESC);

CREATE INDEX IF NOT EXISTS idx_admin_navigation_audit_bulk
  ON admin_navigation_audit(bulk_request_id, id ASC);
