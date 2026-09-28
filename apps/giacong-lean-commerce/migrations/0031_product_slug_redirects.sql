-- Keep public product URLs working after a product receives a new slug.
CREATE TABLE IF NOT EXISTS product_slug_redirects (
  old_slug TEXT PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (length(trim(old_slug)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_product_slug_redirects_product_id
  ON product_slug_redirects(product_id);

CREATE TRIGGER IF NOT EXISTS preserve_product_slug_after_update
AFTER UPDATE OF slug ON products
WHEN OLD.slug <> NEW.slug
BEGIN
  INSERT INTO product_slug_redirects (old_slug, product_id)
  VALUES (OLD.slug, OLD.id)
  ON CONFLICT(old_slug) DO UPDATE SET product_id = excluded.product_id;

  DELETE FROM product_slug_redirects
  WHERE old_slug = NEW.slug;
END;

CREATE TRIGGER IF NOT EXISTS remove_product_redirect_for_new_canonical_slug
AFTER INSERT ON products
BEGIN
  DELETE FROM product_slug_redirects
  WHERE old_slug = NEW.slug;
END;
