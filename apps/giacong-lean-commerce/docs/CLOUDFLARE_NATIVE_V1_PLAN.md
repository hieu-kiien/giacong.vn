# Cloudflare-native Lean V1 plan

**Trạng thái:** nguồn quyết định hiện hành cho Lean V1. Mọi kế hoạch cũ nhắc Bagisto/Vercel như runtime đích đều là lịch sử và không được dùng để quyết định implementation mới.

## 1. Mục tiêu V1

Lean V1 là storefront B2B cho phép khách:

- xem catalog nhiều danh mục và sản phẩm;
- chọn một biến thể hợp lệ, MOQ và bước số lượng;
- xem giá bậc VND do server tính;
- gom nhiều dòng vào guest request cart trong `localStorage`;
- gửi yêu cầu sản phẩm hoặc tư vấn dịch vụ;
- kết thúc trách nhiệm website khi request intake được chấp nhận.

Không có customer account, checkout, `/thanh-toan`, payment, shipping, Bagisto order, quote lifecycle, rating, review hoặc favorite.

## 2. Kiến trúc đích — Cloudflare only

Runtime/deployment target duy nhất của Lean V1 là Cloudflare:

- Next.js/OpenNext Worker phục vụ storefront và API;
- Cloudflare D1 là nguồn dữ liệu canonical cho catalog, variant, tier price và managed service copy;
- Cloudflare R2 là nguồn media sản phẩm;
- R2 riêng phục vụ incremental cache của OpenNext;
- Cloudflare Access là admission boundary cho Admin;
- GitHub Actions là pipeline build/test/audit/deploy Cloudflare;
- Google Sheet + Apps Script tiếp tục là request queue cho đến khi có quyết định khác được duyệt;
- không dùng Vercel, VPS, Cloudflare Tunnel, PHP origin hoặc Bagisto làm commerce runtime.

Production và staging tách riêng resource. Dữ liệu demo staging không được copy ngầm sang production.

### Quyết định Vercel

Vercel **không còn là deployment target**. Project/Preview integration `giacong-vn-demo` đang tạo preview deployment ngoài kiến trúc đích và có thể tiếp tục gửi email failure khi GitHub có commit mới. Không sửa application chỉ để làm Vercel preview pass. Sau khi xác minh không còn dependency vận hành, integration/project Vercel phải được disable/remove khỏi delivery path.

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
4. tier prices: **complete atomic replacement** với validation quantity/price và parent variant revision;
5. product media: upload R2, chọn media cho product/variant, xóa object chỉ khi không còn reference;
6. services: sửa managed copy trong D1.

Request queue vẫn ở Google Sheet trong pha này; không xây request inbox admin trước khi có quyết định riêng.

### 6.2 Ranh giới bảo mật

- Admin phải nằm sau một authentication boundary riêng trước khi bật write API.
- Staging dùng `admin-staging.kienhieu.id.vn`; production dự kiến dùng `admin.kienhieu.id.vn` sau acceptance.
- Public storefront hostname không được trở thành đường tắt tới admin write API.
- Không dùng credential D1/R2 phía client.
- Không log secret, token hoặc PII không cần thiết.
- Lean V1 chỉ cần một operator administrator; không xây granular RBAC hay customer identity.

Cloudflare Access là phương án bảo vệ staging admin. Cấu hình Access, allow policy và identity-provider state cho `admin-staging.kienhieu.id.vn` đã được audit qua GitHub Actions gọi Cloudflare API; Worker route staging cũng đã được khai báo trong Wrangler. Việc triển khai write API vẫn phải tự fail closed nếu request không đạt admission contract, không chỉ dựa vào việc hostname đã có Access.

### 6.3 Contract write trước UI

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

UI admin chỉ được xây trên contract server đã test xanh.

## 7. Roadmap implementation hiện tại

Không nhảy thẳng sang UI. Thứ tự đã khóa:

### Phase A — Server write foundation

- [x] Cloudflare Access/admission foundation
- [x] D1 audit/revision foundation
- [x] Category read/write contract
- [x] Product read/write contract
- [x] Variant write/validation foundation
- [ ] Tier-price atomic replacement + parent revision concurrency
- [ ] R2 product-media upload/reference/delete contract
- [ ] Managed service-content write contract

