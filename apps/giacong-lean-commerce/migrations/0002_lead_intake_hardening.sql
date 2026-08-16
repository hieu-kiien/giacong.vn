-- Make D1 the durable source for every request before any secondary delivery sink.
ALTER TABLE leads ADD COLUMN public_reference TEXT;
ALTER TABLE leads ADD COLUMN request_id TEXT;
ALTER TABLE leads ADD COLUMN payload_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE leads ADD COLUMN webhook_reference TEXT;
ALTER TABLE leads ADD COLUMN delivery_error TEXT;
ALTER TABLE leads ADD COLUMN delivered_at TEXT;
ALTER TABLE leads ADD COLUMN delivery_attempts INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_public_reference ON leads(public_reference);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_request_id ON leads(request_id);

ALTER TABLE lead_items ADD COLUMN variant_sku TEXT;
ALTER TABLE lead_items ADD COLUMN product_name TEXT;
ALTER TABLE lead_items ADD COLUMN variant_name TEXT;
ALTER TABLE lead_items ADD COLUMN unit_price REAL;
ALTER TABLE lead_items ADD COLUMN line_total REAL;
ALTER TABLE lead_items ADD COLUMN currency TEXT;
ALTER TABLE lead_items ADD COLUMN snapshot_json TEXT NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_lead_items_product ON lead_items(product_slug);
CREATE INDEX IF NOT EXISTS idx_lead_items_service ON lead_items(service_slug);