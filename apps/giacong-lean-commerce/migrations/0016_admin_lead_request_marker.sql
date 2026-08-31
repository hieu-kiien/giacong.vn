-- Request marker for race-safe lead status mutations.
-- The audit row is written in the same D1 batch and uses this marker so a
-- stale writer cannot append an audit/event after its UPDATE changed zero rows.

ALTER TABLE leads
  ADD COLUMN last_request_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_last_request_id
  ON leads(last_request_id)
  WHERE last_request_id IS NOT NULL;
