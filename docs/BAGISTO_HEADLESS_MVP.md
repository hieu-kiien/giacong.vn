# Kế hoạch Bagisto headless MVP

## Mục tiêu đã chốt

Xây website tư vấn kết hợp bán sỉ cho doanh nghiệp. Khách không cần tài khoản, có thể xem sản phẩm, chọn số lượng lớn theo MOQ, nhận giá ưu đãi theo bậc, thêm vào giỏ và gửi yêu cầu đặt hàng. Website chưa thanh toán trực tuyến; nhân viên tiếp tục xác nhận và chốt đơn qua nền tảng tư vấn bên ngoài.

Bagisto là backend và nguồn dữ liệu chính. Next.js là storefront. Frontend chỉ gọi REST API/BFF, không truy cập MySQL trực tiếp.

## Hiện trạng đã kiểm tra

- Frontend dùng Next.js 16, React 19 và TypeScript; giao diện hiện có chủ yếu là storefront tĩnh.
- Bagisto/Laravel và MySQL đã có trong `bagisto/`; storefront chưa kết nối hoàn chỉnh với catalog, pricing và cart.
- Route Next.js `POST /api/contact` đang chuyển dữ liệu sang `POST /api/b2b/briefs` của package `Acme/B2b`.
- Chưa có luồng giỏ hàng bán sỉ hoàn chỉnh, quản trị yêu cầu đặt hàng, Google Sheet hoặc webhook sản xuất.
- B2B Suite, GraphQL và customer account không thuộc phạm vi MVP.
- Thư mục `bagisto/` hiện chưa được Git theo dõi; phải tạo baseline an toàn trước khi triển khai lớn.

## Phạm vi MVP

### Storefront

- Trang chủ, danh mục, tìm kiếm và chi tiết sản phẩm.
- MOQ, bước số lượng/quy cách đóng gói và giá theo bậc số lượng.
- Giỏ hàng bán sỉ; backend phải từ chối số lượng dưới MOQ và tự tính lại giá.
- Form thông tin doanh nghiệp/người liên hệ.
- Gửi `Yêu cầu đặt hàng` và nhận mã tham chiếu.
- Trang xác nhận với nút gọi điện, Zalo, Messenger và email.
- Blog và tin tức trên cùng một hệ thống nội dung.
- Chỉ tiếng Việt và VND trong MVP.

### Bagisto Admin

Chỉ có một tài khoản Admin:

- Quản lý sản phẩm, danh mục, trạng thái nhận đơn, MOQ và giá bậc.
- Xem yêu cầu đặt hàng và cập nhật một trong bốn trạng thái: `Mới nhận`, `Đang liên hệ`, `Đã chốt`, `Không thành công`.
- Viết, sửa, xuất bản bài blog hoặc tin tức.
- Quản lý SEO cơ bản và xem trạng thái đồng bộ Sheet/webhook.

### Dữ liệu yêu cầu đặt hàng

MVP dùng `wholesale_order_requests`, không tạo Bagisto Order hoàn chỉnh ngay khi khách gửi form. Dữ liệu tối thiểu gồm:

- Mã tham chiếu và trạng thái.
- Tên công ty, người liên hệ, điện thoại, email và ghi chú.
- Snapshot sản phẩm, đơn vị, số lượng, giá bậc và tổng tiền tạm tính.
- Nguồn/URL gửi yêu cầu.
- Trạng thái đồng bộ Google Sheet và webhook.

Chỉ chuyển sang Bagisto Order khi sau này website có quy trình xác nhận, thanh toán hoặc xử lý đơn trực tiếp.

### Nội dung và SEO

- Một bảng/module bài viết dùng trường `type = blog | news`; không xây hai CMS.
- Trường biên tập: tiêu đề, slug, nội dung, ảnh, chuyên mục, ngày xuất bản, SEO title, meta description và index/noindex.
- Hệ thống tự sinh canonical, Open Graph, sitemap, robots.txt, breadcrumb và JSON-LD phù hợp cho Organization, Product và Article/NewsArticle.
- Nội dung quan trọng phải là HTML có thể crawl, có liên kết nội bộ, thông tin sản phẩm rõ ràng và hiệu năng tốt.
- Không xây module “AI SEO”, không dùng meta keywords và không coi `llms.txt` là hạng mục MVP.

### Tích hợp

