-- Request-scoped idempotency and audit coupling for site-settings mutations.
-- The existing admin_audit_log CHECK constraint predates site_setting entities,
-- so this additive table keeps the applied migration immutable and records the
-- complete settings write contract without weakening existing constraints.

ALTER TABLE site_settings ADD COLUMN last_request_id TEXT;

CREATE TABLE admin_site_setting_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE CHECK (length(request_id) = 36),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actor_subject TEXT NOT NULL CHECK (length(actor_subject) BETWEEN 1 AND 255),
  action TEXT NOT NULL CHECK (action = 'update'),
  operation TEXT NOT NULL CHECK (operation IN ('draft', 'publish')),
  entity_type TEXT NOT NULL CHECK (entity_type = 'site_setting'),
  entity_key TEXT NOT NULL,
  previous_revision INTEGER NOT NULL CHECK (previous_revision > 0),
  resulting_revision INTEGER NOT NULL CHECK (resulting_revision > 0),
  payload_sha256 TEXT NOT NULL CHECK (
    length(payload_sha256) = 64
    AND payload_sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  FOREIGN KEY (entity_key) REFERENCES site_settings(setting_key) ON DELETE CASCADE
);

CREATE INDEX idx_admin_site_setting_audit_created_at
  ON admin_site_setting_audit(created_at DESC, id DESC);

CREATE INDEX idx_admin_site_setting_audit_entity
  ON admin_site_setting_audit(entity_key, id DESC);
