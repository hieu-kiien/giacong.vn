# Giacong.vn

Storefront B2B cho dịch vụ gia công và catalog sản phẩm. Khách có thể xem nội dung, chọn sản phẩm/quy cách, tạo request cart và gửi yêu cầu báo giá. Admin Cloudflare-native quản lý catalog, lead, media R2, nội dung, page, menu và quyền thành viên.

## Kiến trúc

- **Storefront/admin:** Next.js 16 App Router, React 19.
- **Runtime production:** Cloudflare Workers qua OpenNext.
- **Data:** Cloudflare D1; D1 là source of truth cho catalog, lead, audit log và CMS.
- **Media:** Cloudflare R2, metadata và checksum lưu trong D1.
- **Lead delivery:** Cloudflare Queues tới webhook/Google Apps Script sau khi D1 ghi thành công.
- **Admin security:** Cloudflare Access ở production; staging public mode chỉ được bật trên host allowlist.
- **Hostname chính:** `kienhieu.id.vn`; Giacong.vn là thương hiệu.

## Chạy và kiểm tra

Từ thư mục `apps/giacong-lean-commerce/`:

```bash
npm ci
npm run dev
npm run check
npm run cf:build
npm run qa:captured
npm run qa:catalog
npm run qa:services
```

Local storefront chạy qua workflow `artifacts/web: web`. Local admin có thể bị Access guard chặn; dùng staging host để kiểm tra CMS public demo.

## D1 migrations

```bash
npm run db:local:bootstrap
npx wrangler@4.115.0 d1 migrations apply giacong-vn-catalog --local
npx wrangler@4.115.0 d1 migrations apply giacong-vn-catalog-staging --remote --env staging
```

Local bootstrap chỉ tạo baseline schema catalog trống; không chứa dữ liệu production.
Migration mới phải được apply trước khi deploy code sử dụng bảng mới. Production migration cần được thực hiện có kiểm soát trong quy trình publish.

## CMS nội dung & thương hiệu

Mở `/admin/noi-dung` để chỉnh sửa:

- logo, favicon, ảnh hero và màu thương hiệu;
- SEO title/description;
- hero, CTA, phần giới thiệu;
- hotline, email, Zalo, Messenger, địa chỉ;
- nội dung footer.

CMS dùng typed settings, draft/published tách biệt, optimistic versioning, audit log và R2 upload cho ảnh. Public storefront tuyệt đối chỉ đọc `published_value`.

## Admin control plane

- `/admin/thiet-ke`: page builder schema an toàn cho hero, rich text, image, feature grid, CTA và contact;
- `/admin/dieu-huong`: primary navigation desktop/mobile, draft/publish và optimistic versioning;
- `/admin/thanh-vien`: owner-only member/role management với `owner`, `content_manager`, `catalog_manager`, `sales_manager`, `viewer`;
- mọi API admin đều kiểm tra Cloudflare Access admission, capability server-side, validation và audit log.

Migration `0009_admin_control_plane.sql` phải được apply vào môi trường trước khi dùng ba màn hình mới. Page builder không chạy HTML/CSS/JavaScript tùy ý; thay đổi schema hoặc logic mới vẫn cần code review.

Không đưa `.env`, `.env.local`, `.dev.vars` hoặc secret Cloudflare/Google lên GitHub. Kiến trúc vận hành chi tiết nằm trong thư mục `docs/`.

Lộ trình admin visual và bản đồ file cần đọc trước khi bắt đầu thay đổi admin:

- [`docs/ADMIN_VISUAL_ROADMAP.md`](docs/ADMIN_VISUAL_ROADMAP.md)
- [`docs/ADMIN_VISUAL_FILE_MAP.md`](docs/ADMIN_VISUAL_FILE_MAP.md)
