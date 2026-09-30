ALTER TABLE leads
  ADD COLUMN customer_id TEXT REFERENCES "user"("id") ON DELETE SET NULL;

ALTER TABLE leads
  ADD COLUMN request_payload_sha256 TEXT;

CREATE INDEX IF NOT EXISTS idx_leads_customer_created
  ON leads(customer_id, created_at DESC);
