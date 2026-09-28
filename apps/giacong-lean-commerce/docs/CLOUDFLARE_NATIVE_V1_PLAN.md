# Cloudflare-native technical plan

Phạm vi sản phẩm hiện hành nằm trong [PROJECT_SCOPE_2026-09-27.md](./PROJECT_SCOPE_2026-09-27.md). Tài liệu này giữ các quyết định kiến trúc và giới hạn kỹ thuật; khi hai tài liệu khác nhau về nhu cầu khách hàng, brief sản phẩm mới là nguồn quyết định.

**Trạng thái:** nguồn quyết định hiện hành cho Lean V1 kể từ 2026-08-14.

Tài liệu này giữ kiến trúc Cloudflare-native. Hồ sơ Bagisto-era được lưu tại `archive/legacy-2026-09-27/COMMERCE_PLATFORM_MASTER_PLAN.md` và không quyết định runtime hiện tại. `CLOUDFLARE_CURRENT_STATE.md` là hồ sơ bằng chứng triển khai/QA, không mở rộng scope sản phẩm.

## 1. Mục tiêu V1

Mục tiêu sản phẩm theo brief khách hàng mới: website thương mại điện tử quen thuộc, gọn, phục vụ mua lẻ và mua sỉ; mục tài khoản ở góc trang có đăng ký/đăng nhập. Khách có thể dùng Google hoặc mật khẩu của tài khoản mình; với mật khẩu, tên người dùng, email hay số điện thoại đều có thể làm tên đăng nhập, và đăng ký chọn email hoặc số điện thoại. Mọi yêu cầu mua hàng đều phải được gửi khi đã đăng nhập, lưu vào D1 gắn với khách trước khi mở Zalo; nhân viên tư vấn/chốt trên Zalo, không có checkout hay thanh toán online. Catalog hiển thị giá lẻ và bậc giá/giảm theo số lượng. Khách xem lịch sử yêu cầu và giao dịch đã chốt trong tài khoản, có nhãn phân biệt; nhân viên cập nhật giao dịch đã chốt trong Admin/D1, nguồn dữ liệu gốc, rồi đồng bộ sang Google Sheet, không nhập tay hai nơi. Không làm quản lý tồn kho hoặc nhãn còn/hết hàng; nhân viên tự ẩn sản phẩm hết hàng bằng trạng thái đăng bán hiện có. Kênh xác minh email/số điện thoại, khôi phục mật khẩu, liên kết tài khoản, URL Zalo chính thức và hợp đồng kỹ thuật đồng bộ còn cần chốt.

Không có thanh toán online, checkout hoặc xác nhận đơn trên web. Khách đăng nhập gửi yêu cầu; web ghi nhận thành công vào D1 rồi mới mở Zalo. Mọi giao dịch được tư vấn/chốt qua Zalo; nhân viên ghi giao dịch đã chốt vào Admin/D1. Không theo dõi tồn hoặc hiển thị nhãn còn/hết hàng; nhân viên tự ẩn sản phẩm hết hàng bằng trạng thái đăng bán hiện có. Chưa suy ra luồng vận chuyển trên web.

## 2. Kiến trúc đích

Runtime đích là Cloudflare-native:

- Next.js/OpenNext Worker phục vụ storefront và API;
- Cloudflare D1 là nguồn dữ liệu canonical cho catalog, variant, tier price, managed service copy, tài khoản khách, yêu cầu đã xác thực và giao dịch đã chốt; schema/write contract cho customer auth, request history và confirmed sales phải được thiết kế riêng trước khi triển khai;
- Cloudflare R2 là nguồn media sản phẩm;
- R2 riêng phục vụ incremental cache của OpenNext;
- Google Sheet + Apps Script nhận bản đồng bộ để tra cứu/vận hành; D1/Admin lưu dữ liệu gốc để lịch sử yêu cầu và mua hàng không lệch giữa hai nơi;
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
- contact threshold còn trong schema cũ; không dùng nó để đổi kênh CTA vì mọi yêu cầu mua hàng đều qua Zalo. Giữ tương thích tới khi rà hết reader/dữ liệu và có migration riêng;
- tier quantity > 0, duy nhất trên mỗi variant và phải nằm trên quantity hợp lệ;
- tier price > 0 và currency là VND;
- storefront chỉ dùng record active, trạng thái đăng bán và lựa chọn variant hợp lệ; không dùng tồn kho/availability để báo còn-hết hàng cho khách;
- server re-read D1 để xác thực sản phẩm, quy cách, bậc giá và snapshot yêu cầu; không tin dữ liệu giá do client gửi;
- client không được gửi tiền canonical để server tin lại.

