# 02. Information Architecture & Routes

## 1. Route map

| Route | Trang | Loại render | Ghi chú |
|---|---|---|---|
| `/` | Trang chủ | Static/ISR | Landing chính |
| `/ve-giacong-vn` | Giới thiệu | Static/ISR | Câu chuyện, năng lực, chứng nhận |
| `/dich-vu` | Dịch vụ | Static/ISR | Tổng quan dịch vụ |
| `/dich-vu/[slug]` | Chi tiết dịch vụ | ISR | Theo CMS |
| `/san-pham` | Danh sách sản phẩm | SSR/ISR hybrid | Query filter/search/sort |
| `/san-pham/[slug]` | Chi tiết sản phẩm | ISR | Product schema |
| `/tin-tuc` | Tin tức | ISR | Category/search/pagination |
| `/tin-tuc/[slug]` | Chi tiết bài viết | ISR | Article schema |
| `/lien-he` | Liên hệ & báo giá | Static + server action | Form chính |
| `/gio-hang` | Giỏ hàng | Dynamic client | Có thể MVP phase 2 |
| `/thanh-toan` | Thanh toán | Dynamic | Nếu bán trực tiếp |
| `/chinh-sach-bao-mat` | Chính sách | Static | Pháp lý |
| `/dieu-khoan-su-dung` | Điều khoản | Static | Pháp lý |
| `/chinh-sach-doi-tra` | Đổi trả | Static | Commerce |
| `/chinh-sach-giao-hang` | Giao hàng | Static | Commerce |

## 2. Header desktop

Thứ tự trái sang phải:
1. Logo.
2. Trang chủ.
3. Về Giacong.vn.
4. Sản phẩm - mở mega menu.
5. Dịch vụ - dropdown/mega menu.
6. Tin tức.
7. Liên hệ.
8. Hotline.
9. CTA `Nhận báo giá`.
10. Tài khoản và giỏ hàng chỉ hiển thị nếu commerce bật.

### Sticky behavior
- Ở đầu trang: nền trắng/transparent trắng, cao 80px.
- Sau scroll 64px: cao 68px, shadow nhẹ, blur background.
- Active item có underline xanh 2px hoặc nền xanh nhạt tùy ngữ cảnh.

## 3. Mega menu Sản phẩm

### Cột 1 - Danh mục chính
- Sữa bột.
- Sữa tươi.
- Sữa chua.
- Sữa thực vật.
- Đồ uống.
- Bột & ngũ cốc.
- Thực phẩm chức năng.
- Nguyên liệu khác.

### Cột 2 - Danh mục con
Hiển thị theo category đang hover/focus, mỗi item có icon/thumbnail nhỏ, tiêu đề, mô tả một dòng và chevron.

### Cột 3 - Sản phẩm nổi bật
Ba product cards rút gọn, có ảnh, tên, quy cách, giá, nút `Xem chi tiết` và `Mua ngay`.

### Dải cuối
- `Xem tất cả sản phẩm`.
- `Mua số lượng lớn? Nhận ưu đãi doanh nghiệp` + CTA báo giá.

### Interaction
- Mở khi click hoặc hover có chủ đích; delay 80-120ms để tránh nhấp nháy.
- Focusable bằng keyboard; ESC đóng; click ngoài đóng.
- Animate opacity + y 8px trong 180-220ms.

## 4. Mega menu Dịch vụ
- Gia công thực phẩm.
- Gia công đồ uống.
- Gia công dược liệu.
- Nghiên cứu & phát triển.
- Thiết kế & bao bì.
- Đăng ký công bố.
- Link `Xem toàn bộ dịch vụ` và CTA `Nhận tư vấn`.

## 5. Mobile navigation
- Header cao 64px: logo, hotline icon, cart, hamburger.
- Drawer từ phải, full-height, rộng min(88vw, 380px).
- Accordion cho Sản phẩm và Dịch vụ.
- CTA báo giá cố định ở cuối drawer.
- Overlay tối 35%; khóa scroll body.

## 6. Footer

### Cột thương hiệu
- Logo, mô tả 3-4 dòng, social.

### Cột link
- Về chúng tôi.
- Dịch vụ.
- Sản phẩm hoặc Hỗ trợ tùy viewport.
- Liên hệ.
- Newsletter.

### Footer bottom
- Copyright.
- Links pháp lý.
- Có thể thêm chứng nhận website nếu hợp lệ.

## 7. Breadcrumb
- Hiển thị ở trang cấp 2 trở xuống.
- Dùng `nav aria-label="Breadcrumb"` và danh sách có dấu `/` bằng CSS.
- Trên mobile cắt bớt middle items nếu quá dài.

## 8. URL/query cho product listing
- `?category=...`
- `?brand=...`
- `?minPrice=...&maxPrice=...`
- `?size=...`
- `?form=powder,liquid,capsule`
- `?feature=sugar-free,vegan`
- `?sort=best-selling|newest|price-asc|price-desc`
- `?q=...`
- `?page=...`

Filter phải đồng bộ URL để share link, back/forward hoạt động và SSR/SEO hợp lý.
