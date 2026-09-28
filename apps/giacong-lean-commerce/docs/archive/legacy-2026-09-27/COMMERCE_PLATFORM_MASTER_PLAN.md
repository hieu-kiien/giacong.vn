# Hồ sơ lịch sử — Commerce Platform / Bagisto-era

> Tài liệu này được giữ lại để truy nguyên quyết định và migration cũ. Nó không còn là nguồn quyết định của dự án. Nếu nội dung bên dưới hoặc trong lịch sử Git khác với runtime hiện tại, hãy dùng [`CLOUDFLARE_NATIVE_V1_PLAN.md`](./CLOUDFLARE_NATIVE_V1_PLAN.md) và [`CLOUDFLARE_ADMIN_WRITE_CONTRACT.md`](./CLOUDFLARE_ADMIN_WRITE_CONTRACT.md).

## Trạng thái hiện tại

Kiến trúc được duyệt hiện nay là Cloudflare-native Lean V1:

- Next.js/OpenNext Worker phục vụ storefront và admin;
- Cloudflare D1 là nguồn dữ liệu canonical cho catalog, dịch vụ managed copy, CMS và audit;
- Cloudflare R2 là nguồn media;
- Google Sheet + Apps Script vẫn là request queue;
- `bagisto/` là repository migration/lịch sử, không nằm trên runtime path và không được khôi phục làm commerce backend.

Admin hiện tại là control plane Next.js tại `/admin`, có server-side API, draft/published workflow, optimistic versioning, audit log và granular RBAC. Các vai trò là `owner`, `content_manager`, `catalog_manager`, `sales_manager`, `viewer`; member/role management chỉ dành cho `owner`.

## Phạm vi admin đã thay cho kế hoạch cũ

Admin Cloudflare-native quản lý các vùng được mô hình hóa trong contract:

- catalog: categories, products, variants, tier prices và media R2;
- services, news, site settings, SEO và thông tin liên hệ;
- page builder schema an toàn tại `/admin/thiet-ke` với hero, rich text, image, feature grid, CTA và contact;
- menu primary tại `/admin/dieu-huong`, gồm nhãn, href, thứ tự, active state và publish;
- thành viên/quyền tại `/admin/thanh-vien`;
- tất cả write path được guard theo capability, validate input và ghi audit.

Page builder không thực thi HTML/CSS/JavaScript tùy ý. Những thay đổi cần code, schema mới, integration hoặc layout captured chưa được mô hình hóa vẫn là công việc kỹ thuật có chủ ý; “toàn quyền nội dung” không có nghĩa là cấp quyền chạy code trên server.

## Vì sao tài liệu cũ gây nhầm

Các mệnh đề như “Bagisto Admin là bề mặt duy nhất”, “một administrator dùng chung”, “không granular RBAC”, “không có Next.js admin” và “không dùng page builder” mô tả một giai đoạn cũ. Chúng đã bị thay thế, không phải yêu cầu hiện hành. Không dùng chúng để đánh giá trạng thái hiện tại hoặc thiết kế tính năng mới.

## Tài liệu cần đọc

1. [`CLOUDFLARE_NATIVE_V1_PLAN.md`](./CLOUDFLARE_NATIVE_V1_PLAN.md) — quyết định sản phẩm, runtime và phạm vi.
2. [`CLOUDFLARE_ADMIN_WRITE_CONTRACT.md`](./CLOUDFLARE_ADMIN_WRITE_CONTRACT.md) — guard, input, versioning, error và audit cho admin write.
3. [`CLOUDFLARE_CURRENT_STATE.md`](./CLOUDFLARE_CURRENT_STATE.md) — bằng chứng runtime/deployment và các bước còn mở.
4. [`UI_CURRENT_MAP.md`](./UI_CURRENT_MAP.md) — bản đồ route hiện tại.

Lịch sử chi tiết của kế hoạch Bagisto-era vẫn nằm trong Git history của file này; không sao chép các quyết định cũ trở lại tài liệu hiện hành.
