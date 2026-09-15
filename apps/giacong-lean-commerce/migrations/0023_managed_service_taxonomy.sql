-- Promote the source-owned thirteen-family taxonomy into the editable D1 service
-- table. The copy is already present in src/data/service-families.ts; this only
-- makes the same canonical names and descriptions available to the admin editor.
-- No operational MOQ, lead time, certification, or image is invented here.

INSERT OR IGNORE INTO services (slug, name, summary, description, is_active)
VALUES
  ('gia-cong-sot-cham', 'Gia công sốt chấm', 'Sốt chấm và sốt trộn theo công thức riêng.', 'Các dòng sốt chấm, sốt trộn và sốt salad gia công theo công thức và khẩu vị đặt hàng.', 1),
  ('gia-cong-do-uong', 'Gia công đồ uống', 'Nước uống, kem và đồ uống đông lạnh.', 'Nhóm đồ uống trải từ nước ép, nước bổ sung vi chất đến kem và sản phẩm đông lạnh.', 1),
  ('gia-cong-bot-pha-che', 'Gia công bột pha chế', 'Bột nền và bột pha chế cho quầy đồ uống.', 'Bột pha chế dùng cho quầy đồ uống và bếp bánh, đóng gói theo quy cách đặt hàng.', 1),
  ('gia-cong-duoc-lieu', 'Gia công dược liệu', 'Nhóm dược liệu — hiện chưa có trang dịch vụ riêng.', 'Nhóm dược liệu trong hệ thống dịch vụ. Trang nhóm trên site gốc hiện chưa có bài dịch vụ nào, nên hãy liên hệ để trao đổi yêu cầu cụ thể.', 1),
  ('gia-cong-thuc-pham', 'Gia công thực phẩm', 'Rau củ, gia vị và nguyên liệu thực phẩm sấy.', 'Gia công thực phẩm tập trung vào rau củ, gia vị và nguyên liệu qua xử lý sấy.', 1),
  ('gia-cong-my-pham', 'Gia công mỹ phẩm', 'Chăm sóc da, chăm sóc tóc và sản phẩm dưỡng thể.', 'Nhóm mỹ phẩm gồm sản phẩm chăm sóc da, chăm sóc tóc và dưỡng thể theo nhãn riêng.', 1),
  ('gia-cong-tra', 'Gia công trà', 'Trà thảo mộc, trà túi lọc và trà đóng chai.', 'Gia công trà từ nguyên liệu thảo mộc, đóng gói dạng túi lọc, hộp hoặc đóng chai.', 1),
  ('gia-cong-ca-phe', 'Gia công cà phê', 'Rang gia công, cà phê hòa tan và cà phê quà tặng.', 'Gia công cà phê từ rang theo yêu cầu đến cà phê hòa tan và dòng quà tặng.', 1),
  ('gia-cong-dong-goi', 'Gia công đóng gói', 'Đóng gói theo dạng thành phẩm và quy cách bao bì.', 'Dịch vụ đóng gói theo dạng thành phẩm: bột, lỏng, gel, viên, stick và bao bì công nghiệp.', 1),
  ('gia-cong-bot', 'Gia công bột', 'Bột dinh dưỡng, bột chức năng và bột nguyên liệu.', 'Gia công các dòng bột dinh dưỡng, bột chức năng và bột nguyên liệu theo công thức đặt hàng.', 1),
  ('gia-cong-ruou', 'Gia công rượu', 'Rượu ngâm, rượu pha và cocktail đóng sẵn.', 'Gia công rượu ngâm truyền thống, rượu pha hương và cocktail đóng sẵn theo nhãn riêng.', 1),
  ('gia-cong-sua', 'Gia công sữa', 'Sữa bột, sữa tươi, sữa chua và sữa thực vật.', 'Gia công sữa trải từ sữa bột và sữa tươi đến sữa chua, sữa hạt và sữa thực vật.', 1),
  ('say-thuc-pham-say', 'Sấy & thực phẩm sấy', 'Nhóm dịch vụ sấy theo nhiều phương pháp chế biến.', 'So sánh các hướng sấy để tìm phương pháp phù hợp với nguyên liệu và thành phẩm dự kiến.', 1);

INSERT OR IGNORE INTO service_admin_meta (service_id, status)
SELECT id, 'published'
FROM services
WHERE slug IN (
  'gia-cong-sot-cham', 'gia-cong-do-uong', 'gia-cong-bot-pha-che',
  'gia-cong-duoc-lieu', 'gia-cong-thuc-pham', 'gia-cong-my-pham',
  'gia-cong-tra', 'gia-cong-ca-phe', 'gia-cong-dong-goi', 'gia-cong-bot',
  'gia-cong-ruou', 'gia-cong-sua', 'say-thuc-pham-say'
);
