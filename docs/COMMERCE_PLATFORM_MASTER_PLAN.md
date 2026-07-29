# Hồ sơ Lean V1 — Giacong.vn

**Trạng thái:** nguồn quyết định hiện hành duy nhất cho việc phát triển.

## Trạng thái triển khai

Mỗi hạng mục dùng các trạng thái sau, theo thứ tự. Không dùng cụm mơ hồ như “Cần làm” cho phần đã có mã nguồn.

| Trạng thái | Ý nghĩa |
| --- | --- |
| **Implemented** | Đã có trong mã nguồn/template |
| **Tested locally** | Đã kiểm tra trên máy phát triển |
| **Tested in CI** | Đã có kiểm tra tự động chạy trên CI |
| **Deployed staging** | Đã triển khai trên môi trường staging |
| **Live verified** | Đã kiểm tra với dịch vụ thật, dữ liệu thật hoặc deployment thật |
| **Accepted by owner** | Chủ dự án/khách đã xác nhận chấp nhận |

Nếu một hạng mục chưa đi qua bước tiếp theo, ghi rõ bước còn thiếu. Các mức không xuất hiện không được suy diễn là đã hoàn thành.

## 1. Mục tiêu

Giacong.vn là website B2B cho khách xem sản phẩm/dịch vụ và gửi yêu cầu tư vấn hoặc báo giá. Luồng chính là:

`Xem sản phẩm → chọn quy cách/số lượng → thêm giỏ yêu cầu → gửi form → theo dõi tại Google Sheet`.

Đây là demo B2B, không phải website bán lẻ.

## 2. Kiến trúc đã chốt

| Phần | Công nghệ | Trách nhiệm |
| --- | --- | --- |
| Website khách hàng | Next.js | Giao diện, catalog, dịch vụ, giỏ yêu cầu và form liên hệ |
| Quản trị | Bagisto/Laravel | Sản phẩm, biến thể, ảnh, SKU, giá, tồn kho và nội dung CMS |
| Hàng đợi yêu cầu | Google Sheet + Apps Script | Nhận, theo dõi và xử lý yêu cầu từ form |

Toàn bộ nằm trong một repository. Next.js là origin công khai; `/admin`, `/api/b2b` và asset Bagisto được proxy tới Bagisto nội bộ. Bagisto Admin là giao diện quản trị duy nhất, không tạo khu quản trị Next.js riêng.

## 3. Phạm vi V1

### Trạng thái demo

| Hạng mục | Trạng thái hiện tại | Bước còn thiếu |
| --- | --- | --- |
| Catalog đọc từ Bagisto; admin quản lý sản phẩm, biến thể, ảnh, SKU, giá, tồn kho và policy B2B | **Implemented · Tested locally** | Dữ liệu production được duyệt và owner chấp nhận |
| Trang sản phẩm: tìm kiếm, lọc, sắp xếp và chi tiết | **Implemented · Tested locally** | Owner chấp nhận nội dung/dữ liệu thật |
| Giỏ nhiều dòng tại `/gui-yeu-cau`; `localStorage`, route xác thực giỏ, JSON cart và snapshot token | **Implemented · Tested locally** | Kiểm tra end-to-end với Sheet thật và owner chấp nhận |
| Ghi yêu cầu và chi tiết giỏ vào Apps Script/Google Sheet | **Implemented · Tested locally** | **Live verified** bởi owner trên Sheet/Apps Script do khách kiểm soát |
| Dịch vụ mẫu và nội dung CMS đọc từ Bagisto | **Implemented · Tested locally** | Nội dung/media thật và owner chấp nhận |
| Runtime Docker Nginx + PHP-FPM; proxy qua `localhost:4317` | **Implemented · Tested locally** | Triển khai staging/production khi có hạ tầng |

### Không thuộc V1

- Thanh toán, checkout, shipping, Bagisto order hoặc quote engine.
- Tài khoản khách hàng, customer portal, phân quyền nhiều cấp hoặc admin Next.js.
- Giỏ hàng phía server, bảng cart hoặc đồng bộ giỏ giữa thiết bị.
- Rating, review, favorite, CRM bắt buộc, đa ngôn ngữ và đa tiền tệ.

## 4. Quy tắc dữ liệu

- **Bagisto** là nguồn dữ liệu catalog.
- **Google Sheet** là hàng đợi vận hành yêu cầu trong V1.
- Client không quyết định giá, tổng tiền, tồn kho hay loại yêu cầu; server xác thực lại bằng Bagisto.
- Không ghi trực tiếp vào bảng core của Bagisto.
- Dữ liệu `B2B-DEMO` chỉ dùng để demo. Taxonomy, SKU, ảnh, nội dung, giá và thông tin liên hệ thật phải được khách duyệt trước khi public.

## 5. Vận hành hiện tại

- Website: `http://localhost:4317`.
- Bagisto Admin: `http://localhost:4317/admin`.
- Bagisto nội bộ local: `http://localhost:18001`.
- Hướng dẫn cài/chạy: [SETUP.md](../SETUP.md).
- Hướng dẫn Google Sheet: [GOOGLE_SHEETS_CONTACT_WEBHOOK.md](./GOOGLE_SHEETS_CONTACT_WEBHOOK.md).

Sau khi Docker vừa khởi động, lần mở Bagisto đầu tiên có thể chậm do PHP nạp cache; các lần sau hoạt động bình thường.

## 6. Việc còn lại trước khi public

1. Dữ liệu production: taxonomy, sản phẩm, giá, ảnh, nội dung và thông tin liên hệ thật được **Accepted by owner**.
2. Google Sheet/Apps Script: khách sở hữu, chạy `setupRequestWorkbook()`, redeploy webhook và **Live verified** luồng form/giỏ.
3. Nội dung trang dịch vụ/doanh nghiệp được **Accepted by owner**.
4. Kịch bản bàn giao: xem sản phẩm → thêm giỏ → gửi yêu cầu → kiểm tra Sheet, sau đó **Accepted by owner**.

## 7. Hướng mở rộng sau V1

Khi có nhu cầu thật, có thể bổ sung CRM, email thông báo, quản lý báo giá và đơn hàng B2B. Mọi phần mở rộng phải giữ Bagisto là nguồn catalog và không làm thay đổi luồng demo hiện tại khi chưa được duyệt.

## 8. Quy tắc phát triển

- Giữ Next.js cho storefront và Bagisto cho quản trị.
- Không tạo lại `/quan-tri`, checkout hoặc các API quản trị riêng.
- Mọi thay đổi dữ liệu catalog đi qua Bagisto Admin/native API.
- Cập nhật tài liệu này khi thay đổi phạm vi, kiến trúc hoặc trạng thái bàn giao.
- Tài liệu lịch sử chỉ dùng để tham khảo, không được dùng làm nguồn quyết định.