- Google Sheet chỉ là bản đồng bộ phục vụ bán hàng, không phải database nguồn.
- Gửi webhook bất đồng bộ, có retry, idempotency và log lỗi khi nền tảng tư vấn cung cấp endpoint thực tế.
- Không làm đồng bộ trạng thái hai chiều cho đến khi có tài liệu API và nhu cầu xác nhận.

## Ngoài phạm vi

- Đăng ký/đăng nhập và dashboard khách hàng.
- Nhiều Admin, vai trò nhân viên hoặc tài khoản công ty nhiều cấp.
- B2B Suite, GraphQL và plugin trả phí.
- RFQ/báo giá thành module riêng; giỏ hàng và yêu cầu đặt hàng đã bao phủ MVP.
- Upload brief/file OEM.
- Thanh toán, hóa đơn, vận chuyển và tồn kho thời gian thực.
- Giá riêng từng doanh nghiệp, wishlist, đánh giá, điểm thưởng và khuyến mãi phức tạp.
- WordPress, WooCommerce, CMS thứ hai hoặc SaaS bắt buộc.
- Google News chuyên biệt và cấu hình SEO nâng cao cho Admin.

## Kiến trúc tối thiểu

```text
Browser
  -> Next.js storefront/BFF
  -> Bagisto REST API + package riêng
  -> MySQL

Bagisto
  -> Google Sheet (một chiều)
  -> Webhook nền tảng tư vấn
```

- Tận dụng catalog và pricing có sẵn của Bagisto trước khi viết mới.
- Mở rộng bằng package riêng; không sửa Bagisto Core hoặc `vendor/`.
- API phải có validation, rate limiting, CORS, xử lý lỗi và không tin giá gửi từ frontend.
- Thông tin nhạy cảm và khóa API chỉ nằm trong biến môi trường backend.

### Git topology tạm thời

- `bagisto/` là repository local độc lập trên branch `codex/b2b-environment-baseline`; frontend root chưa theo dõi thư mục này.
- Chỉ chuyển sang Git submodule khi có fork URL được chốt, commit backend cần pin và quy trình clone/CI cho submodule; trước đó không `git add` nội dung `bagisto/` vào frontend.

## Thứ tự triển khai

1. **Baseline:** đưa Bagisto vào Git an toàn, ghi nhận migration/package hiện có và chạy lại frontend/backend trước khi sửa.
2. **Catalog:** kết nối sản phẩm/danh mục Bagisto với storefront; thêm MOQ, bước số lượng và giá bậc tối thiểu.
3. **Giỏ hàng:** xây cart bán sỉ và kiểm tra toàn bộ pricing/MOQ ở backend.
4. **Yêu cầu đặt hàng:** lưu snapshot, tạo mã tham chiếu, trang xác nhận và quản trị bốn trạng thái.
5. **Tích hợp:** đồng bộ Google Sheet; thêm webhook khi có endpoint thật.
6. **Nội dung:** một module blog/tin tức và các trang hiển thị trên Next.js.
7. **SEO và chất lượng:** metadata, structured data, sitemap, robots, accessibility, hiệu năng, bảo mật và xử lý lỗi.
8. **Kiểm thử/triển khai:** test unit/feature/API, build Next.js, kiểm thử trình duyệt và triển khai staging trước production.

## Tiêu chí hoàn thành MVP

- Khách có thể hoàn thành luồng từ xem sản phẩm đến nhận mã yêu cầu mà không đăng nhập.
- Không thể gửi số lượng dưới MOQ hoặc giả mạo giá bằng request phía client.
- Admin quản lý được catalog, nội dung và bốn trạng thái yêu cầu đặt hàng.
- Dữ liệu gốc nằm trong Bagisto; lỗi Sheet/webhook không làm mất yêu cầu.
- Frontend không truy cập database và không để lộ secret.
- Các trang sản phẩm/bài viết có metadata, canonical, sitemap và structured data hợp lệ.
- Lint, typecheck, build, test backend và các luồng trình duyệt chính đều đạt.

## Thông tin còn cần trước giai đoạn tích hợp

- Google Sheet mẫu và danh sách cột cần đồng bộ.
- Tên nền tảng tư vấn cùng tài liệu API/webhook.
- Quy tắc MOQ, bước số lượng và bảng giá mẫu của ít nhất ba sản phẩm.
- Xác nhận giá hiển thị công khai hay chỉ hiển thị “giá từ”.

Các thông tin này không chặn việc triển khai catalog, giỏ hàng, yêu cầu đặt hàng và module nội dung cơ bản.
