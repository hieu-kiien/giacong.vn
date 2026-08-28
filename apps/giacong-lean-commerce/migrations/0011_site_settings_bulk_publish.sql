-- Request-scoped audit envelope for the settings bulk-publish action.
-- Per-setting audit rows keep the exact revision and payload for every change;
-- this row makes the whole bulk request replayable without repeating writes.

ALTER TABLE admin_site_setting_audit ADD COLUMN bulk_request_id TEXT;

CREATE TABLE admin_site_setting_bulk_audit (
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
  selected_count INTEGER NOT NULL CHECK (selected_count >= 0),
  published_count INTEGER NOT NULL CHECK (
    published_count >= 0
    AND published_count <= selected_count
  )
);

CREATE INDEX idx_admin_site_setting_audit_bulk_request
  ON admin_site_setting_audit(bulk_request_id, id ASC);
