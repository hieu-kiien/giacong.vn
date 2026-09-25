-- ==============================================================================
-- Migration: 0030_product_tech_specs_and_media.sql
-- Module: Product Gallery & Industrial B2B Technical Specifications Engine
-- Platform: Cloudflare D1 / SQLite Dialect
-- ==============================================================================

PRAGMA foreign_keys = ON;

-- 1. Table: product_gallery_images (Multi-image Gallery)
CREATE TABLE IF NOT EXISTS product_gallery_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL CHECK (length(image_url) > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_product_gallery_images_product ON product_gallery_images(product_id, sort_order ASC);

-- 2. Table: product_tech_specs (Industrial Manufacturing Technical Specifications)
CREATE TABLE IF NOT EXISTS product_tech_specs (
  product_id INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  material TEXT NOT NULL DEFAULT '',
  tolerance TEXT NOT NULL DEFAULT '',
  manufacturing_process TEXT NOT NULL DEFAULT '',
  surface_finish TEXT NOT NULL DEFAULT '',
  weight_grams REAL DEFAULT 0 CHECK (weight_grams >= 0),
  certifications_json TEXT NOT NULL DEFAULT '[]',
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_product_tech_specs_material ON product_tech_specs(material);
CREATE INDEX IF NOT EXISTS idx_product_tech_specs_process ON product_tech_specs(manufacturing_process);
