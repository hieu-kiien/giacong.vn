# Giacong.vn

Storefront B2B cho dịch vụ gia công và catalog sản phẩm. Khách có thể xem nội dung, chọn sản phẩm/quy cách, tạo request cart và gửi yêu cầu báo giá. Admin quản lý catalog, lead, media R2 và nội dung/branding website.

## Kiến trúc

- **Storefront/admin:** Next.js 16 App Router, React 19.
- **Runtime production:** Cloudflare Workers qua OpenNext.
- **Data:** Cloudflare D1; D1 là source of truth cho catalog, lead, audit log và CMS.
- **Media:** Cloudflare R2, metadata và checksum lưu trong D1.
- **Lead delivery:** Cloudflare Queues tới webhook/Google Apps Script sau khi D1 ghi thành công.
- **Admin security:** Cloudflare Access ở production; staging public mode chỉ được bật trên host allowlist.
- **Hostname chính:** `kienhieu.id.vn`; Giacong.vn là thương hiệu.

## Chạy và kiểm tra

Từ workspace root:

```bash
pnpm --filter @workspace/web run dev
pnpm --filter @workspace/web run check
pnpm --filter @workspace/web run cf:build
pnpm --filter @workspace/web run qa:captured
pnpm --filter @workspace/web run qa:catalog
pnpm --filter @workspace/web run qa:services
```

Local storefront chạy qua workflow `artifacts/web: web`. Local admin có thể bị Access guard chặn; dùng staging host để kiểm tra CMS public demo.

## D1 migrations

```bash
pnpm --filter @workspace/web exec wrangler d1 migrations apply giacong-vn-catalog --local
pnpm --filter @workspace/web exec wrangler d1 migrations apply giacong-vn-catalog-staging --remote --env staging
```

Migration mới phải được apply trước khi deploy code sử dụng bảng mới. Production migration cần được thực hiện có kiểm soát trong quy trình publish.

## CMS nội dung & thương hiệu

Mở `/admin/noi-dung` để chỉnh sửa:

- logo, favicon, ảnh hero và màu thương hiệu;
- SEO title/description;
- hero, CTA, phần giới thiệu;
- hotline, email, Zalo, Messenger, địa chỉ;
- nội dung footer.

CMS dùng typed settings, draft/published tách biệt, optimistic versioning, audit log và R2 upload cho ảnh. Public storefront tuyệt đối chỉ đọc `published_value`.

Không đưa `.env`, `.env.local`, `.dev.vars` hoặc secret Cloudflare/Google lên GitHub. Kiến trúc vận hành chi tiết nằm trong thư mục `docs/`.
