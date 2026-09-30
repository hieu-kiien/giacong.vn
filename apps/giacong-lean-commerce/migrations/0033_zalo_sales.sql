-- D1 is the canonical ledger for staff-confirmed Zalo sales.
-- A sale is inserted only after staff confirms the final items and prices.
CREATE TABLE IF NOT EXISTS zalo_sales (
  id TEXT PRIMARY KEY,
  sale_code TEXT NOT NULL UNIQUE,
  source_lead_id TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL,
  confirmed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_by TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'zalo' CHECK (channel = 'zalo'),
  currency TEXT NOT NULL DEFAULT 'VND' CHECK (currency = 'VND'),
  total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
  full_name TEXT NOT NULL,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  request_id TEXT NOT NULL UNIQUE,
  payload_sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_lead_id) REFERENCES leads(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_zalo_sales_customer_confirmed
  ON zalo_sales(customer_id, confirmed_at DESC);
CREATE INDEX IF NOT EXISTS idx_zalo_sales_confirmed
  ON zalo_sales(confirmed_at DESC);

CREATE TABLE IF NOT EXISTS zalo_sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  source_lead_item_id TEXT NOT NULL,
  product_slug TEXT,
  service_slug TEXT,
  product_name TEXT NOT NULL,
  variant_name TEXT,
  variant_sku TEXT,
  unit TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  line_total INTEGER NOT NULL CHECK (line_total >= 0),
  currency TEXT NOT NULL DEFAULT 'VND' CHECK (currency = 'VND'),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (sale_id, source_lead_item_id),
  FOREIGN KEY (sale_id) REFERENCES zalo_sales(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_zalo_sale_items_sale
  ON zalo_sale_items(sale_id);

-- The outbox remains pending until Apps Script confirms a durable upsert by ID.
CREATE TABLE IF NOT EXISTS google_sheet_sales_outbox (
  sale_id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('blocked_contract', 'pending', 'delivered', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivered_at TEXT,
  FOREIGN KEY (sale_id) REFERENCES zalo_sales(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_google_sheet_sales_outbox_status
  ON google_sheet_sales_outbox(status, updated_at);
