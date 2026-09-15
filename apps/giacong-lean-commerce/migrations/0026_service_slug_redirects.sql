-- Preserve public service-group URLs when an active service receives a new slug.
-- The target remains the canonical managed service row; redirects disappear from
-- public resolution while that target is inactive.
CREATE TABLE IF NOT EXISTS service_slug_redirects (
  old_slug TEXT PRIMARY KEY,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (length(trim(old_slug)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_service_slug_redirects_service_id
  ON service_slug_redirects(service_id);
