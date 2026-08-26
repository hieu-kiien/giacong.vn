# Cloudflare-native Lean V1 plan

**Trạng thái:** nguồn quyết định hiện hành cho Lean V1 kể từ 2026-08-14.

Tài liệu này thay thế `COMMERCE_PLATFORM_MASTER_PLAN.md` làm nguồn quyết định. Hồ sơ cũ được giữ lại để truy vết lịch sử thiết kế Bagisto nhưng không còn quyết định runtime, admin hoặc hạ tầng đích. `CLOUDFLARE_CURRENT_STATE.md` là hồ sơ bằng chứng triển khai và QA, không phải nơi mở rộng scope sản phẩm.

## 1. Mục tiêu V1

Lean V1 là storefront B2B cho phép khách:

- xem catalog nhiều danh mục và sản phẩm;
- chọn một biến thể hợp lệ, MOQ và bước số lượng;
- xem giá bậc VND do server tính;
- gom nhiều dòng vào guest request cart trong `localStorage`;
- gửi yêu cầu sản phẩm hoặc tư vấn dịch vụ;
- kết thúc trách nhiệm website khi request intake được chấp nhận.

Không có customer account, checkout, `/thanh-toan`, payment, shipping, Bagisto order, quote lifecycle, rating, review hoặc favorite.

## 2. Kiến trúc đích

Runtime đích là Cloudflare-native:

- Next.js/OpenNext Worker phục vụ storefront và API;
- Cloudflare D1 là nguồn dữ liệu canonical cho catalog, variant, tier price và managed service copy;
- Cloudflare R2 là nguồn media sản phẩm;
- R2 riêng phục vụ incremental cache của OpenNext;
- Google Sheet + Apps Script tiếp tục là request queue cho đến khi có quyết định khác được duyệt;
- không dùng VPS, Cloudflare Tunnel, PHP origin hoặc Bagisto làm commerce runtime.

Production và staging tách riêng resource. Dữ liệu demo staging không được copy ngầm sang production.

## 3. Catalog canonical contract

Schema hiện hành gồm:

- `categories`
- `products`
- `product_variants`
- `variant_tier_prices`
- `services`
- `d1_migrations`

Các invariant bắt buộc:

- slug và SKU duy nhất theo constraint hiện hành;
- MOQ > 0;
- quantity step > 0;
- contact threshold > 0 và phải nằm trên một quantity hợp lệ tính từ MOQ theo step;
- tier quantity > 0, duy nhất trên mỗi variant và phải nằm trên quantity hợp lệ;
- tier price > 0 và currency là VND;
- storefront chỉ dùng record active và trạng thái availability của variant;
- server là nguồn duy nhất tính unit price, subtotal, request type và price-on-request;
- client không được gửi tiền canonical để server tin lại.

Mọi write path quản trị phải validate các invariant trước khi ghi và không được tạo trạng thái mà read path hiện hành sẽ từ chối.

## 4. Guest request cart

Cart chỉ giữ ba key canonical trên client cho mỗi dòng:

- `parentSlug`
- `variantSku`
- `quantity`

Server re-read D1 cho mọi revalidation và submit. Các case tối thiểu phải được giữ trong regression gate: product/variant mất, unavailable, dưới MOQ, lệch step, tier boundary, price-on-request, cart drift và canonical money.

Không tạo server cart table hoặc session cart trong Lean V1.

## 5. Request intake

Google Sheet + Apps Script vẫn là queue vận hành hiện hành. Submit được server canonicalize trước khi gọi webhook. Cart drift phải trả snapshot mới và không gọi webhook.

Trước production acceptance phải xác minh trên tài khoản Google thật:

- ownership/quyền kiểm soát;
- Apps Script deployment và authorization;
- idempotency/request ID;
- schema 15 cột của `Yêu cầu`;
- `Chi tiết giỏ hàng`;
- validation/protection và workflow trạng thái;
- timeout/redirect allowlist hiện hành.

Nếu request inbox được chuyển sang D1 thì phải có quyết định riêng; không thay đổi queue ngầm định.

## 6. Cloudflare-native admin

Bagisto Admin không còn là bề mặt quản trị đích. Admin mới phải quản lý trực tiếp contract D1/R2 qua server-side API có kiểm soát, không cho trình duyệt truy cập binding D1/R2 trực tiếp.

### 6.1 Phạm vi V1 admin

Admin staging cần hỗ trợ theo thứ tự:

1. categories: xem, tạo, sửa, active, sort order;
2. products: xem, tạo, sửa, active, category, nội dung và image reference;
3. variants: SKU, option label, unit, MOQ, quantity step, contact threshold, availability, sort order và image reference;
4. tier prices: create/update/delete với validation quantity/price;
5. product media: upload R2, chọn media cho product/variant, xóa object chỉ khi không còn reference;
6. services: sửa managed copy trong D1.
7. website control plane: site settings, SEO, structured page sections, primary navigation và publish workflow;
8. owner control: quản lý member, role, active state và audit của tài khoản admin.