### Phase B — Staging verification

- [ ] `npm run check` xanh trên commit hợp nhất của admin server contracts
- [ ] OpenNext build/package gate xanh
- [ ] D1 migration/preflight + postcondition audit
- [ ] protected admin mutation QA qua Cloudflare Access
- [ ] public storefront reads the exact D1/R2 state written by admin
- [ ] regression matrix for stale/idempotency/conflict/media cases

### Phase C — Admin UI

Chỉ bắt đầu khi Phase A/B xanh. Thứ tự UI:

1. Categories
2. Products
3. Variants
4. Tier prices
5. Product media
6. Services

UI phải dùng `/api/admin/**`, không gọi D1/R2 trực tiếp và không tạo business logic pricing riêng trên browser.

### Phase D — Production readiness

- [ ] production taxonomy/SKU/variant/price/MOQ/media/content thật được duyệt
- [ ] production D1/R2 được tạo/audit có chủ ý
- [ ] request intake live verification hoàn tất
- [ ] backup/export + rollback procedure được ghi rõ
- [ ] production smoke checklist được duyệt
- [ ] Vercel legacy integration được disable/remove khỏi delivery path

### Phase E — Production promotion

Chỉ sau toàn bộ acceptance gate mới upload/promote `giacong-vn` production và bật production Admin.

## 8. Staging gate

Staging là cổng bắt buộc cho mọi thay đổi Cloudflare-native:

1. `npm run check` xanh;
2. OpenNext build/package gate xanh;
3. version preview nếu thay runtime;
4. smoke test catalog/detail/cart/R2;
5. deep QA search/filter/sort, invalid cart/contact drift và responsive browser;
6. nếu có D1 mutation, audit trước và verify invariant sau;
7. protected admin mutation/readback QA nếu admin code thay đổi;
8. promotion staging có rollback point khi thay Worker traffic.

Không dùng production làm nơi thử nghiệm.

## 9. Production acceptance gate

Chưa promotion `giacong-vn` production cho đến khi đủ cả:

- staging runtime acceptance;
- admin staging write contract + CRUD acceptance;
- production taxonomy/SKU/variant/price/MOQ/media/content thật được duyệt;
- production D1/R2 được tạo/audit có chủ ý;
- request intake live verification hoàn tất;
- backup/export và rollback procedure cho production data/deploy được ghi rõ;
- production smoke checklist được duyệt.

Production Worker, production D1/R2 và `kienhieu.id.vn/*` không được thay đổi trước cổng này.

## 10. Dữ liệu demo và nội dung thật

`B2B-DEMO-*`, product `test 1`, demo contact channels, demo trust claims và asset tạm không phải dữ liệu production. Mọi migration production phải dùng dataset đã duyệt riêng.

## 11. Documentation hygiene

- `CLOUDFLARE_NATIVE_V1_PLAN.md` là nguồn quyết định duy nhất.
- `CLOUDFLARE_ADMIN_WRITE_CONTRACT.md` là contract server.
- `CLOUDFLARE_CURRENT_STATE.md` chỉ ghi bằng chứng đã xác minh.
- `CLOUDFLARE_DEPLOYMENT.md` chỉ ghi deployment/safety procedure.
- `UI_CURRENT_MAP.md` phải phản ánh route storefront thực tế và trạng thái Admin UI.
- `COMMERCE_PLATFORM_MASTER_PLAN.md`, `ORIGINAL_GIACONG_VN_MAP.md` và capture/research assets được giữ như lịch sử; không tạo thêm tài liệu quyết định trùng lặp.
- Khi một tài liệu lịch sử mâu thuẫn với Cloudflare-native plan, lịch sử không có hiệu lực.

## 12. Delivery discipline

- thay đổi nhỏ, có test trước behavior change;
- D1 mutation phải có audit/guard và verify hậu điều kiện;
- không tin client money;
- không thêm dependency nếu chưa cần;
- không chạm production để giải quyết lỗi staging;
- mọi bằng chứng runtime quan trọng cập nhật vào `CLOUDFLARE_CURRENT_STATE.md`;
- không phục hồi Bagisto/Vercel dependency vào runtime mới;
- không sửa application chỉ để làm legacy Vercel preview pass.
