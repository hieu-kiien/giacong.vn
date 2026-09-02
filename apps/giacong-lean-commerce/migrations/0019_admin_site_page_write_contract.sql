-- Request-scoped idempotency and audit coupling for managed page writes.
-- Page drafts and publishes keep their existing optimistic version model; this
-- migration adds only the request marker and specialized audit boundary.

ALTER TABLE site_pages
  ADD COLUMN last_request_id TEXT;

CREATE INDEX IF NOT EXISTS idx_site_pages_last_request_id
  ON site_pages(last_request_id)
  WHERE last_request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS admin_site_page_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE CHECK (length(request_id) = 36),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actor_subject TEXT NOT NULL CHECK (length(actor_subject) BETWEEN 1 AND 255),
  action TEXT NOT NULL CHECK (action IN ('create', 'update')),
  operation TEXT NOT NULL CHECK (operation IN ('create', 'draft', 'publish')),
  entity_type TEXT NOT NULL CHECK (entity_type = 'page'),
  entity_key TEXT NOT NULL,
  previous_revision INTEGER CHECK (previous_revision IS NULL OR previous_revision > 0),
  resulting_revision INTEGER NOT NULL CHECK (resulting_revision > 0),
  payload_sha256 TEXT NOT NULL CHECK (
    length(payload_sha256) = 64
    AND payload_sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  CHECK (
    (action = 'create' AND operation = 'create' AND previous_revision IS NULL AND resulting_revision = 1)
    OR
    (action = 'update' AND operation IN ('draft', 'publish')
      AND previous_revision IS NOT NULL AND resulting_revision = previous_revision + 1)
  ),
  FOREIGN KEY (entity_key) REFERENCES site_pages(page_key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_site_page_audit_created
  ON admin_site_page_audit(created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_admin_site_page_audit_entity
  ON admin_site_page_audit(entity_key, id DESC);
