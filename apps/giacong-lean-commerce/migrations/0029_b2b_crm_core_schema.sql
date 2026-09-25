-- ==============================================================================
-- Migration: 0029_b2b_crm_core_schema.sql
-- Module: Enterprise B2B Manufacturing Customer Relationship Management (CRM)
-- Platform: Cloudflare D1 / SQLite Dialect
-- ==============================================================================

PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------------------------
-- 1. Table: crm_customers (Enterprise Account Master Record)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_customers (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  code TEXT NOT NULL UNIQUE CHECK (length(code) BETWEEN 3 AND 32),
  company_name TEXT NOT NULL CHECK (length(company_name) BETWEEN 2 AND 255),
  short_name TEXT CHECK (short_name IS NULL OR length(short_name) BETWEEN 1 AND 64),
  tax_code TEXT UNIQUE CHECK (tax_code IS NULL OR length(tax_code) BETWEEN 8 AND 20),
  industry TEXT NOT NULL CHECK (industry IN (
    'mechanical_cnc', 'sheet_metal', 'plastic_injection', 'casting_forging',
    'apparel_textile', 'packaging_carton', 'electronics_pcba', 'wood_furniture',
    'automation_jigs', 'other'
  )),
  tier TEXT NOT NULL DEFAULT 'standard' CHECK (tier IN ('vip', 'strategic', 'potential', 'standard', 'dormant')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('prospect', 'active', 'inactive', 'blacklisted', 'suspended')),
  credit_status TEXT NOT NULL DEFAULT 'good' CHECK (credit_status IN ('prepaid_only', 'good', 'warning', 'bad_debt', 'frozen')),
  credit_limit REAL NOT NULL DEFAULT 0.0 CHECK (credit_limit >= 0.0),
  credit_term_days INTEGER NOT NULL DEFAULT 0 CHECK (credit_term_days >= 0),
  
  headquarters_address TEXT,
  factory_address TEXT,
  city TEXT,
  country TEXT NOT NULL DEFAULT 'VN',
  website TEXT,
  phone TEXT,
  email TEXT,
  
  assigned_manager_id TEXT,
  source_lead_id TEXT,
  acquisition_channel TEXT NOT NULL DEFAULT 'inbound_web' CHECK (acquisition_channel IN (
    'inbound_web', 'zalo_oa', 'hotline', 'trade_show', 'referral', 'outbound_hunting', 'bidding_platform'
  )),
  
  required_certifications_json TEXT NOT NULL DEFAULT '[]',
  internal_notes TEXT,
  
  total_rfq_count INTEGER NOT NULL DEFAULT 0 CHECK (total_rfq_count >= 0),
  total_quote_count INTEGER NOT NULL DEFAULT 0 CHECK (total_quote_count >= 0),
  total_won_orders_count INTEGER NOT NULL DEFAULT 0 CHECK (total_won_orders_count >= 0),
  total_won_value REAL NOT NULL DEFAULT 0.0 CHECK (total_won_value >= 0.0),
  last_interaction_at TEXT,
  last_order_at TEXT,
  
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  
  FOREIGN KEY (assigned_manager_id) REFERENCES admin_members(id) ON DELETE SET NULL,
  FOREIGN KEY (source_lead_id) REFERENCES leads(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_customers_code ON crm_customers(code);
CREATE INDEX IF NOT EXISTS idx_crm_customers_industry ON crm_customers(industry);
CREATE INDEX IF NOT EXISTS idx_crm_customers_tier ON crm_customers(tier);
CREATE INDEX IF NOT EXISTS idx_crm_customers_status ON crm_customers(status);
CREATE INDEX IF NOT EXISTS idx_crm_customers_assigned_manager ON crm_customers(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_crm_customers_tax_code ON crm_customers(tax_code);
CREATE INDEX IF NOT EXISTS idx_crm_customers_last_interaction ON crm_customers(last_interaction_at DESC);

-- ------------------------------------------------------------------------------
-- 2. Table: crm_contacts (Multiple Contacts per Enterprise Account)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_contacts (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  customer_id TEXT NOT NULL,
  full_name TEXT NOT NULL CHECK (length(full_name) BETWEEN 2 AND 120),
  job_title TEXT CHECK (job_title IS NULL OR length(job_title) BETWEEN 1 AND 100),
  department TEXT NOT NULL DEFAULT 'procurement' CHECK (department IN (
    'procurement', 'engineering_rd', 'quality_assurance', 'production',
    'finance_accounting', 'executive_board', 'other'
  )),
  email TEXT CHECK (email IS NULL OR length(email) <= 254),
  phone TEXT CHECK (phone IS NULL OR length(phone) BETWEEN 7 AND 30),
  zalo_number TEXT CHECK (zalo_number IS NULL OR length(zalo_number) BETWEEN 7 AND 30),
  
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  is_decision_maker INTEGER NOT NULL DEFAULT 0 CHECK (is_decision_maker IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'left_company')),
  notes TEXT,
  
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  
  FOREIGN KEY (customer_id) REFERENCES crm_customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_crm_contacts_customer_id ON crm_contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_phone ON crm_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email ON crm_contacts(email);

-- ------------------------------------------------------------------------------
-- 3. Table: crm_timeline_events (Interaction History)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_timeline_events (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  customer_id TEXT NOT NULL,
  lead_id TEXT,
  quote_id TEXT,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'note_internal', 'call_outgoing', 'call_incoming', 'zalo_chat', 'email_sent',
    'meeting_client', 'technical_dfm_review', 'cad_drawing_uploaded', 'site_audit_visit',
    'sample_dispatched', 'quote_delivered', 'price_negotiation', 'contract_signed'
  )),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 2 AND 255),
  content TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  is_pinned INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1)),
  requires_followup INTEGER NOT NULL DEFAULT 0 CHECK (requires_followup IN (0, 1)),
  followup_due_at TEXT,
  followup_completed INTEGER NOT NULL DEFAULT 0 CHECK (followup_completed IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  
  FOREIGN KEY (customer_id) REFERENCES crm_customers(id) ON DELETE CASCADE,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
  FOREIGN KEY (author_id) REFERENCES admin_members(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_crm_timeline_events_customer ON crm_timeline_events(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_timeline_events_lead ON crm_timeline_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_timeline_events_followup ON crm_timeline_events(requires_followup, followup_completed, followup_due_at);

-- ------------------------------------------------------------------------------
-- 4. Table: crm_tags & crm_customer_tags (Dynamic Tagging)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_tags (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  name TEXT NOT NULL UNIQUE CHECK (length(name) BETWEEN 2 AND 50),
  color_hex TEXT NOT NULL DEFAULT '#64748b' CHECK (length(color_hex) = 7),
  category TEXT NOT NULL DEFAULT 'custom' CHECK (category IN (
    'lead_status', 'sales_priority', 'capability_match', 'risk_flag', 'custom'
  )),
  description TEXT
);

CREATE TABLE IF NOT EXISTS crm_customer_tags (
  customer_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (customer_id, tag_id),
  FOREIGN KEY (customer_id) REFERENCES crm_customers(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES crm_tags(id) ON DELETE CASCADE
);

-- Trigger: auto-update last_interaction_at on customer
CREATE TRIGGER IF NOT EXISTS trg_crm_timeline_after_insert
AFTER INSERT ON crm_timeline_events
BEGIN
  UPDATE crm_customers
  SET last_interaction_at = NEW.created_at,
      updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  WHERE id = NEW.customer_id;
END;
