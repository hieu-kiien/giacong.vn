# 05. Page Specifications

## A. Trang chủ `/`
Tham chiếu: `references/new-design/01-home.png`.

### Section 1 - Header
Theo component spec. Header trắng, CTA xanh.

### Section 2 - Hero
- Eyebrow: `GIẢI PHÁP GIA CÔNG TOÀN DIỆN`.
- H1: `Gia công OEM thực phẩm, nông sản, dược liệu`.
- Highlight: `Chuẩn chất lượng - Vững thương hiệu`.
- Paragraph tối đa 3 dòng desktop.
- CTA: `Nhận tư vấn & báo giá`, `Khám phá dịch vụ`.
- Trust mini items: nhà máy, nguyên liệu, R&D, tư vấn.
- Bên phải collage 4 ảnh + badge 10+.
- Decorative leaves/blobs có motion nhẹ.

### Section 3 - Stats
10+, 500+, 1.000+, 50+, 99%. Số liệu phải qua CMS/config và xác nhận.

### Section 4 - Services
6 cards: thực phẩm, đồ uống, dược liệu, R&D, bao bì, công bố.

### Section 5 - Featured products
4 cards desktop, carousel hoặc grid. Có `Xem tất cả sản phẩm`.

### Section 6 - Process
4 bước trên homepage: tiếp nhận, nghiên cứu/báo giá, sản xuất/kiểm soát, đóng gói/giao hàng.

### Section 7 - Why us / certifications
4 lợi thế + hình chứng nhận. Không hiển thị chứng nhận chưa có tài liệu thật.

### Section 8 - Partners / trust
Logo carousel. Logo phải có quyền sử dụng và xác nhận quan hệ.

### Section 9 - Quote lead section
Ảnh packaging bên trái, form ngắn bên phải: name, phone, email, category, message.

### Section 10 - Footer

## B. Về Giacong.vn `/ve-giacong-vn`
Tham chiếu: `02-about.png`.

1. Hero: title, value proposition, factory image.
2. Câu chuyện công ty + ba milestone cards.
3. Stats strip.
4. Tầm nhìn, sứ mệnh, giá trị cốt lõi.
5. Năng lực: diện tích, dây chuyền, nhân sự, sản lượng, tiêu chuẩn.
6. Lĩnh vực gia công bằng image cards.
7. Nhà máy & công nghệ: feature list + gallery.
8. Chứng nhận và timeline phát triển.
9. Đối tác/khách hàng.
10. CTA hợp tác + footer.

Mobile: hero ảnh xuống dưới; timeline dọc; gallery swipe.

## C. Dịch vụ `/dich-vu`
Tham chiếu: `03-services.png`.

1. Hero dịch vụ với collage.
2. Grid 6 dịch vụ.
3. Lợi thế chọn Giacong.vn.
4. Quy trình 6 bước.
5. Ngành hàng phục vụ.
6. Stats.
7. FAQ accordion.
8. CTA xanh đậm.
9. Footer.

### Template `/dich-vu/[slug]`
- Breadcrumb.
- Hero theo dịch vụ.
- Vấn đề khách hàng.
- Phạm vi gia công / dạng sản phẩm.
- Năng lực và công nghệ.
- Quy trình.
- Tiêu chuẩn/chứng nhận.
- FAQ theo dịch vụ.
- Related services.
- Quote CTA.

## D. Danh sách sản phẩm `/san-pham`
Tham chiếu: `04-product-list.png`.

1. Header.
2. Hero nhỏ: H1 + product composition.
3. Category tabs.
4. Toolbar: result count, search, sort, grid/list view.
5. Desktop: filter sidebar + 4-column grid.
6. Product cards: ảnh, tag, tên, quy cách, giá, stock, stepper, cart, buy.
7. Bulk order strip.
8. Pagination.
9. Newsletter/quote CTA.
10. Footer.

### Behavior
- Search debounce 250-350ms hoặc submit explicit.
- URL query là nguồn state.
- Loading dùng skeleton, không blank.
- Empty state có nút xóa filter.
- Grid/list view lưu localStorage tùy chọn.

## E. Chi tiết sản phẩm `/san-pham/[slug]`
Tham chiếu: `05-product-detail.png`.

1. Breadcrumb.
2. Product gallery trái.
3. Product info phải: title, rating, price, summary, metadata, stock.
4. Trust/shipping panel.
5. Tier pricing.
6. Quantity + subtotal + actions.
7. Benefit icon strip.
8. Tabs: mô tả, thành phần, hướng dẫn, thông số, đánh giá.
9. Support card.
10. Related products.
11. Bulk quote CTA.
12. Footer.

### Sticky mobile purchase bar
Ở mobile, thanh bottom có giá + nút `Thêm vào giỏ`/`Mua ngay`, không che nội dung và hỗ trợ safe area.

## F. Tin tức `/tin-tuc`
Tham chiếu: `06-news.png`.

1. Hero + stats content.
2. Featured article.
3. Category chips.
4. Search + sort.
5. Main grid 3 columns + sidebar popular/tags/newsletter desktop.
6. Pagination.
7. CTA tư vấn.
8. Footer.

### Chi tiết `/tin-tuc/[slug]`
- Breadcrumb.
- H1, category, author, date, read time.
- Hero image.
- Table of contents sticky desktop.
- Rich text body.
- Inline CTA sau 30-50% bài.
- Tags/share.
- Related articles.
- Article JSON-LD.

## G. Liên hệ `/lien-he`
Tham chiếu: `07-contact.png`.

1. Hero liên hệ + collage.
2. Company information card.
3. Advanced quote form.
4. Four benefit cards.
5. Map.
6. FAQ + CTA.
7. Footer.

### Form rules
- Phone Việt Nam: normalize spaces/dots, validate 9-11 digits phù hợp business rule.
- Email optional/required tùy chính sách; trong thiết kế đề xuất required.
- File max 10MB, allowed PDF/DOC/DOCX/XLS/XLSX/JPG/PNG.
- Consent required.
- Success state phải cung cấp mã yêu cầu hoặc thông báo thời gian phản hồi.

## H. Trang system states
- `loading.tsx`: skeleton theo layout.
- `error.tsx`: thông báo thân thiện + retry.
- `not-found.tsx`: tìm kiếm, popular links, CTA.
- Maintenance/empty CMS fallback không được hiển thị lỗi kỹ thuật.
