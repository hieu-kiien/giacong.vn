-- Nullable parent pointers extend the canonical navigation rows in place.
-- Existing top-level rows remain unchanged and readers keep legacy fallback behavior.
ALTER TABLE site_navigation_items ADD COLUMN draft_parent_id TEXT;
ALTER TABLE site_navigation_items ADD COLUMN published_parent_id TEXT;

CREATE INDEX IF NOT EXISTS idx_site_navigation_parent
  ON site_navigation_items(menu_key, draft_parent_id, draft_sort_order, id);
