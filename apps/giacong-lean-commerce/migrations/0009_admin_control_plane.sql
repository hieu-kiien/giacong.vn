-- Cloudflare-native admin control plane.
--
-- Draft/published values are kept separately so an operator can edit safely,
-- preview the result and publish only an explicit version. Page blocks are
-- structured JSON validated by src/lib/page-builder.ts; raw HTML/CSS/JS is not
-- part of this contract.

ALTER TABLE admin_members
  ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0);

CREATE TABLE IF NOT EXISTS site_pages (
  page_key TEXT PRIMARY KEY CHECK (
    length(page_key) BETWEEN 1 AND 80
    AND page_key NOT GLOB '*[^a-z0-9-]*'
  ),
  route_path TEXT NOT NULL UNIQUE CHECK (length(route_path) BETWEEN 1 AND 160 AND substr(route_path, 1, 1) = '/'),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 240),
  draft_enabled INTEGER NOT NULL DEFAULT 0 CHECK (draft_enabled IN (0, 1)),
  published_enabled INTEGER NOT NULL DEFAULT 0 CHECK (published_enabled IN (0, 1)),
  draft_blocks_json TEXT NOT NULL DEFAULT '[]',
  published_blocks_json TEXT NOT NULL DEFAULT '[]',
  draft_seo_title TEXT NOT NULL DEFAULT '',
  published_seo_title TEXT NOT NULL DEFAULT '',
  draft_seo_description TEXT NOT NULL DEFAULT '',
  published_seo_description TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_by TEXT,
  published_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_site_pages_route_enabled
  ON site_pages(route_path, published_enabled);

INSERT OR IGNORE INTO site_pages (page_key, route_path, title)
VALUES ('home', '/', 'Trang chủ');

CREATE TABLE IF NOT EXISTS site_navigation_items (
  id TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 100),
  menu_key TEXT NOT NULL CHECK (menu_key IN ('primary', 'footer')),
  captured_menu_id TEXT,
  draft_label TEXT NOT NULL CHECK (length(draft_label) BETWEEN 1 AND 120),
  draft_href TEXT NOT NULL CHECK (length(draft_href) BETWEEN 1 AND 500),
  draft_sort_order INTEGER NOT NULL DEFAULT 0 CHECK (draft_sort_order >= 0),
  draft_is_active INTEGER NOT NULL DEFAULT 1 CHECK (draft_is_active IN (0, 1)),
  published_label TEXT NOT NULL CHECK (length(published_label) BETWEEN 1 AND 120),
  published_href TEXT NOT NULL CHECK (length(published_href) BETWEEN 1 AND 500),
  published_sort_order INTEGER NOT NULL DEFAULT 0 CHECK (published_sort_order >= 0),
  published_is_active INTEGER NOT NULL DEFAULT 1 CHECK (published_is_active IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_by TEXT,
  published_at TEXT,
  UNIQUE (menu_key, captured_menu_id)
);

CREATE INDEX IF NOT EXISTS idx_site_navigation_published
  ON site_navigation_items(menu_key, published_is_active, published_sort_order, id);

INSERT OR IGNORE INTO site_navigation_items (
  id, menu_key, captured_menu_id,
  draft_label, draft_href, draft_sort_order, draft_is_active,
  published_label, published_href, published_sort_order, published_is_active
)
VALUES
  ('home', 'primary', 'menu-item-4618', 'Home', '/', 10, 1, 'Home', '/', 10, 1),
  ('about', 'primary', 'menu-item-5498', 'Về Giacong.vn', '/gioi-thieu-ve-gia-cong/', 20, 1, 'Về Giacong.vn', '/gioi-thieu-ve-gia-cong/', 20, 1),
  ('products', 'primary', 'menu-item-1742', 'Sản Phẩm', '/san-pham/', 30, 1, 'Sản Phẩm', '/san-pham/', 30, 1),
  ('services', 'primary', 'menu-item-5166', 'Dịch vụ', '/thue-gia-cong/', 40, 1, 'Dịch vụ', '/thue-gia-cong/', 40, 1),
  ('news', 'primary', 'menu-item-1541', 'Tin tức', '/tin-tuc/', 50, 1, 'Tin tức', '/tin-tuc/', 50, 1),
  ('contact', 'primary', 'menu-item-1542', 'Liên hệ', '/lien-he/', 60, 1, 'Liên hệ', '/lien-he/', 60, 1);
