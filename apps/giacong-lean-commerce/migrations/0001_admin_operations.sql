-- Cloudflare D1 migration for the first Giacong.vn operations surface.
-- Existing catalog tables remain the source for the public read model.

CREATE TABLE IF NOT EXISTS admin_members (
  id TEXT PRIMARY KEY,
  access_subject TEXT NOT NULL UNIQUE,
  email TEXT,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('owner', 'content_manager', 'catalog_manager', 'sales_manager', 'viewer')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_members_email ON admin_members(email);
CREATE INDEX IF NOT EXISTS idx_admin_members_role ON admin_members(role);

CREATE TABLE IF NOT EXISTS product_admin_meta (
  product_id INTEGER PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'review', 'published', 'archived')),
  lead_time_days INTEGER,
  packaging_summary TEXT,
  specifications_json TEXT NOT NULL DEFAULT '{}',
  certifications_json TEXT NOT NULL DEFAULT '[]',
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS service_admin_meta (
  service_id INTEGER PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'review', 'published', 'archived')),
  lead_time_days INTEGER,
  moq_summary TEXT,
  capabilities_json TEXT NOT NULL DEFAULT '[]',
  process_steps_json TEXT NOT NULL DEFAULT '[]',
  certifications_json TEXT NOT NULL DEFAULT '[]',
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'qualified', 'contacted', 'quotation_sent', 'sampling', 'negotiation', 'won', 'lost', 'spam')),
  full_name TEXT NOT NULL,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  country TEXT,
  message TEXT,
  source TEXT NOT NULL DEFAULT 'request_form',
  delivery_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'queued', 'delivered', 'failed')),
  assigned_to TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_to) REFERENCES admin_members(id)
);

CREATE INDEX IF NOT EXISTS idx_leads_status_created ON leads(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_delivery_status ON leads(delivery_status);

CREATE TABLE IF NOT EXISTS lead_items (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  product_slug TEXT,
  service_slug TEXT,
  quantity INTEGER,
  unit TEXT,
  notes TEXT,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lead_items_lead ON lead_items(lead_id);

CREATE TABLE IF NOT EXISTS lead_events (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  actor_subject TEXT,
  event_type TEXT NOT NULL,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lead_events_lead_created ON lead_events(lead_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_subject TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_subject, created_at DESC);