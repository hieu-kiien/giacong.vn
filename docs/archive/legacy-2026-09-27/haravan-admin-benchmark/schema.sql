-- ==============================================================================
-- GIACONG.VN CLOUDFLARE D1 (SQLITE) B2B CRM SCHEMA SPECIFICATION
-- ==============================================================================
-- Module: Enterprise B2B Manufacturing Customer Relationship Management (CRM)
-- Target Platform: Cloudflare D1 / SQLite Dialect
-- Architecture: Cloudflare-Native Lean V1
-- Compatibility: SQLite 3.x, Next.js App Router, Atomic Batch Mutations
-- ==============================================================================

PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------------------------
-- 1. Table: crm_customers (Enterprise Account Master Record)
-- Represents manufacturing clients, brand owners, OEM/ODM procurement entities.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_customers (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  code TEXT NOT NULL UNIQUE CHECK (length(code) BETWEEN 3 AND 32), -- e.g. CUST-2026-0001
  company_name TEXT NOT NULL CHECK (length(company_name) BETWEEN 2 AND 255),
  short_name TEXT CHECK (short_name IS NULL OR length(short_name) BETWEEN 1 AND 64),
  tax_code TEXT UNIQUE CHECK (tax_code IS NULL OR length(tax_code) BETWEEN 8 AND 20),
  industry TEXT NOT NULL CHECK (industry IN (
    'mechanical_cnc',     -- Cơ khí chính xác & gia công CNC
    'sheet_metal',        -- Kim loại tấm & chấn dập
    'plastic_injection',  -- Đúc & ép nhựa kỹ thuật
    'casting_forging',    -- Đúc kim loại & rèn dập
    'apparel_textile',    -- May mặc & phụ liệu công nghiệp
    'packaging_carton',   -- Bao bì giấy, carton & màng phức hợp
    'electronics_pcba',   -- Lắp ráp bản mạch & điện tử
    'wood_furniture',     -- Gia công gỗ & nội thất
    'automation_jigs',    -- Đồ gá & tự động hóa nhà xưởng
    'other'               -- Ngành nghề khác
  )),
  tier TEXT NOT NULL DEFAULT 'standard' CHECK (tier IN ('vip', 'strategic', 'potential', 'standard', 'dormant')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('prospect', 'active', 'inactive', 'blacklisted', 'suspended')),
  credit_status TEXT NOT NULL DEFAULT 'good' CHECK (credit_status IN ('prepaid_only', 'good', 'warning', 'bad_debt', 'frozen')),
  credit_limit REAL NOT NULL DEFAULT 0.0 CHECK (credit_limit >= 0.0),
  credit_term_days INTEGER NOT NULL DEFAULT 0 CHECK (credit_term_days >= 0), -- e.g., 0 = COD/Prepay, 30 = Net 30
  
  -- Corporate Address & Contact Info
  headquarters_address TEXT,
  factory_address TEXT,
  city TEXT,
  country TEXT NOT NULL DEFAULT 'VN',
  website TEXT,
  phone TEXT,
  email TEXT,
  
  -- Account Management & Sourcing
  assigned_manager_id TEXT, -- References admin_members(id)
  source_lead_id TEXT,      -- References legacy/intake leads(id)
  acquisition_channel TEXT NOT NULL DEFAULT 'inbound_web' CHECK (acquisition_channel IN (
    'inbound_web', 'zalo_oa', 'hotline', 'trade_show', 'referral', 'outbound_hunting', 'bidding_platform'
  )),
  
  -- Manufacturing Context & Certifications Required
  required_certifications_json TEXT NOT NULL DEFAULT '[]', -- e.g. ["ISO 9001", "IATF 16949", "RoHS"]
  internal_notes TEXT,
  
  -- Aggregated Analytics Metrics (Updated asynchronously or via triggers)
  total_rfq_count INTEGER NOT NULL DEFAULT 0 CHECK (total_rfq_count >= 0),
  total_quote_count INTEGER NOT NULL DEFAULT 0 CHECK (total_quote_count >= 0),
  total_won_orders_count INTEGER NOT NULL DEFAULT 0 CHECK (total_won_orders_count >= 0),
  total_won_value REAL NOT NULL DEFAULT 0.0 CHECK (total_won_value >= 0.0),
  last_interaction_at TEXT,
  last_order_at TEXT,
  
  -- Concurrency Control & Audit Timestamps
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
CREATE INDEX IF NOT EXISTS idx_crm_customers_total_won_value ON crm_customers(total_won_value DESC);
CREATE INDEX IF NOT EXISTS idx_crm_customers_last_interaction ON crm_customers(last_interaction_at DESC);


-- ------------------------------------------------------------------------------
-- 2. Table: crm_contacts (Customer Multiple Contact Persons)
-- In B2B manufacturing, multiple personas participate: Procurement, Engineering, Finance, Plant Director.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_contacts (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  customer_id TEXT NOT NULL,
  full_name TEXT NOT NULL CHECK (length(full_name) BETWEEN 2 AND 120),
  job_title TEXT CHECK (job_title IS NULL OR length(job_title) BETWEEN 1 AND 100),
  department TEXT NOT NULL DEFAULT 'procurement' CHECK (department IN (
    'procurement',       -- Phòng mua hàng
    'engineering_rd',    -- Phòng kỹ thuật / R&D / Thiết kế khuôn mẫu
    'quality_assurance', -- Phòng QA/QC / Kiểm tra chất lượng
    'production',        -- Quản lý sản xuất / Giám đốc nhà máy
    'finance_accounting',-- Phòng kế toán / Tài chính
    'executive_board',   -- Ban giám đốc / Chủ doanh nghiệp
    'other'
  )),
  email TEXT CHECK (email IS NULL OR length(email) BETWEEN 5 AND 254),
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

CREATE INDEX IF NOT EXISTS idx_crm_contacts_customer ON crm_contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email ON crm_contacts(email);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_phone ON crm_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_is_primary ON crm_contacts(customer_id, is_primary);


-- ------------------------------------------------------------------------------
-- 3. Table: crm_tags (Taxonomy Master for Multi-Dimensional Labeling)
-- Categorizes accounts by Industry, Risk Profile, Priority, Capacity Needs.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_tags (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  name TEXT NOT NULL UNIQUE CHECK (length(name) BETWEEN 2 AND 60),
  slug TEXT NOT NULL UNIQUE CHECK (length(slug) BETWEEN 2 AND 60),
  category TEXT NOT NULL CHECK (category IN (
    'industry',      -- Ngành gia công (Cơ khí, Nhựa, Bao bì...)
    'tier',          -- Phân hạng giá trị (VIP, Strategic, Standard...)
    'risk',          -- Rủi ro (Chậm thanh toán, Thường đổi bản vẽ, Trả hàng...)
    'priority',      -- Độ ưu tiên xử lý (P0-Khẩn cấp, P1-Cao, P2-Bình thường)
    'process_type',  -- Loại công nghệ (Phay CNC 5 trục, Ép nhựa 500T, Cắt Laser fiber...)
    'custom'         -- Nhãn tùy biến người dùng
  )),
  color_hex TEXT NOT NULL DEFAULT '#6b7280' CHECK (color_hex GLOB '#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]'),
  description TEXT,
  is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_crm_tags_category ON crm_tags(category);
CREATE INDEX IF NOT EXISTS idx_crm_tags_slug ON crm_tags(slug);


-- ------------------------------------------------------------------------------
-- 4. Table: crm_customer_tag_assignments (Many-to-Many Customer Tagging)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_customer_tag_assignments (
  customer_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  assigned_by TEXT, -- References admin_members(id)
  assigned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  
  PRIMARY KEY (customer_id, tag_id),
  FOREIGN KEY (customer_id) REFERENCES crm_customers(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES crm_tags(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES admin_members(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_tag_assign_tag ON crm_customer_tag_assignments(tag_id);


-- ------------------------------------------------------------------------------
-- 5. Table: crm_segments (Smart Dynamic Segmentation Definitions)
-- Stores query condition criteria in JSON format to dynamically segment B2B accounts.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_segments (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 100),
  slug TEXT NOT NULL UNIQUE CHECK (length(slug) BETWEEN 2 AND 100),
  description TEXT,
  filter_rules_json TEXT NOT NULL DEFAULT '{}', -- Structured filter rules AST
  is_dynamic INTEGER NOT NULL DEFAULT 1 CHECK (is_dynamic IN (0, 1)), -- 1 = dynamic evaluated, 0 = manual snapshot
  cached_member_count INTEGER NOT NULL DEFAULT 0 CHECK (cached_member_count >= 0),
  last_evaluated_at TEXT,
  created_by TEXT, -- References admin_members(id)
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  
  FOREIGN KEY (created_by) REFERENCES admin_members(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_segments_slug ON crm_segments(slug);


-- ------------------------------------------------------------------------------
-- 6. Table: crm_quotes (B2B Manufacturing Quotations / Estimates)
-- Connects Customer, Contact, and Lead to a formal priced Quotation.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_quotes (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  quote_number TEXT NOT NULL UNIQUE CHECK (length(quote_number) BETWEEN 4 AND 32), -- e.g. BG-2026-0892
  customer_id TEXT NOT NULL,
  contact_id TEXT,
  lead_id TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',             -- Đang lập dự toán chi phí
    'engineering_review',-- Chờ phê duyệt kỹ thuật / DFM
    'sent',              -- Đã gửi báo giá tới khách
    'negotiating',       -- Đang thương thảo điều khoản & giá
    'sampling',          -- Khách đồng ý làm mẫu thử
    'sample_approved',   -- Mẫu thử đạt chuẩn kiểm tra (CMM/FAI)
    'accepted',          -- Khách chấp thuận báo giá & ký hợp đồng
    'rejected',          -- Khách từ chối báo giá
    'expired'            -- Báo giá hết hiệu lực (do biến động giá kim loại/hạt nhựa)
  )),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 2 AND 255),
  currency TEXT NOT NULL DEFAULT 'VND' CHECK (currency IN ('VND', 'USD', 'EUR', 'JPY')),
  subtotal_amount REAL NOT NULL DEFAULT 0.0 CHECK (subtotal_amount >= 0.0),
  tax_rate REAL NOT NULL DEFAULT 8.0 CHECK (tax_rate >= 0.0 AND tax_rate <= 100.0), -- VAT %
  tax_amount REAL NOT NULL DEFAULT 0.0 CHECK (tax_amount >= 0.0),
  total_amount REAL NOT NULL DEFAULT 0.0 CHECK (total_amount >= 0.0),
  
  -- Manufacturing Terms & Commercial Contracts
  payment_terms TEXT NOT NULL DEFAULT '30_50_20' CHECK (payment_terms IN (
    '100_prepay',   -- Thanh toán 100% trước khi sản xuất
    '50_50',        -- Tạm ứng 50%, 50% trước khi giao hàng
    '30_50_20',     -- Tạm ứng 30%, 50% trước giao hàng, 20% nghiệm thu Net 15
    'net_30',       -- Thanh toán sau 30 ngày kể từ ngày nhận hàng & hóa đơn VAT
    'net_60',       -- Thanh toán sau 60 ngày
    'letter_of_credit', -- L/C không hủy ngang
    'custom'        -- Thỏa thuận riêng trong hợp đồng
  )),
  delivery_terms TEXT NOT NULL DEFAULT 'ex_works' CHECK (delivery_terms IN (
    'ex_works', 'fob', 'cif', 'dap_factory', 'ddp'
  )),
  estimated_lead_time_days INTEGER NOT NULL DEFAULT 14 CHECK (estimated_lead_time_days > 0),
  valid_until TEXT NOT NULL, -- Quotation expiration ISO date string
  
  -- Technical & Tooling Attachments
  cad_file_url TEXT,
  dfm_report_url TEXT,
  terms_conditions TEXT,
  internal_margin_percent REAL CHECK (internal_margin_percent IS NULL OR internal_margin_percent BETWEEN -100.0 AND 100.0),
  
  assigned_sales_id TEXT, -- References admin_members(id)
  created_by TEXT,        -- References admin_members(id)
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  
  FOREIGN KEY (customer_id) REFERENCES crm_customers(id) ON DELETE RESTRICT,
  FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE SET NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_sales_id) REFERENCES admin_members(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES admin_members(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_quotes_customer ON crm_quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_quotes_status ON crm_quotes(status);
CREATE INDEX IF NOT EXISTS idx_crm_quotes_number ON crm_quotes(quote_number);
CREATE INDEX IF NOT EXISTS idx_crm_quotes_assigned_sales ON crm_quotes(assigned_sales_id);
CREATE INDEX IF NOT EXISTS idx_crm_quotes_valid_until ON crm_quotes(valid_until);


-- ------------------------------------------------------------------------------
-- 7. Table: crm_quote_items (Tiered Quantity Break & Engineering Specs)
-- Models complex manufacturing pricing with tiered brackets (e.g., 500, 2K, 10K pcs)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_quote_items (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  quote_id TEXT NOT NULL,
  line_number INTEGER NOT NULL CHECK (line_number > 0),
  part_name TEXT NOT NULL CHECK (length(part_name) BETWEEN 2 AND 255),
  part_code_sku TEXT CHECK (part_code_sku IS NULL OR length(part_code_sku) BETWEEN 1 AND 64),
  service_category TEXT CHECK (service_category IN (
    'cnc_milling', 'cnc_turning', 'sheet_metal_laser', 'injection_molding',
    'aluminum_die_casting', 'carton_box_offset', 'protective_workwear', 'surface_anodizing', 'other'
  )),
  material_grade TEXT,          -- e.g., 'Nhôm 6061-T6', 'Inox 304', 'Nhựa ABS chống cháy', 'Thùng carton 5 lớp'
  surface_finish TEXT,          -- e.g., 'Anodizing đen nhám', 'Sơn tĩnh điện cát', 'Xi mạ kẽm trắng'
  tolerance_standard TEXT,      -- e.g., 'ISO 2768-m', '±0.02mm'
  
  -- Tiered Volume Breakdown
  min_quantity INTEGER NOT NULL CHECK (min_quantity > 0),
  max_quantity INTEGER CHECK (max_quantity IS NULL OR max_quantity >= min_quantity),
  unit TEXT NOT NULL DEFAULT 'cái' CHECK (length(unit) BETWEEN 1 AND 30),
  
  -- Cost Components Breakdown
  unit_raw_material_cost REAL NOT NULL DEFAULT 0.0 CHECK (unit_raw_material_cost >= 0.0),
  unit_machining_cost REAL NOT NULL DEFAULT 0.0 CHECK (unit_machining_cost >= 0.0),
  unit_surface_treatment_cost REAL NOT NULL DEFAULT 0.0 CHECK (unit_surface_treatment_cost >= 0.0),
  unit_price REAL NOT NULL CHECK (unit_price >= 0.0),
  line_subtotal REAL NOT NULL CHECK (line_subtotal >= 0.0),
  
  -- Amortized One-time Tooling / Mold / Fixture Cost
  tooling_mold_cost REAL NOT NULL DEFAULT 0.0 CHECK (tooling_mold_cost >= 0.0),
  sample_production_days INTEGER NOT NULL DEFAULT 7 CHECK (sample_production_days > 0),
  mass_production_days INTEGER NOT NULL DEFAULT 14 CHECK (mass_production_days > 0),
  technical_notes TEXT,
  
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  
  UNIQUE (quote_id, line_number),
  FOREIGN KEY (quote_id) REFERENCES crm_quotes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_crm_quote_items_quote ON crm_quote_items(quote_id);


-- ------------------------------------------------------------------------------
-- 8. Table: crm_interactions (Interaction Timeline, Call Logs & Internal Notes)
-- Rich, append-only chronological history of every touchpoint in the B2B relationship.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_interactions (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  customer_id TEXT NOT NULL,
  contact_id TEXT,
  quote_id TEXT,
  lead_id TEXT,
  actor_id TEXT NOT NULL, -- References admin_members(id)
  
  event_type TEXT NOT NULL CHECK (event_type IN (
    'call_log',         -- Cuộc gọi trao đổi kỹ thuật / tư vấn
    'email_sent',       -- Email gửi bản vẽ, báo giá, tiến độ
    'email_received',   -- Email phản hồi từ khách
    'meeting_onsite',   -- Gặp mặt trực tiếp tại văn phòng/nhà máy khách
    'factory_audit',    -- Khách hàng đến tham quan, đánh giá nhà xưởng
    'internal_note',    -- Ghi chú nội bộ giữa sales & kỹ thuật
    'quote_sent',       -- Sự kiện gửi báo giá chính thức
    'status_change',    -- Thay đổi trạng thái tài khoản / đơn báo giá
    'sample_shipped',   -- Gửi mẫu sản phẩm thử nghiệm kèm mã vận đơn
    'sample_feedback',  -- Biên bản đánh giá mẫu thử nghiệm (Pass / Fail)
    'contract_signed',  -- Ký kết hợp đồng gia công / PO chính thức
    'payment_received', -- Xác nhận nhận tạm ứng / thanh toán công nợ
    'file_attached'     -- Tải lên tài liệu kỹ thuật / chứng chỉ CO/CQ
  )),
  
  channel TEXT NOT NULL DEFAULT 'phone' CHECK (channel IN (
    'phone', 'zalo', 'email', 'in_person', 'web_form', 'system_event', 'video_conference'
  )),
  
  summary TEXT NOT NULL CHECK (length(summary) BETWEEN 2 AND 255),
  details TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}', -- Stores rich attributes (e.g. call duration, CAD link, sample tracking number)
  
  -- Collaboration & Security
  is_pinned INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1)),
  visibility TEXT NOT NULL DEFAULT 'internal_only' CHECK (visibility IN (
    'internal_only',       -- Chỉ nội bộ công ty thấy (ghi chú biên lợi nhuận, chiến thuật đàm phán)
    'shared_with_customer' -- Khách hàng có thể xem trên Customer Portal sau này
  )),
  sales_mentions_json TEXT NOT NULL DEFAULT '[]', -- Array of admin_members(id) mentioned via @name
  
  interaction_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  
  FOREIGN KEY (customer_id) REFERENCES crm_customers(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE SET NULL,
  FOREIGN KEY (quote_id) REFERENCES crm_quotes(id) ON DELETE SET NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
  FOREIGN KEY (actor_id) REFERENCES admin_members(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_crm_interactions_customer ON crm_interactions(customer_id, interaction_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_interactions_quote ON crm_interactions(quote_id);
CREATE INDEX IF NOT EXISTS idx_crm_interactions_event_type ON crm_interactions(event_type);
CREATE INDEX IF NOT EXISTS idx_crm_interactions_pinned ON crm_interactions(customer_id, is_pinned);


-- ------------------------------------------------------------------------------
-- 9. Table: crm_sales_assignments (Account Handover & Ownership History)
-- Enforces traceability when accounts or leads are reassigned between reps.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_sales_assignments (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  customer_id TEXT NOT NULL,
  previous_manager_id TEXT,
  new_manager_id TEXT NOT NULL,
  transferred_by TEXT NOT NULL, -- References admin_members(id) (Admin/Manager who performed transfer)
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 5 AND 255),
  transferred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  
  FOREIGN KEY (customer_id) REFERENCES crm_customers(id) ON DELETE CASCADE,
  FOREIGN KEY (previous_manager_id) REFERENCES admin_members(id) ON DELETE SET NULL,
  FOREIGN KEY (new_manager_id) REFERENCES admin_members(id) ON DELETE RESTRICT,
  FOREIGN KEY (transferred_by) REFERENCES admin_members(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_crm_sales_assign_customer ON crm_sales_assignments(customer_id, transferred_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_sales_assign_new_mgr ON crm_sales_assignments(new_manager_id);


-- ------------------------------------------------------------------------------
-- 10. Table: crm_tasks_reminders (Follow-Up SLA Reminders & Task Queue)
-- Tracks sales follow-up commitments, DFM turnaround deadlines, quote validity warnings.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_tasks_reminders (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  customer_id TEXT NOT NULL,
  quote_id TEXT,
  assigned_to TEXT NOT NULL, -- References admin_members(id)
  
  task_type TEXT NOT NULL CHECK (task_type IN (
    'follow_up_call',     -- Gọi điện chăm sóc / hỏi thăm phản hồi
    'dfm_review_sla',     -- Đánh giá kỹ thuật hoàn tất trước hạn
    'quote_send_sla',     -- Gửi báo giá hoàn chỉnh cho khách trước hạn
    'quote_expiry_alert', -- Cảnh báo báo giá sắp hết hạn trong 48h
    'sample_delivery_check', -- Kiểm tra khách đã nhận mẫu thử nghiệm chưa
    'payment_follow_up',  -- Đôn đốc thanh toán công nợ đến hạn
    'contract_renewal',   -- Đàm phán gia hạn hợp đồng nguyên tắc năm
    'custom'              -- Việc cần làm tùy chọn
  )),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 200),
  description TEXT,
  
  due_date TEXT NOT NULL, -- ISO timestamp for deadline
  reminder_at TEXT,       -- ISO timestamp for notification alert
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'overdue')),
  completed_at TEXT,
  completed_note TEXT,
  
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  
  FOREIGN KEY (customer_id) REFERENCES crm_customers(id) ON DELETE CASCADE,
  FOREIGN KEY (quote_id) REFERENCES crm_quotes(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to) REFERENCES admin_members(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_crm_tasks_assigned_due ON crm_tasks_reminders(assigned_to, status, due_date ASC);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_customer ON crm_tasks_reminders(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_quote ON crm_tasks_reminders(quote_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_status ON crm_tasks_reminders(status);