Mọi write path quản trị phải validate các invariant trước khi ghi và không được tạo trạng thái mà read path hiện hành sẽ từ chối.

## 4. Chốt đơn qua Zalo

Mọi yêu cầu mua hàng, bất kể mua lẻ hay mua sỉ, đi cùng một luồng: khách đăng nhập, chọn sản phẩm/quy cách/số lượng, gửi yêu cầu; server kiểm tra dữ liệu canonical trong D1 và lưu yêu cầu gắn với tài khoản; sau khi lưu thành công, trang tiếp nhận mới mở Zalo cùng mã yêu cầu và tóm tắt mặt hàng. CTA Zalo dùng một URL cấu hình chính thức duy nhất. Không đưa tên, email, số điện thoại hoặc PII khác vào nội dung Zalo được tạo sẵn. Nhân viên tư vấn và xác nhận giao dịch bên Zalo; website không tạo đơn đã chốt, checkout hay thanh toán.

Giữ giỏ yêu cầu để khách gom nhiều mặt hàng trước khi gửi, nhưng đặt tên/nội dung UI là “Yêu cầu tư vấn”, không phải checkout hoặc đơn đã xác nhận. Mọi mức số lượng dùng chung CTA Zalo; không có nhánh chỉ lượng lớn mới sang Zalo. Chat Zalo không tự đồng bộ ngược vào website.

## 5. Request intake và lịch sử khách

Yêu cầu mua hàng từ website và giao dịch đã chốt là hai loại dữ liệu riêng, đều gắn với account ID từ phiên đăng nhập đã xác thực. Yêu cầu web phải được lưu D1 trước khi mở Zalo. Nhân viên nhập giao dịch đã chốt sau trao đổi Zalo vào Admin/D1; đây là căn cứ cho lịch sử mua. Google Sheet nhận dữ liệu được đồng bộ từ D1 để tra cứu/vận hành, không phải nơi nhập tay lần hai hoặc nguồn lịch sử mua độc lập. Lỗi Sheet không được làm mất yêu cầu hay giao dịch trong D1.

Tài khoản khách hiển thị cả lịch sử yêu cầu và giao dịch đã chốt, với nhãn/trạng thái tách biệt để không hiểu yêu cầu là đơn mua thành công. Nhân viên cập nhật trạng thái xử lý yêu cầu trong Admin; khách chỉ đọc bản ghi do server gắn với tài khoản của mình. API phải yêu cầu customer session hợp lệ, tự lấy account ID từ session, re-read D1 và lưu snapshot variant/số lượng/giá tham khảo; không nhận account ID hoặc tiền tổng từ client làm dữ liệu có thẩm quyền.

Trước production acceptance phải xác minh trên tài khoản Google thật:

- ownership/quyền kiểm soát;
- Apps Script deployment và authorization;
- idempotency/request ID và ánh xạ ID ổn định giữa bản gốc D1 với dòng Sheet;
- schema 15 cột của `Yêu cầu`;
- `Chi tiết giỏ hàng`;
- validation/protection và workflow trạng thái;
- timeout/redirect allowlist hiện hành, thử lại đồng bộ và đối soát khi Sheet lỗi.

Chi tiết trang tính/cột, cơ chế đồng bộ, thử lại và đối soát vẫn là hợp đồng kỹ thuật cần chốt; không tạo luồng nhập tay kép.

### 5.1 Trạng thái code đã kiểm tra

Audit mã nguồn tại HEAD `dd93ca64` cho thấy chưa có customer auth/account history hoặc sổ giao dịch đã chốt; `POST /api/contact` mới tạo lead chưa gắn tài khoản và đồng bộ lead, còn trạng thái `won` không phải giao dịch mua. CTA Zalo trực tiếp hiện có thể bỏ qua bước lưu D1; CTA sau khi lưu lại đang bị cấu hình demo ẩn. Chi tiết bằng chứng nằm trong [CLOUDFLARE_CURRENT_STATE.md](./CLOUDFLARE_CURRENT_STATE.md). Đây là audit source code tại commit nêu trên, không phải runtime acceptance.

### 5.2 Thứ tự lát triển khai

