-- Request-scoped media mutations. R2 remains the blob store; D1 is the
-- authoritative, revisioned metadata and audit boundary.

ALTER TABLE media_assets
  ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0);

ALTER TABLE media_assets
  ADD COLUMN last_request_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_assets_last_request_id
  ON media_assets(last_request_id)
  WHERE last_request_id IS NOT NULL;

ALTER TABLE site_media_assets
  ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0);

ALTER TABLE site_media_assets
  ADD COLUMN last_request_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_site_media_assets_last_request_id
  ON site_media_assets(last_request_id)
  WHERE last_request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS admin_media_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE CHECK (length(request_id) = 36),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actor_subject TEXT NOT NULL CHECK (length(actor_subject) BETWEEN 1 AND 255),
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('media_asset', 'site_media_asset')),
  entity_key TEXT NOT NULL CHECK (length(entity_key) BETWEEN 1 AND 100),
  previous_revision INTEGER CHECK (previous_revision IS NULL OR previous_revision > 0),
  resulting_revision INTEGER NOT NULL CHECK (resulting_revision > 0),
  payload_sha256 TEXT NOT NULL CHECK (
    length(payload_sha256) = 64
    AND payload_sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  CHECK (
    (action = 'create' AND previous_revision IS NULL AND resulting_revision = 1)
    OR (action IN ('update', 'delete') AND previous_revision IS NOT NULL AND resulting_revision = previous_revision + 1)
  )
);

CREATE INDEX IF NOT EXISTS idx_admin_media_audit_entity
  ON admin_media_audit(entity_type, entity_key, id DESC);

CREATE INDEX IF NOT EXISTS idx_admin_media_audit_actor
  ON admin_media_audit(actor_subject, id DESC);
