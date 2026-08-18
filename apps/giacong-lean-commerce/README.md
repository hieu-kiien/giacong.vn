# Giacong.vn

Storefront B2B cho dịch vụ gia công và catalog sản phẩm. Khách có thể xem nội dung, chọn sản phẩm/quy cách, tạo request cart và gửi yêu cầu báo giá. Admin quản lý catalog, lead, media R2, News CMS và nội dung/branding website.

## Kiến trúc

- **Storefront/admin:** Next.js 16 App Router, React 19.
- **Runtime:** Cloudflare Workers qua OpenNext.
- **Data:** Cloudflare D1; D1 là source of truth cho catalog, CMS, lead và audit log.
- **Media:** Cloudflare R2; metadata/reference lifecycle được giữ trong D1.
- **Lead delivery:** Cloudflare Queues tới webhook/Google Apps Script sau khi D1 ghi bền vững thành công; Google Sheet là secondary operational sink.
- **Admin security:** Cloudflare Access kết hợp D1 membership/role authorization. Staging và production-like admin đều fail-closed; không dùng staging public demo.
- **Hostname chính:** `kienhieu.id.vn`; Giacong.vn là thương hiệu.

## Chạy local và kiểm tra

Từ thư mục ứng dụng:

```bash
cd apps/giacong-lean-commerce
npm ci
npm run dev
npm run check
npm run cf:build:staging
```

Public storefront có thể kiểm tra local. Admin local có thể bị admission guard chặn; `admin-staging.kienhieu.id.vn` là môi trường acceptance được bảo vệ cho Cloudflare Access + D1 membership.

Hướng dẫn đầy đủ nằm trong [`SETUP.md`](SETUP.md).

## D1 migrations

Local development:

```bash
npx wrangler d1 migrations apply GIACONG_VN_CATALOG --local
```

Staging migration được pipeline trên `master` apply trước khi deploy Worker staging. Production migration chỉ được thực hiện trong production acceptance/publish procedure có rollback plan; không tự apply production từ local.

## CMS nội dung & thương hiệu

Mở `/admin/noi-dung` để chỉnh sửa:

- logo, favicon, ảnh hero và màu thương hiệu;
- SEO title/description;
- hero, CTA, phần giới thiệu;
- hotline, email, Zalo, Messenger, địa chỉ;
- nội dung footer.

News CMS nằm ở `/admin/tin-tuc` và `/admin/chuyen-muc-tin-tuc`.

CMS dùng typed settings/data contracts, optimistic concurrency, audit log và R2 media lifecycle. Public storefront chỉ đọc dữ liệu đã published theo contract tương ứng.

## Tài liệu quyết định

- [`docs/CLOUDFLARE_NATIVE_V1_PLAN.md`](docs/CLOUDFLARE_NATIVE_V1_PLAN.md): kiến trúc và scope hiện hành.
- [`docs/CLOUDFLARE_CURRENT_STATE.md`](docs/CLOUDFLARE_CURRENT_STATE.md): bằng chứng source/runtime đã xác minh.
- [`docs/CLOUDFLARE_ADMIN_WRITE_CONTRACT.md`](docs/CLOUDFLARE_ADMIN_WRITE_CONTRACT.md): contract write/admin.

Không đưa `.env`, `.env.local`, `.dev.vars` hoặc secret Cloudflare/Google lên GitHub. Bagisto/PHP/VPS là legacy/reference, không phải commerce runtime hiện hành.
