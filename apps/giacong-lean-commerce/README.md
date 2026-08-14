# Giacong.vn — Lean B2B Demo

Website giới thiệu và nhận yêu cầu B2B. Khách xem sản phẩm/dịch vụ, chọn quy cách và gửi yêu cầu; quản trị viên dùng Bagisto để quản lý catalog, giá, tồn kho và nội dung. Yêu cầu được ghi vào Google Sheet.

## Thành phần

- **Storefront:** Next.js 16; production target là **Cloudflare Workers qua OpenNext**.
- **Quản trị:** Bagisto — local mở qua cùng origin Next tại `http://localhost:4317/admin`; production giữ cùng public origin và proxy về Bagisto private origin.
- **Yêu cầu:** Google Sheet + Apps Script. Không có thanh toán, checkout hay tài khoản khách.

Kiến trúc production đã khóa tại [docs/CLOUDFLARE_DEPLOYMENT.md](./docs/CLOUDFLARE_DEPLOYMENT.md). Vercel không thuộc đường production của Lean V1.

## Chạy trên máy mới

Workspace hiện tại đặt ứng dụng ở `apps/giacong-lean-commerce`. Cần Git, Docker Desktop, Node.js 24 và Composer. Bagisto được chuẩn bị trước, sau đó chạy website. Hướng dẫn local chi tiết nằm trong [SETUP.md](./SETUP.md).

## Kiểm tra nhanh local

Sau khi chạy xong, mở:

- `http://localhost:4317/san-pham` — catalog khách hàng.
- `http://localhost:4317/gui-yeu-cau` — giỏ và form gửi yêu cầu.
- `http://localhost:4317/admin` — Bagisto Admin qua cùng origin.

## Kiểm tra ứng dụng

```powershell
npm run check
```

## Build/preview Cloudflare

```powershell
npm run cf:build
npm run cf:preview
```

Deploy chỉ thực hiện sau khi Cloudflare account và production vars/secrets đã được cấu hình:

```powershell
npm run cf:deploy
```

Không đưa `.env`, `.env.local`, `.dev.vars` hoặc secret Cloudflare/Google lên GitHub. Thông tin vận hành chi tiết: [docs/README.md](./docs/README.md).
