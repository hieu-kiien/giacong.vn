# Giacong.vn — Lean B2B Demo

Giacong.vn là website giới thiệu sản phẩm, dịch vụ và tiếp nhận yêu cầu báo giá B2B. Phiên bản này ưu tiên luồng phù hợp với đơn hàng gia công: khách xem sản phẩm, chọn quy cách/số lượng dự kiến, thêm vào giỏ báo giá và gửi yêu cầu để đội ngũ kinh doanh tư vấn.

Đây không phải website bán lẻ: không có thanh toán trực tuyến hay checkout. Mục tiêu là có một bản demo rõ ràng, có dữ liệu sản phẩm được quản lý tập trung và sẵn sàng mở rộng theo nhu cầu thực tế.

## Hướng triển khai

Hai phần của hệ thống nằm trong cùng một repository và sử dụng chung dữ liệu sản phẩm:

- **Website khách hàng:** Next.js cung cấp giao diện thương hiệu, danh mục, giỏ báo giá và form gửi yêu cầu.
- **Quản trị tập trung:** Bagisto/Laravel quản lý sản phẩm, biến thể, ảnh, SKU, giá và tồn kho. Đây là giao diện quản trị duy nhất.
- **Tiếp nhận yêu cầu:** Google Sheet + Apps Script là hàng đợi đơn giản cho đội ngũ kinh doanh trong giai đoạn đầu.

Cách tổ chức này tránh việc phải nhập sản phẩm ở nhiều nơi: dữ liệu được quản lý tại Bagisto và website sử dụng dữ liệu đó để hiển thị cho khách.

## Phạm vi demo

- Xem, tìm kiếm và lọc sản phẩm.
- Xem thông tin quy cách, giá tham khảo và tồn kho.
- Thêm nhiều sản phẩm vào giỏ báo giá.
- Gửi thông tin khách hàng, sản phẩm và số lượng dự kiến.
- Quản lý catalog trực tiếp trong Bagisto Admin.

Các phần như thanh toán, tài khoản khách hàng, checkout và quy trình đơn hàng đầy đủ chưa thuộc phạm vi V1. Hệ thống có thể mở rộng dần sang CRM, email thông báo, quản lý báo giá và đơn hàng B2B mà không cần làm lại cấu trúc chính.

## Thành phần

- **Storefront:** Next.js — giao diện khách xem tại `http://localhost:4317`.
- **Quản trị:** Bagisto — mở qua `http://localhost:4317/admin`.
- **Yêu cầu:** Google Sheet + Apps Script. Không có thanh toán, checkout hay tài khoản khách.

## Chạy trên máy mới

Cần Git, Docker Desktop và Node.js 24. Bagisto chạy trong Docker nên không cần cài PHP hoặc Composer trên máy. Chỉ cần tải một repository:

```powershell
git clone https://github.com/hieu-kiien/giacong.vn.git
```

Bagisto nằm trong thư mục `bagisto/` của repository này. Thiết lập Bagisto trước, sau đó thiết lập website. Hướng dẫn từng lệnh nằm trong [SETUP.md](./SETUP.md).

## Kiểm tra nhanh

Sau khi chạy xong, mở:

- `http://localhost:4317/san-pham` — catalog khách hàng.
- `http://localhost:4317/gui-yeu-cau` — giỏ và form gửi yêu cầu.
- `http://localhost:4317/admin` — Bagisto Admin.

## Trước khi bàn giao/triển khai

```powershell
npm run check
```

Không đưa file `.env` hoặc `.env.local` lên GitHub. Thông tin vận hành chi tiết: [docs/README.md](./docs/README.md).
