# Cloudflare-native Lean V1 plan

**Trạng thái:** kế hoạch kiến trúc và cổng an toàn Lean V1. Phạm vi sản phẩm hiện hành theo [PROJECT_SCOPE_2026-09-27.md](PROJECT_SCOPE_2026-09-27.md).

Tài liệu này thay thế `COMMERCE_PLATFORM_MASTER_PLAN.md` về kiến trúc và ranh giới vận hành. Hồ sơ cũ được giữ lại để truy vết lịch sử thiết kế Bagisto nhưng không còn quyết định runtime, admin hoặc hạ tầng đích. `CLOUDFLARE_CURRENT_STATE.md` là hồ sơ bằng chứng triển khai và QA, không phải nơi mở rộng phạm vi sản phẩm.

## 1. Mục tiêu V1

Lean V1 phục vụ khách mua lẻ và mua sỉ:

- xem catalog nhiều danh mục và sản phẩm;
- chọn một biến thể hợp lệ, MOQ và bước số lượng;
- xem giá bậc VND do server tính;
- gom nhiều dòng yêu cầu trong `localStorage` trước khi gửi;
- đăng nhập bằng Google với email đã xác minh để gửi yêu cầu mua sản phẩm và xem lịch sử của chính mình;
- gửi yêu cầu mua sản phẩm vào D1 gắn với tài khoản, rồi mở Zalo để nhân viên tư vấn và chốt;
- xem riêng lịch sử yêu cầu và giao dịch đã được nhân viên xác nhận.

Mọi yêu cầu mua sản phẩm, lẻ hoặc sỉ, đều chuyển sang Zalo sau khi lưu D1 thành công. Admin ghi giao dịch đã chốt; website không tự xác nhận đơn. Không có checkout, `/thanh-toan`, thanh toán online, quy trình shipping trên web, Bagisto order, rating, review hoặc favorite. Luồng yêu cầu tư vấn dịch vụ có dùng chung đăng nhập → D1 → Zalo hay không vẫn cần quyết định sản phẩm.

## 2. Kiến trúc đích

Runtime đích là Cloudflare-native:

- Next.js/OpenNext Worker phục vụ storefront và API;
- Cloudflare D1 là nguồn dữ liệu canonical cho catalog, variant, tier price, managed service copy, tài khoản khách, yêu cầu và giao dịch đã chốt;
- Cloudflare R2 là nguồn media sản phẩm;
- R2 riêng phục vụ incremental cache của OpenNext;
- Google Sheet + Apps Script nhận bản đồng bộ phục vụ vận hành; Admin/D1 là nguồn gốc của yêu cầu và giao dịch đã chốt;
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
- `contact_threshold` hiện còn trong schema phải nằm trên quantity hợp lệ tính từ MOQ theo step; không dùng ngưỡng này để quyết định có chuyển Zalo hay không;
- tier quantity > 0, duy nhất trên mỗi variant và phải nằm trên quantity hợp lệ;
- tier price > 0 và currency là VND;
- storefront chỉ hiển thị sản phẩm được xuất bản; nhân viên ẩn sản phẩm không còn bán bằng trạng thái hiển thị hiện có;
- server là nguồn duy nhất tính unit price, subtotal, request type và price-on-request;
- client không được gửi tiền canonical để server tin lại.

Mọi write path quản trị phải validate các invariant trước khi ghi và không được tạo trạng thái mà read path hiện hành sẽ từ chối.

## 4. Request cart

Cart chỉ giữ ba key canonical trên client cho mỗi dòng:

- `parentSlug`
- `variantSku`
- `quantity`

Server re-read D1 cho mọi revalidation và submit. Các case tối thiểu phải được giữ trong regression gate: product/variant mất, unavailable, dưới MOQ, lệch step, tier boundary, price-on-request, cart drift và canonical money.

Không tạo server cart table hoặc session cart trong Lean V1. Khách có thể chuẩn bị giỏ trước khi đăng nhập, nhưng phải đăng nhập bằng Google đã xác minh trước khi gửi yêu cầu mua sản phẩm.

## 5. Request intake

D1 lưu yêu cầu với ID tài khoản lấy từ session phía server trước khi mở Zalo; Admin đọc và chăm sóc yêu cầu từ D1. Google Sheet + Apps Script nhận bản đồng bộ vận hành qua queue/webhook. Submit được server canonicalize; cart drift phải trả snapshot mới và không ghi yêu cầu hoặc gọi webhook. Sheet không phải nguồn lịch sử khách hay nơi nhân viên nhập giao dịch lần hai.

Trước production acceptance phải xác minh trên tài khoản Google thật:

