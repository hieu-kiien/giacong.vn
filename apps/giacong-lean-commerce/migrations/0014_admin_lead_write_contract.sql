-- Request-scoped lead status mutations.
-- leads.request_id belongs to customer intake; admin request IDs live in this
-- dedicated audit table so the two idempotency domains cannot collide.

ALTER TABLE leads
  ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0);

CREATE TABLE IF NOT EXISTS admin_lead_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE CHECK (length(request_id) = 36),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  actor_subject TEXT NOT NULL CHECK (length(actor_subject) BETWEEN 1 AND 255),
  action TEXT NOT NULL CHECK (action = 'update'),
  entity_type TEXT NOT NULL CHECK (entity_type = 'lead'),
  entity_key TEXT NOT NULL CHECK (length(entity_key) = 36),
  previous_status TEXT NOT NULL CHECK (previous_status IN (
    'new', 'qualified', 'contacted', 'quotation_sent', 'sampling',
    'negotiation', 'won', 'lost', 'spam'
  )),
  previous_revision INTEGER NOT NULL CHECK (previous_revision > 0),
  resulting_revision INTEGER NOT NULL CHECK (resulting_revision = previous_revision + 1),
  payload_sha256 TEXT NOT NULL CHECK (
    length(payload_sha256) = 64
    AND payload_sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  status TEXT NOT NULL CHECK (status IN (
    'new', 'qualified', 'contacted', 'quotation_sent', 'sampling',
    'negotiation', 'won', 'lost', 'spam'
  ))
);

CREATE INDEX IF NOT EXISTS idx_admin_lead_audit_entity
  ON admin_lead_audit(entity_key, id DESC);

CREATE INDEX IF NOT EXISTS idx_admin_lead_audit_actor
  ON admin_lead_audit(actor_subject, id DESC);
