# Chạy dự án trên máy mới

Yêu cầu: Node.js 24 trở lên và một Bagisto B2B API đang chạy tại `127.0.0.1:18001` (hoặc URL khác được khai báo trong `.env.local`).

```sh
npm install
cp .env.example .env.local
npm run dev
```

Trên PowerShell, thay lệnh `cp` bằng `Copy-Item .env.example .env.local`.

## Cấu hình

- `BAGISTO_API_URL` là URL Bagisto, không thêm `/api` ở cuối.
- `GOOGLE_SHEETS_WEBHOOK_URL` và `GOOGLE_SHEETS_WEBHOOK_SECRET` chỉ cần khi gửi yêu cầu thật tới Google Sheet.
- Không commit `.env.local` hoặc secret webhook.

## Luồng duyệt

Mở `/san-pham`, thêm sản phẩm có một quy cách trực tiếp từ card hoặc chọn quy cách ở trang chi tiết. Giỏ preview chỉ lưu `parentSlug`, `variantSku` và số lượng trong trình duyệt; `/gui-yeu-cau` luôn đọc lại Bagisto để tính giá và xác thực MOQ/bước số lượng.

Chạy `npm run check` trước khi bàn giao. Dự án không có checkout, thanh toán hoặc tạo order Bagisto.
