# 01. Product Requirements Document

## 1. Tầm nhìn
Giacong.vn là website B2B + B2C cho lĩnh vực gia công OEM/ODM thực phẩm, nông sản và dược liệu. Website mới phải thể hiện năng lực sản xuất chuyên nghiệp, tạo niềm tin, thu lead báo giá và hỗ trợ bán các sản phẩm mẫu/tiêu dùng.

## 2. Mục tiêu kinh doanh

### Mục tiêu chính
- Tăng số lượng yêu cầu báo giá đủ thông tin.
- Tăng tỷ lệ người dùng xem dịch vụ rồi chuyển sang liên hệ.
- Tạo hình ảnh thương hiệu đáng tin cậy, hiện đại và nhất quán.
- Cho phép quản trị cập nhật dịch vụ, sản phẩm, bài viết và nội dung trang mà không sửa code.

### Mục tiêu phụ
- Tạo kênh bán sản phẩm trực tuyến.
- Tăng organic traffic bằng nội dung kiến thức chuyên ngành.
- Hỗ trợ mở rộng song ngữ Việt/Anh trong tương lai.

## 3. Nhóm người dùng

### A. Chủ thương hiệu / startup sản phẩm
Nhu cầu: tìm đối tác gia công, hiểu MOQ, quy trình, chi phí, chứng nhận, thời gian ra mắt.
Hành động chính: gửi form báo giá, gọi hotline, chat Zalo.

### B. Doanh nghiệp đang có sản phẩm
Nhu cầu: mở rộng sản lượng, đổi nhà máy, phát triển SKU, tối ưu công thức/bao bì.
Hành động chính: xem năng lực, chứng nhận, case study, đặt lịch tư vấn.

### C. Nhà phân phối / đại lý / người mua lẻ
Nhu cầu: xem danh mục sản phẩm, giá, quy cách, tình trạng hàng.
Hành động chính: thêm giỏ, mua ngay hoặc yêu cầu báo giá số lượng lớn.

### D. Ứng viên / đối tác / báo chí
Nhu cầu: xác thực thông tin công ty, nhà máy, lịch sử, liên hệ.

## 4. Conversion goals
- CTA cấp 1: `Nhận báo giá`.
- CTA cấp 2: `Nhận tư vấn`, `Gọi ngay`, `Zalo chat ngay`.
- CTA e-commerce: `Mua ngay`, `Thêm vào giỏ`.
- CTA nội dung: `Xem chi tiết`, `Đọc bài viết`, `Xem tất cả`.

## 5. Phạm vi chức năng MVP

### Marketing site
- Trang chủ.
- Về Giacong.vn.
- Dịch vụ tổng quan và trang chi tiết dịch vụ.
- Tin tức danh sách và chi tiết.
- Liên hệ / nhận báo giá.
- Header, mega menu, mobile menu, footer.

### Catalog / commerce
- Danh sách sản phẩm có category, filter, search, sort và pagination.
- Chi tiết sản phẩm có gallery, giá bậc số lượng, tồn kho, thông tin kỹ thuật.
- Giỏ hàng local hoặc server-based.
- Checkout cơ bản hoặc nút chuyển sang quy trình báo giá tùy mô hình kinh doanh.
- Wishlist là tùy chọn sau MVP.

### CMS
- Sản phẩm, danh mục, dịch vụ, bài viết, trang tĩnh, FAQ, đối tác, chứng nhận, global settings.

### Lead form
- Validation client + server.
- Upload tệp tùy chọn.
- Gửi email/thông báo đến bộ phận kinh doanh.
- Lưu lead vào database hoặc CRM.
- Trang/thông báo thành công.

## 6. Ngoài phạm vi MVP
- ERP/kho đồng bộ realtime.
- Thanh toán online phức tạp, loyalty, voucher nâng cao.
- Portal đại lý.
- Cá nhân hóa theo tài khoản.
- Chatbot AI tự động tư vấn công thức.

## 7. Yêu cầu phi chức năng

### Hiệu năng
- LCP <= 2.5s p75 trên mobile production.
- CLS <= 0.1.
- INP <= 200ms.
- Ảnh hero không vượt 250-350 KB sau tối ưu ở viewport phổ biến.

### Accessibility
- WCAG 2.2 AA ở component chính.
- Điều hướng bàn phím hoàn chỉnh.
- Contrast text >= 4.5:1; text lớn >= 3:1.
- Dialog/menu có focus trap và ESC close.
- Form có label, error association, aria-live cho trạng thái gửi.

### SEO
- Semantic HTML, heading hierarchy một H1/trang.
- Metadata động, canonical, OpenGraph, Twitter card.
- Sitemap, robots, breadcrumb JSON-LD.
- Product, Article, Organization, WebSite, FAQ schema khi phù hợp.

### Bảo mật
- Server-side validation.
- Rate limit form.
- Honeypot hoặc CAPTCHA tùy mức spam.
- File upload giới hạn type/size và quét nếu production yêu cầu.
- CSP, secure headers và không lộ secret.

## 8. Ngôn ngữ và nội dung
- Ngôn ngữ mặc định: tiếng Việt.
- Chuẩn hóa chính tả: `Giacong.vn` trong câu, `GIACONG.VN` ở logo.
- Số liệu, chứng nhận, tên pháp nhân, địa chỉ, hotline và logo đối tác phải được chủ website xác nhận trước go-live.

## 9. KPI sản phẩm đề xuất
- Conversion form báo giá.
- Click hotline/Zalo.
- Tỷ lệ hoàn thành form.
- Organic sessions tới bài viết/dịch vụ.
- Add-to-cart và checkout initiation.
- Tốc độ trang và tỷ lệ thoát theo device.
