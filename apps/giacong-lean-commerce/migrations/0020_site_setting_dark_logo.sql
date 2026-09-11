-- Optional dark-header logo. Empty values intentionally fall back to logo_url.
INSERT OR IGNORE INTO site_settings
  (setting_key, group_name, label, description, value_type, draft_value, published_value)
VALUES
  ('logo_dark_url', 'brand', 'Logo tối', 'URL ảnh logo dùng ở header tối. Để trống để dùng Logo sáng.', 'image', '', '');