1. Khóa contract/schema riêng cho customer identity, verified session, request history, confirmed sale và outbox Sheet; không dùng `crm_customers` hoặc `lead.status = won` làm credential/sale ledger.
2. Thêm đăng ký/đăng nhập khách tách khỏi Cloudflare Access/Admin; bắt buộc phía server xác thực session và lấy account ID từ session.
3. Bắt buộc đăng nhập khi gửi yêu cầu, re-read catalog D1, lưu yêu cầu + dòng hàng/event có tính lặp an toàn, rồi mới hiển thị CTA Zalo chính thức cùng mã yêu cầu; xóa đường CTA bypass D1.
4. Thêm Admin ghi giao dịch đã chốt qua Zalo, gắn khách theo định danh đã xác minh, ghi bản ghi/dòng hàng/audit/outbox nguyên tử; đồng bộ Sheet theo mã ổn định và hỗ trợ retry/upsert.
5. Thêm lịch sử khách chỉ đọc các yêu cầu và giao dịch của chính account; luôn phân biệt yêu cầu chưa chốt với giao dịch mua.
6. Tinh gọn catalog/form: bỏ nhãn còn/hết và ngưỡng điều hướng sang Zalo, giữ công tắc ẩn sản phẩm và giá bậc; chỉ bỏ trường/schema sau khi reader, dữ liệu cũ và resolver giá được xử lý.
7. Chạy acceptance trên staging, gồm Google OAuth/định danh đã xác minh, mobile, account isolation, lưu trước handoff và Sheet retry; không đụng production trước production gate.

## 6. Cloudflare-native admin

Bagisto Admin không còn là bề mặt quản trị đích. Admin mới phải quản lý trực tiếp contract D1/R2 qua server-side API có kiểm soát, không cho trình duyệt truy cập binding D1/R2 trực tiếp.

### 6.1 Phạm vi V1 admin

**Ưu tiên được chủ dự án chốt lại ngày 2026-09-07:** hoàn thiện admin sản phẩm,
dịch vụ, tin tức và luồng Mua hàng / Thuê gia công đã có. Trang chủ chủ yếu cần
thay ảnh; giữ phần inline đã làm nhưng không mở rộng, xử lý mọi lớp che thao tác.
Đối chiếu menu/href với bản đã làm trên `kienhieu.id.vn`; các mục gia công được
chỉ ra phải vào luồng Thuê gia công, không rơi về phân loại bài viết cũ. Phân biệt
SKU bán hàng với nội dung dịch vụ trước khi đổi link. Chi tiết thực thi và ảnh:
[archive/legacy-2026-09-27/ADMIN_COMMERCE_RECOVERY_HANDOFF.md](./archive/legacy-2026-09-27/ADMIN_COMMERCE_RECOVERY_HANDOFF.md).
Quyết định này thay thứ tự ưu tiên homepage/storefront-first trong roadmap cũ;
không tự mở rộng mô hình thanh toán hoặc thay các ranh giới Lean V1 bên dưới.

Các năng lực admin trong phạm vi hiện hành (thứ tự triển khai theo ưu tiên mới ở trên):

1. categories: xem, tạo, sửa, active, sort order;
2. products: xem, tạo, sửa, active, category, nội dung và image reference;
3. variants: SKU, option label, unit, MOQ, quantity step, trạng thái cho phép chọn, sort order và image reference;
4. tier prices: create/update/delete với validation quantity/price;
5. product media: upload R2, chọn media cho product/variant, xóa object chỉ khi không còn reference;
6. services: sửa managed copy trong D1.
7. website control plane: site settings, SEO, structured page sections, primary navigation và publish workflow;
8. owner control: quản lý member, role, active state và audit của tài khoản admin.

Page builder V1 dùng schema section an toàn gồm hero, rich text, image, feature grid, CTA và contact. Đây là quyền tự chủ với nội dung/layout đã được mô hình hóa; không cấp quyền chạy HTML/CSS/JavaScript tùy ý hoặc tự tạo server code từ admin.

Admin cần lưu và cho nhân viên tra cứu yêu cầu liên hệ, trạng thái chăm sóc và giao dịch Zalo đã chốt; form gửi yêu cầu mua hàng trên storefront bắt buộc đăng nhập và tự tạo yêu cầu gắn account ID phía server. Nhân viên tạo giao dịch đã chốt trong Admin/D1 sau khi xác nhận với khách. Đây không phải CRM tổng quát; không thêm chiến dịch marketing, phân khúc tự động, tín dụng/công nợ hoặc hồ sơ doanh nghiệp mở rộng nếu chưa có yêu cầu. Google Sheet nhận bản đồng bộ từ D1 theo hợp đồng riêng.

### 6.2 Ranh giới bảo mật