Page builder V1 dùng schema section an toàn gồm hero, rich text, image, feature grid, CTA và contact. Đây là quyền tự chủ với nội dung/layout đã được mô hình hóa; không cấp quyền chạy HTML/CSS/JavaScript tùy ý hoặc tự tạo server code từ admin.

Request queue vẫn ở Google Sheet trong pha này; không xây request inbox admin trước khi có quyết định riêng.

### 6.2 Ranh giới bảo mật

- Admin phải nằm sau một authentication boundary riêng trước khi bật write API.
- Staging dùng `admin-staging.kienhieu.id.vn`; production dự kiến dùng `admin.kienhieu.id.vn` sau acceptance.
- Public storefront hostname không được trở thành đường tắt tới admin write API.
- Không dùng credential D1/R2 phía client.
- Không log secret, token hoặc PII không cần thiết.
- V1 không có customer identity.
- Admin nội bộ dùng 5 role: `owner`, `content_manager`, `catalog_manager`, `sales_manager`, `viewer` (xem `AdminRole` trong `src/lib/admin-data.ts`). Quyết định này được chấp thuận ngày 2026-08-23 thay cho mệnh đề trước đây "một operator administrator, không granular RBAC" — permission matrix đã triển khai và được nhiều route sử dụng, nên được giữ lại làm mô hình vận hành chuẩn.

Cloudflare Access là phương án bảo vệ staging admin. Cấu hình Access self-hosted, allow policy và identity-provider state cho `admin-staging.kienhieu.id.vn` đã được audit qua Cloudflare API; Worker route staging cũng đã được khai báo trong Wrangler. Việc triển khai write API vẫn phải tự fail closed nếu request không đạt admission contract, không chỉ dựa vào việc hostname đã có Access.

### 6.3 Contract write và UI control plane

Contract chi tiết đã được khóa tại [`CLOUDFLARE_ADMIN_WRITE_CONTRACT.md`](CLOUDFLARE_ADMIN_WRITE_CONTRACT.md). Trước khi dựng màn hình CRUD, implementation phải tuân thủ và test các nhóm yêu cầu sau:

- input schema/size limits;
- hostname/Access admission và same-origin mutation;
- uniqueness conflict;
- optimistic concurrency/stale-write protection;
- validation cho MOQ/step/contact/tier;
- media content type/size/key/reference policy;
- canonical API response;
- error mapping không lộ nội bộ;
- auditability và request id/idempotency tối thiểu cho write operation.

UI admin hiện được xây trên contract server đã test xanh: `/admin/noi-dung`, `/admin/thiet-ke`, `/admin/dieu-huong` và `/admin/thanh-vien` dùng cùng admission, capability, versioning, error envelope và toast feedback. Migration `0009_admin_control_plane.sql` phải được apply vào từng môi trường trước khi bật các màn hình dùng bảng mới.

## 7. Staging gate

Staging là cổng bắt buộc cho mọi thay đổi Cloudflare-native:

1. `npm run check` xanh;
2. OpenNext build/package gate xanh;
3. version preview nếu thay runtime;
4. smoke test catalog/detail/cart/R2;
5. deep QA search/filter/sort, invalid cart/contact drift và responsive browser;
6. nếu có D1 mutation, audit trước và verify invariant sau;
7. promotion staging có rollback point khi thay Worker traffic.

Không dùng production làm nơi thử nghiệm.

## 8. Production acceptance gate

Chưa promotion `giacong-vn` production cho đến khi đủ cả:

- staging runtime acceptance;
- admin staging write contract + CRUD acceptance;
- production taxonomy/SKU/variant/price/MOQ/media/content thật được duyệt;
- production D1/R2 được tạo/audit có chủ ý;
- request intake live verification hoàn tất;
- backup/export và rollback procedure cho production data/deploy được ghi rõ;
- production smoke checklist được duyệt.

Production Worker, production D1/R2 và `kienhieu.id.vn/*` không được thay đổi trước cổng này.

## 9. Dữ liệu demo và nội dung thật

`B2B-DEMO-*`, product `test 1`, demo contact channels, demo trust claims và asset tạm không phải dữ liệu production. Mọi migration production phải dùng dataset đã duyệt riêng.

## 10. Delivery discipline

- thay đổi nhỏ, có test trước behavior change;
- D1 mutation phải có audit/guard và verify hậu điều kiện;
- không tin client money;
- không thêm dependency nếu chưa cần;
- không chạm production để giải quyết lỗi staging;
- mọi bằng chứng runtime quan trọng cập nhật vào `CLOUDFLARE_CURRENT_STATE.md`;
- tài liệu Bagisto cũ chỉ dùng làm lịch sử/research, không được dùng để phục hồi Bagisto dependency vào runtime mới.
