# Cloudflare-native Lean V1 plan

**Trạng thái:** nguồn quyết định hiện hành cho Lean V1 kể từ 2026-08-14; cập nhật trạng thái kiến trúc ngày 2026-08-18.

Tài liệu này thay thế `COMMERCE_PLATFORM_MASTER_PLAN.md` làm nguồn quyết định. Hồ sơ cũ được giữ lại để truy vết lịch sử thiết kế Bagisto nhưng không còn quyết định runtime, admin hoặc hạ tầng đích. `CLOUDFLARE_CURRENT_STATE.md` là hồ sơ bằng chứng triển khai và QA, không phải nơi mở rộng scope sản phẩm.

## 1. Mục tiêu V1

Lean V1 là storefront B2B cho phép khách:

- xem catalog nhiều danh mục và sản phẩm;
- chọn một biến thể hợp lệ, MOQ và bước số lượng;
- xem giá bậc VND do server tính;
- gom nhiều dòng vào guest request cart trong `localStorage`;
- gửi yêu cầu sản phẩm hoặc tư vấn dịch vụ;
- đọc nội dung News đã phát hành theo archive, bài viết và chuyên mục;
- kết thúc trách nhiệm storefront khi request intake đã được lưu bền vững và chấp nhận.

Không có customer account, checkout, `/thanh-toan`, payment, shipping, Bagisto order, quote lifecycle, rating, review hoặc favorite.

## 2. Kiến trúc đích

Runtime đích là Cloudflare-native:

- Next.js/OpenNext Worker phục vụ storefront và API;
- Cloudflare D1 là nguồn dữ liệu canonical cho catalog, variant, tier price, managed service copy, News, cấu hình quản trị và durable lead inbox;
- Cloudflare R2 là nguồn media sản phẩm/site theo các contract hiện hành;
- R2 riêng phục vụ incremental cache của OpenNext;
- Cloudflare Queue là transport bất đồng bộ ưu tiên cho secondary lead delivery khi binding được provision;
- Google Sheet + Apps Script là secondary operational sink cho lead delivery cho đến khi có quyết định khác được duyệt, không phải nguồn canonical duy nhất của request intake;
- không dùng VPS, Cloudflare Tunnel, PHP origin hoặc Bagisto làm commerce runtime.

Production và staging tách riêng resource. Dữ liệu demo staging không được copy ngầm sang production.

## 3. Catalog canonical contract

Schema catalog hiện hành gồm:

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

Request intake là **D1-first**. Sau khi input và cart được server canonicalize, request phải được lưu bền vững vào D1 trước secondary delivery. Durable intake hiện gồm lead, line items và event history; request ID được dùng cho idempotency và concurrent replay protection.

Luồng đích:

1. validate request và canonicalize catalog/cart từ D1;
2. ghi lead + items + initial event vào D1 atomically;
3. nếu Cloudflare Queue binding có sẵn, enqueue secondary delivery và trả acceptance dựa trên durable D1 lead;
4. queue consumer giao payload sang Google Apps Script/Sheet và cập nhật delivery status;
5. nếu queue chưa được provision, synchronous Google delivery chỉ là fallback sau khi D1 lead đã tồn tại;
6. lỗi enqueue hoặc secondary sink không được làm mất durable lead; trạng thái delivery phải còn nhìn thấy để Admin xử lý.

`/admin/yeu-cau` là inbox vận hành trên D1 cho lead đã tiếp nhận. Google Sheet/Apps Script tiếp tục là secondary sink cần được xác minh nếu vẫn được dùng trong production, nhưng không được coi là nơi duy nhất quyết định request đã tồn tại.

Cart drift phải trả canonical snapshot mới và không tạo lead mới hay gọi secondary sink.

Trước production acceptance phải xác minh trên tài khoản Google thật nếu Google sink vẫn được bật:

- ownership/quyền kiểm soát;
- Apps Script deployment và authorization;
- request ID/reference mapping;
- schema đích của `Yêu cầu` và `Chi tiết giỏ hàng`;
- validation/protection và workflow trạng thái cần duy trì ở sink;
- timeout/redirect allowlist hiện hành;
- retry/idempotency không tạo duplicate business request.

Nếu secondary sink được thay bằng hệ khác thì phải có quyết định riêng; D1 durable lead inbox vẫn là boundary intake của Lean V1 trừ khi có migration plan được duyệt.

## 6. Cloudflare-native admin

Bagisto Admin không còn là bề mặt quản trị đích. Admin mới quản lý trực tiếp contract D1/R2 qua server-side API có kiểm soát, không cho trình duyệt truy cập binding D1/R2 trực tiếp.

### 6.1 Phạm vi V1 admin

Admin staging hỗ trợ hoặc phải hoàn tất acceptance cho các nhóm sau:

1. catalog categories: xem, tạo, sửa, active, sort order;
2. products: xem, tạo, sửa, active, category, nội dung và image reference;
3. variants: SKU, option label, unit, MOQ, quantity step, contact threshold, availability, sort order và image reference;
4. tier prices: create/update/delete với validation quantity/price;
5. product/service/site media theo contract R2 hiện hành, với lifecycle/reference guard trước khi xóa object;
6. services: sửa managed copy trong D1;
7. lead inbox: xem durable D1 lead, delivery state và cập nhật pipeline status theo quyền;
8. News articles: draft, publish/schedule, soft archive, category, featured, SEO và optimistic concurrency;
9. News categories: create/update/active/sort/delete với revision guard và chặn xóa khi còn bài tham chiếu.

News thumbnail hiện chỉ là URL reference trong article contract. Không mở rộng ngầm bảng `media_assets` sang News vì schema hiện hành khóa namespace/reference vào product, variant và service; nếu cần upload News vào R2 phải có migration và lifecycle contract riêng.

### 6.2 Ranh giới bảo mật

- Admin phải nằm sau authentication/admission boundary riêng trước write API.
- Staging dùng `admin-staging.kienhieu.id.vn`; production dự kiến dùng `admin.kienhieu.id.vn` sau acceptance.
- Public storefront hostname không được trở thành đường tắt tới admin write API.
- Không dùng credential D1/R2 phía client.
- Không log secret, token hoặc PII không cần thiết.
- Role hiện hành gồm `owner`, `content_manager`, `catalog_manager`, `sales_manager`, `viewer`; server phải enforce quyền mutation theo role, không chỉ ẩn nút ở UI.
- Không xây customer identity hoặc permission system rộng hơn nhu cầu vận hành Lean V1 nếu chưa có quyết định riêng.

Cloudflare Access là phương án bảo vệ staging admin. Cấu hình Access self-hosted, allow policy và identity-provider state cho `admin-staging.kienhieu.id.vn` đã được audit qua Cloudflare API; Worker route staging cũng đã được khai báo trong Wrangler. Write API vẫn phải tự fail closed nếu request không đạt admission contract, không chỉ dựa vào việc hostname đã có Access.

### 6.3 Contract write trước UI

Contract chi tiết được khóa tại [`CLOUDFLARE_ADMIN_WRITE_CONTRACT.md`](CLOUDFLARE_ADMIN_WRITE_CONTRACT.md). Mọi màn hình CRUD phải đứng trên server contract đã test, gồm các nhóm yêu cầu:

- input schema/size limits;
- hostname/Access admission và same-origin mutation;
- role authorization;
- uniqueness conflict;
- optimistic concurrency/stale-write protection;
- validation cho MOQ/step/contact/tier và content-specific invariants;
- media content type/size/key/reference policy;
- canonical API response;
- error mapping không lộ nội bộ;
- auditability và request id/idempotency phù hợp với write operation.

UI admin không được tự tạo business rule khác server contract.

## 7. Staging gate

Staging là cổng bắt buộc cho mọi thay đổi Cloudflare-native:

1. `npm run check` xanh;
2. OpenNext build/package gate xanh;
3. version preview nếu thay runtime và cần cô lập trước promotion;
4. smoke test catalog/detail/cart/R2;
5. deep QA search/filter/sort, invalid cart/contact drift, responsive browser và News public visibility;
6. News gate phải giữ archive/detail/category behavior, missing 404, scheduled-future/archived invisibility khi có dữ liệu tương ứng và schema migration prerequisites;
7. nếu có D1 mutation, audit trước và verify invariant sau;
8. promotion staging có rollback point khi thay Worker traffic.

Không dùng production làm nơi thử nghiệm.

## 8. Production acceptance gate

Chưa promotion `giacong-vn` production cho đến khi đủ cả:

- staging runtime acceptance, bao gồm News regression sau khi suite mới được quan sát chạy trên deployed staging commit;
- admin staging write contract + CRUD acceptance cho scope V1;
- durable lead intake và Admin inbox acceptance;
- production taxonomy/SKU/variant/price/MOQ/media/content/News thật được duyệt;
- production D1/R2 và Queue cần thiết được tạo/audit có chủ ý;
- secondary request sink live verification hoàn tất nếu Google Sheet/Apps Script vẫn được vận hành;
- backup/export và rollback procedure cho production data/deploy được ghi rõ;
- production smoke checklist được duyệt.

Production Worker, production D1/R2 và `kienhieu.id.vn/*` không được thay đổi trước cổng này.

## 9. Dữ liệu demo và nội dung thật

`B2B-DEMO-*`, product `test 1`, demo contact channels, demo trust claims, News thử nghiệm và asset tạm không phải dữ liệu production. Mọi migration production phải dùng dataset đã duyệt riêng.

## 10. Delivery discipline

- thay đổi nhỏ, có test trước behavior change;
- D1 mutation phải có audit/guard và verify hậu điều kiện;
- không tin client money;
- durable request intake không phụ thuộc vào thành công tức thời của secondary sink;
- không thêm dependency nếu chưa cần;
- không chạm production để giải quyết lỗi staging;
- mọi bằng chứng runtime quan trọng cập nhật vào `CLOUDFLARE_CURRENT_STATE.md`;
- tài liệu Bagisto cũ chỉ dùng làm lịch sử/research, không được dùng để phục hồi Bagisto dependency vào runtime mới.
