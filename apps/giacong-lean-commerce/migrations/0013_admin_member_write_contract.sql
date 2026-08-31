-- Request-scoped member mutations.
-- The existing admin_audit_log entity CHECK intentionally remains unchanged;
-- members use a dedicated audit table so role changes are replayable and auditable.

ALTER TABLE admin_members
  ADD COLUMN last_request_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_members_last_request_id
  ON admin_members(last_request_id)
  WHERE last_request_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS admin_member_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE CHECK (length(request_id) = 36),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actor_subject TEXT NOT NULL CHECK (length(actor_subject) BETWEEN 1 AND 255),
  action TEXT NOT NULL CHECK (action IN ('create', 'update')),
  entity_type TEXT NOT NULL CHECK (entity_type = 'admin_member'),
  entity_key TEXT NOT NULL CHECK (length(entity_key) BETWEEN 1 AND 100),
  previous_revision INTEGER CHECK (previous_revision IS NULL OR previous_revision > 0),
  resulting_revision INTEGER NOT NULL CHECK (resulting_revision > 0),
  payload_sha256 TEXT NOT NULL CHECK (
    length(payload_sha256) = 64
    AND payload_sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  CHECK (
    (action = 'create' AND previous_revision IS NULL AND resulting_revision = 1)
    OR (action = 'update' AND previous_revision IS NOT NULL AND resulting_revision = previous_revision + 1)
  )
);

CREATE INDEX IF NOT EXISTS idx_admin_member_audit_entity
  ON admin_member_audit(entity_key, id DESC);

CREATE INDEX IF NOT EXISTS idx_admin_member_audit_actor
  ON admin_member_audit(actor_subject, id DESC);