- ownership/quyền kiểm soát;
- Apps Script deployment và authorization;
- idempotency/request ID;
- schema 15 cột của `Yêu cầu`;
- `Chi tiết giỏ hàng`;
- validation/protection và workflow trạng thái;
- timeout/redirect allowlist hiện hành.

Luồng giao dịch đã chốt lưu snapshot dòng hàng, audit và outbox cùng batch D1; đồng bộ Sheet theo `sale_id`/`sale_line_id` để retry không nhân đôi. Cấu hình secret, redeploy Apps Script và Worker, cùng kiểm tra giao dịch thử/replay là cổng vận hành trước khi dùng thật.

## 6. Cloudflare-native admin

Bagisto Admin không còn là bề mặt quản trị đích. Admin mới phải quản lý trực tiếp contract D1/R2 qua server-side API có kiểm soát, không cho trình duyệt truy cập binding D1/R2 trực tiếp.

### 6.1 Phạm vi V1 admin

**Ưu tiên được chủ dự án chốt lại ngày 2026-09-07:** hoàn thiện admin sản phẩm,
dịch vụ, tin tức và luồng Mua hàng / Thuê gia công đã có. Trang chủ chủ yếu cần
thay ảnh; giữ phần inline đã làm nhưng không mở rộng, xử lý mọi lớp che thao tác.
Đối chiếu menu/href với bản đã làm trên `kienhieu.id.vn`; các mục gia công được
chỉ ra phải vào luồng Thuê gia công, không rơi về phân loại bài viết cũ. Phân biệt
SKU bán hàng với nội dung dịch vụ trước khi đổi link. Chi tiết thực thi và ảnh:
[hồ sơ recovery cũ](./archive/legacy-2026-09-27/ADMIN_COMMERCE_RECOVERY_HANDOFF.md).
Quyết định này thay thứ tự ưu tiên homepage/storefront-first trong roadmap cũ;
không tự mở rộng mô hình thanh toán hoặc thay các ranh giới Lean V1 bên dưới.

Các năng lực admin trong phạm vi hiện hành (thứ tự triển khai theo ưu tiên mới ở trên):

1. categories: xem, tạo, sửa, active, sort order;
2. products: xem, tạo, sửa, active, category, nội dung và image reference;
3. variants: SKU, option label, unit, MOQ, quantity step, sort order và image reference; giữ validation cho `contact_threshold`/`availability` hiện có trong schema nhưng không dùng chúng làm ngưỡng chuyển Zalo hoặc nhãn tồn kho cho khách;
4. tier prices: create/update/delete với validation quantity/price;
5. product media: upload R2, chọn media cho product/variant, xóa object chỉ khi không còn reference;
6. services: sửa managed copy trong D1.
7. website control plane: site settings, SEO, structured page sections, primary navigation và publish workflow;
8. owner control: quản lý member, role, active state và audit của tài khoản admin.

Page builder V1 dùng schema section an toàn gồm hero, rich text, image, feature grid, CTA và contact. Đây là quyền tự chủ với nội dung/layout đã được mô hình hóa; không cấp quyền chạy HTML/CSS/JavaScript tùy ý hoặc tự tạo server code từ admin.

Admin đọc yêu cầu đã lưu ở D1, chăm sóc liên hệ/yêu cầu và ghi giao dịch đã chốt qua Zalo. Giới hạn bề mặt khách hàng ở lịch sử liên hệ, yêu cầu và giao dịch; không mở rộng thành CRM tổng quát nếu chưa có quyết định sản phẩm.

### 6.2 Ranh giới bảo mật

- Admin phải nằm sau một authentication boundary riêng trước khi bật write API.
- Staging dùng `admin-staging.kienhieu.id.vn`; production dự kiến dùng `admin.kienhieu.id.vn` sau acceptance.
- Public storefront hostname không được trở thành đường tắt tới admin write API.
- Không dùng credential D1/R2 phía client.
- Không log secret, token hoặc PII không cần thiết.
- Xác thực khách hàng storefront tách khỏi Cloudflare Access và quyền Admin; server chỉ trả lịch sử gắn với ID tài khoản từ session đã xác minh.
- Admin nội bộ chỉ dùng một quyền **Admin toàn quyền**, lưu bằng khóa `owner` để giữ nguyên tài khoản và audit (quyết định trực tiếp của chủ dự án ngày 2026-09-07, thay thế mô hình năm role ngày 2026-08-23). Các role cũ không được đăng nhập, đọc hoặc ghi API; không tự nâng quyền tài khoản cũ. Giữ Cloudflare Access, kiểm tra quyền phía server và bảo vệ admin hoạt động cuối cùng. Staging đã có đúng một tài khoản owner nên không cần chuyển đổi dữ liệu tài khoản.

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
