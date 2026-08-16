CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  namespace TEXT NOT NULL CHECK (namespace IN ('product', 'variant', 'service')),
  product_id INTEGER,
  variant_id INTEGER,
  service_id INTEGER,
  storage_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  checksum_sha256 TEXT NOT NULL,
  alt_text TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'replaced', 'deleted', 'orphaned')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT,
  CHECK (
    (namespace = 'product' AND product_id IS NOT NULL AND variant_id IS NULL AND service_id IS NULL)
    OR (namespace = 'variant' AND product_id IS NOT NULL AND variant_id IS NOT NULL AND service_id IS NULL)
    OR (namespace = 'service' AND product_id IS NULL AND variant_id IS NULL AND service_id IS NOT NULL)
  ),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_media_assets_product ON media_assets(product_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_media_assets_variant ON media_assets(variant_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_media_assets_service ON media_assets(service_id, status, created_at);