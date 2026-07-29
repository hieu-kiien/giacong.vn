# Giacong.vn — Lean B2B Demo

Website giới thiệu và nhận yêu cầu B2B. Khách xem sản phẩm/dịch vụ, chọn quy cách và gửi yêu cầu; quản trị viên dùng Bagisto để quản lý catalog, giá, tồn kho và nội dung. Yêu cầu được ghi vào Google Sheet.

## Thành phần

- **Storefront:** Next.js — giao diện khách xem tại `http://localhost:4317`.
- **Quản trị:** Bagisto — mở qua `http://localhost:4317/admin`.
- **Yêu cầu:** Google Sheet + Apps Script. Không có thanh toán, checkout hay tài khoản khách.

## Chạy trên máy mới

Cần Git, Docker Desktop, PHP 8.3 hoặc 8.4 cùng Composer 2, và Node.js 24. Chỉ cần tải một repository:

```powershell
git clone https://github.com/qtu1053-dev/giacong.vn.git
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
