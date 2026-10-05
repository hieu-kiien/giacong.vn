-- Registration policy uses the existing audited draft/publish settings contract.
-- Delivery configuration remains mandatory in customer-auth.ts.
INSERT OR IGNORE INTO site_settings
  (setting_key, group_name, label, description, value_type, draft_value, published_value)
VALUES
  ('customer_email_registration', 'contact', 'Đăng ký tài khoản bằng email',
   'Cho phép tạo tài khoản email khi dịch vụ xác minh đã sẵn sàng. Không tắt Google hoặc đăng nhập tài khoản hiện có.',
   'text', 'on', 'on');
