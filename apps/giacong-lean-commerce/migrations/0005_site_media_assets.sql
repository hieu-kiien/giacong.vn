-- R2-backed media used by structured site settings such as logo and hero images.
CREATE TABLE IF NOT EXISTS site_media_assets (
  id TEXT PRIMARY KEY,
  setting_key TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  checksum_sha256 TEXT NOT NULL,
  alt_text TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'replaced', 'deleted')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  FOREIGN KEY (setting_key) REFERENCES site_settings(setting_key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_site_media_assets_setting
  ON site_media_assets(setting_key, status, created_at);