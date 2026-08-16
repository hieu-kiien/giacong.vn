-- Structured CMS settings for brand, SEO, homepage messaging and contact details.
-- Public rendering reads published_value only; admins edit draft_value first.

CREATE TABLE IF NOT EXISTS site_settings (
  setting_key TEXT PRIMARY KEY,
  group_name TEXT NOT NULL CHECK (group_name IN ('brand', 'seo', 'contact', 'home', 'footer')),
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  value_type TEXT NOT NULL CHECK (value_type IN ('text', 'multiline', 'url', 'image', 'color')),
  draft_value TEXT NOT NULL DEFAULT '',
  published_value TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_by TEXT,
  published_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_site_settings_group ON site_settings(group_name, setting_key);

INSERT OR IGNORE INTO site_settings
  (setting_key, group_name, label, description, value_type, draft_value, published_value)
VALUES
  ('brand_name', 'brand', 'Tên thương hiệu', 'Tên hiển thị ở logo, tiêu đề và các điểm nhận diện.', 'text', 'Giacong.vn', 'Giacong.vn'),
  ('brand_tagline', 'brand', 'Khẩu hiệu thương hiệu', 'Dòng mô tả ngắn đi cùng logo.', 'text', 'Giải pháp gia công toàn diện', 'Giải pháp gia công toàn diện'),
  ('logo_url', 'brand', 'Logo sáng', 'URL ảnh logo PNG/SVG an toàn. Để trống để giữ logo capture hiện tại.', 'image', '', ''),
  ('favicon_url', 'brand', 'Favicon', 'URL favicon của website.', 'image', '', ''),
  ('primary_color', 'brand', 'Màu chủ đạo', 'Màu hex dùng cho các điểm nhấn chính.', 'color', '#6cbe45', '#6cbe45'),
  ('accent_color', 'brand', 'Màu nhấn', 'Màu hex dùng cho nền sáng, hover và nút phụ.', 'color', '#bde875', '#bde875'),
  ('site_title', 'seo', 'SEO title', 'Tiêu đề mặc định của website.', 'text', 'Giacong.vn - Giải pháp gia công toàn diện', 'Giacong.vn - Giải pháp gia công toàn diện'),
  ('site_description', 'seo', 'SEO description', 'Mô tả mặc định cho công cụ tìm kiếm và chia sẻ.', 'multiline', 'Giao diện giới thiệu dịch vụ gia công toàn diện.', 'Giao diện giới thiệu dịch vụ gia công toàn diện.'),
  ('contact_phone', 'contact', 'Hotline', 'Số điện thoại hiển thị ở các điểm liên hệ.', 'text', '0947142999', '0947142999'),
  ('contact_email', 'contact', 'Email tư vấn', 'Email hiển thị ở footer và form liên hệ.', 'text', 'info@giacong.vn', 'info@giacong.vn'),
  ('contact_zalo_url', 'contact', 'Link Zalo', 'Đường dẫn Zalo đầy đủ, bắt đầu bằng https://.', 'url', 'https://zalo.me/0947142999', 'https://zalo.me/0947142999'),
  ('contact_messenger_url', 'contact', 'Link Messenger', 'Đường dẫn Messenger đầy đủ, bắt đầu bằng https://.', 'url', 'https://m.me/qtudepdai', 'https://m.me/qtudepdai'),
  ('contact_address', 'contact', 'Địa chỉ', 'Địa chỉ văn phòng hiển thị ở footer.', 'multiline', 'VP Hà Nội: 108 Trần Hưng Đạo - Hoàn Kiếm - Hà Nội', 'VP Hà Nội: 108 Trần Hưng Đạo - Hoàn Kiếm - Hà Nội'),
  ('hero_eyebrow', 'home', 'Hero eyebrow', 'Dòng nhỏ phía trên tiêu đề trang chủ.', 'text', 'Giacong.vn cung cấp', 'Giacong.vn cung cấp'),
  ('hero_title', 'home', 'Hero title', 'Tiêu đề lớn nhất ở trang chủ.', 'text', 'Giải pháp gia công toàn diện chuyên nghiệp', 'Giải pháp gia công toàn diện chuyên nghiệp'),
  ('hero_description', 'home', 'Hero description', 'Đoạn giới thiệu chính ở trang chủ.', 'multiline', 'Chúng tôi cung cấp dịch vụ gia công (OEM) nông sản, thực phẩm và dược liệu toàn diện từ sản xuất đến thiết kế thương hiệu và đóng gói. Với đội ngũ chuyên gia giàu kinh nghiệm, chúng tôi cam kết mang đến cho bạn những sản phẩm chất lượng cao.', 'Chúng tôi cung cấp dịch vụ gia công (OEM) nông sản, thực phẩm và dược liệu toàn diện từ sản xuất đến thiết kế thương hiệu và đóng gói. Với đội ngũ chuyên gia giàu kinh nghiệm, chúng tôi cam kết mang đến cho bạn những sản phẩm chất lượng cao.'),
  ('hero_primary_cta_label', 'home', 'Nhãn nút chính', 'Nhãn nút kêu gọi hành động đầu tiên.', 'text', 'Về chúng tôi', 'Về chúng tôi'),
  ('hero_primary_cta_url', 'home', 'Link nút chính', 'URL nút kêu gọi hành động đầu tiên.', 'url', '/gioi-thieu-ve-gia-cong/', '/gioi-thieu-ve-gia-cong/'),
  ('hero_secondary_cta_label', 'home', 'Nhãn nút phụ', 'Nhãn nút kêu gọi hành động thứ hai.', 'text', 'Liên hệ ngay', 'Liên hệ ngay'),
  ('hero_secondary_cta_url', 'home', 'Link nút phụ', 'URL nút kêu gọi hành động thứ hai.', 'url', '/lien-he/', '/lien-he/'),
  ('hero_image_url', 'home', 'Ảnh hero', 'URL ảnh hero. Để trống để giữ ảnh capture hiện tại.', 'image', '', ''),
  ('about_title', 'home', 'Tiêu đề giới thiệu', 'Tiêu đề phần giới thiệu trên trang chủ.', 'text', 'Đồng hành cùng doanh nghiệp trong thời đại mới', 'Đồng hành cùng doanh nghiệp trong thời đại mới'),
  ('about_description', 'home', 'Mô tả giới thiệu', 'Đoạn mô tả phần giới thiệu trên trang chủ.', 'multiline', 'Với đội ngũ chuyên gia giàu kinh nghiệm, hệ thống nhà xưởng hiện đại và quy trình sản xuất tối ưu, chúng tôi mang đến giải pháp gia công phù hợp cho doanh nghiệp.', 'Với đội ngũ chuyên gia giàu kinh nghiệm, hệ thống nhà xưởng hiện đại và quy trình sản xuất tối ưu, chúng tôi mang đến giải pháp gia công phù hợp cho doanh nghiệp.'),
  ('footer_description', 'footer', 'Mô tả footer', 'Đoạn giới thiệu ngắn ở footer.', 'multiline', 'Giacong.vn là nền tảng kết nối khách hàng và các đơn vị sản xuất, cung cấp giải pháp gia công toàn diện.', 'Giacong.vn là nền tảng kết nối khách hàng và các đơn vị sản xuất, cung cấp giải pháp gia công toàn diện.'),
  ('footer_copyright', 'footer', 'Bản quyền footer', 'Dòng bản quyền cuối trang.', 'text', 'Copyright 2026 © Giacong.vn | Một sản phẩm của Netmedia', 'Copyright 2026 © Giacong.vn | Một sản phẩm của Netmedia');