- Admin phải nằm sau một authentication boundary riêng trước khi bật write API.
- Staging dùng `admin-staging.kienhieu.id.vn`; production dự kiến dùng `admin.kienhieu.id.vn` sau acceptance.
- Public storefront hostname không được trở thành đường tắt tới admin write API.
- Không dùng credential D1/R2 phía client.
- Không log secret, token hoặc PII không cần thiết.
- Tài khoản khách và lịch sử mua hiển thị sau đăng nhập thuộc phạm vi sản phẩm. Admin lưu thông tin liên hệ/yêu cầu cần để chăm sóc và giao dịch đã chốt; CRM mở rộng ngoài phạm vi. Tài khoản khách không được truy cập Admin và phải chỉ thấy lịch sử đã xác minh/thuộc chính tài khoản.
- Admin nội bộ chỉ dùng một quyền **Admin toàn quyền**, lưu bằng khóa `owner` để giữ nguyên tài khoản và audit (quyết định trực tiếp của chủ dự án ngày 2026-09-07, thay thế mô hình năm role ngày 2026-08-23). Các role cũ không được đăng nhập, đọc hoặc ghi API; không tự nâng quyền tài khoản cũ. Giữ Cloudflare Access, kiểm tra quyền phía server và bảo vệ admin hoạt động cuối cùng. Staging đã có đúng một tài khoản owner nên không cần chuyển đổi dữ liệu tài khoản.

Cloudflare Access là phương án bảo vệ staging admin. Cấu hình Access self-hosted, allow policy và identity-provider state cho `admin-staging.kienhieu.id.vn` đã được audit qua Cloudflare API; Worker route staging cũng đã được khai báo trong Wrangler. Việc triển khai write API vẫn phải tự fail closed nếu request không đạt admission contract, không chỉ dựa vào việc hostname đã có Access.

### 6.3 Contract write và UI control plane

Contract chi tiết đã được khóa tại [`CLOUDFLARE_ADMIN_WRITE_CONTRACT.md`](CLOUDFLARE_ADMIN_WRITE_CONTRACT.md). Trước khi dựng màn hình CRUD, implementation phải tuân thủ và test các nhóm yêu cầu sau:

- input schema/size limits;
- hostname/Access admission và same-origin mutation;
- uniqueness conflict;
- optimistic concurrency/stale-write protection;
- validation cho MOQ/step/tier; `contactFromQuantity` là trường tương thích cũ, không điều khiển kênh liên hệ mới;
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
4. smoke test catalog/detail, đăng nhập, gửi yêu cầu → D1 → Zalo và R2;
5. deep QA search/filter/sort, sai lệch dữ liệu yêu cầu, cô lập account history, tier pricing và responsive browser;
6. nếu có D1 mutation, audit trước và verify invariant sau;
7. promotion staging có rollback point khi thay Worker traffic.

Không dùng production làm nơi thử nghiệm.

## 8. Production acceptance gate

Chưa promotion `giacong-vn` production cho đến khi đủ cả:

- staging runtime acceptance;
- admin staging write contract + CRUD acceptance;
- đăng ký/đăng nhập khách, cô lập dữ liệu theo account và luồng yêu cầu lưu D1 trước khi mở Zalo được kiểm tra;
- Google OAuth, kênh xác minh/khôi phục tài khoản và URL Zalo chính thức đã cấu hình/duyệt;
- lịch sử yêu cầu/giao dịch và đồng bộ Admin/D1 → Sheet có mapping, thử lại và đối soát được xác nhận;
- production taxonomy/SKU/variant/price/MOQ/media/content thật được duyệt;
- production D1/R2 được tạo/audit có chủ ý;
- request intake live verification hoàn tất;
- backup/export và rollback procedure cho production data/deploy được ghi rõ;
- production smoke checklist được duyệt.

Production Worker, production D1/R2 và `kienhieu.id.vn/*` không được thay đổi trước cổng này.

## 9. Dữ liệu demo và nội dung thật

`B2B-DEMO-*`, product `test 1`, demo contact channels, demo trust claims và asset tạm không phải dữ liệu production. Mọi migration production phải dùng dataset đã duyệt riêng.

## 10. Delivery discipline

- thay đổi nhỏ, có kiểm tra tự động và runtime phù hợp trước khi bật behavior change;
- D1 mutation phải có audit/guard và verify hậu điều kiện;
- không tin client money;
- không thêm dependency nếu chưa cần;
- không chạm production để giải quyết lỗi staging;
- mọi bằng chứng runtime quan trọng cập nhật vào `CLOUDFLARE_CURRENT_STATE.md`;
- tài liệu Bagisto cũ chỉ dùng làm lịch sử/research, không được dùng để phục hồi Bagisto dependency vào runtime mới.
