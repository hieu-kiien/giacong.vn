-- Request-scoped idempotency and audit coupling for navigation item creation.
-- The existing navigation audit table intentionally remains update-only; create
-- gets its own table so the migration does not rebuild an active audit table.

CREATE TABLE IF NOT EXISTS admin_navigation_create_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE CHECK (length(request_id) = 36),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actor_subject TEXT NOT NULL CHECK (length(actor_subject) BETWEEN 1 AND 255),
  action TEXT NOT NULL CHECK (action = 'create'),
  operation TEXT NOT NULL CHECK (operation = 'create'),
  entity_type TEXT NOT NULL CHECK (entity_type = 'site_navigation'),
  entity_key TEXT NOT NULL,
  previous_revision INTEGER NOT NULL CHECK (previous_revision = 0),
  resulting_revision INTEGER NOT NULL CHECK (resulting_revision = 1),
  payload_sha256 TEXT NOT NULL CHECK (
    length(payload_sha256) = 64
    AND payload_sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  FOREIGN KEY (entity_key) REFERENCES site_navigation_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_navigation_create_audit_created
  ON admin_navigation_create_audit(created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_admin_navigation_create_audit_entity
  ON admin_navigation_create_audit(entity_key, id DESC);
