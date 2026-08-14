-- Cloudflare-native admin foundation.
--
-- This migration is intentionally additive so the existing staging catalog can be
-- upgraded without rewriting canonical commerce rows. `revision` is the durable
-- optimistic-concurrency token; `updated_at` remains human-readable metadata and
-- is not relied on for collision-safe stale-write detection.

ALTER TABLE categories
  ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0);

ALTER TABLE products
  ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0);

ALTER TABLE product_variants
  ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0);

ALTER TABLE services
  ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0);

CREATE TABLE admin_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE CHECK (length(request_id) = 36),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actor_subject TEXT NOT NULL CHECK (length(actor_subject) BETWEEN 1 AND 255),
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'upload')),
  entity_type TEXT NOT NULL CHECK (
    entity_type IN ('category', 'product', 'variant', 'tier_prices', 'media', 'service')
  ),
  entity_key TEXT NOT NULL CHECK (length(entity_key) BETWEEN 1 AND 500),
  previous_revision INTEGER CHECK (previous_revision IS NULL OR previous_revision > 0),
  resulting_revision INTEGER CHECK (resulting_revision IS NULL OR resulting_revision > 0),
  payload_sha256 TEXT NOT NULL CHECK (
    length(payload_sha256) = 64
    AND payload_sha256 NOT GLOB '*[^0-9a-f]*'
  )
);

CREATE INDEX idx_admin_audit_log_created_at
  ON admin_audit_log(created_at DESC, id DESC);

CREATE INDEX idx_admin_audit_log_entity
  ON admin_audit_log(entity_type, entity_key, id DESC);

CREATE INDEX idx_admin_audit_log_actor
  ON admin_audit_log(actor_subject, id DESC);
