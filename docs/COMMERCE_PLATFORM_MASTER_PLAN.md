# Hồ sơ sản phẩm và kỹ thuật — Lean V1

**Trạng thái:** nguồn quyết định hiện hành và hồ sơ Lean V1 duy nhất.
**Ranh giới tài liệu:** [GOOGLE_SHEETS_CONTACT_WEBHOOK.md](./GOOGLE_SHEETS_CONTACT_WEBHOOK.md) mô tả webhook hiện tại. `docs/research/PAGE_TOPOLOGY.md` chỉ là bố cục clone, không phải sitemap đích. Bộ handoff `giacong-product-ai-handoff` là đầu vào thiết kế (business rule, IA, component spec, data model, ảnh tham chiếu), không phải nguồn quyết định; khi mâu thuẫn, hồ sơ này thắng.
**Ranh giới triển khai:** hồ sơ này không sửa code/UI/Bagisto, không ghi trực tiếp bảng core Bagisto, không đổi cổng `3000`, `8000`, `8001`. Website có đúng một origin public: Next sở hữu `/`, còn `/admin`, `/api/b2b` và asset Bagisto được proxy tới backend nội bộ `127.0.0.1:18001`. Cổng public cũ `8081` đã bị loại bỏ và không được đưa lại vào tài liệu hoặc cấu hình runtime. Không push.

## 1. Bài toán Lean V1

Lean V1 cho khách B2B xem catalog, chọn biến thể và số lượng hợp lệ, đọc giá theo số lượng bằng VND, hoặc chọn dịch vụ; gom nhiều mặt hàng vào giỏ hàng khách rồi gửi một yêu cầu có đủ ngữ cảnh. Website chuyển yêu cầu sang Google Sheet qua Apps Script và kết thúc trách nhiệm khi một submit được chấp nhận. Không có báo giá tự động, order, thanh toán, giao hàng hay fulfillment trong website V1.

Phạm vi sản phẩm V1 là catalog nhiều danh mục và nhiều sản phẩm đọc từ Bagisto: danh mục cha/con, trang danh sách có tìm kiếm, lọc, sắp xếp và phân trang, trang chi tiết có biến thể, đơn vị, quy cách, tồn kho và giá bậc VND. Family **Bột dinh dưỡng** (vani, ít ngọt) chỉ còn là mẫu cấu trúc parent/variant sẵn có trong `DemoCatalogSeeder.php`, không còn là giới hạn phạm vi. Taxonomy cuối, SKU, ảnh, nội dung, giá và dữ liệu thương mại thật đều **Chờ xác nhận** trước khi duyệt public; dữ liệu `B2B-DEMO` không phải dữ liệu production.

Giỏ hàng khách (guest cart) nằm trong phạm vi và chỉ là bước gom yêu cầu. Giỏ chỉ tồn tại ở `localStorage` của trình duyệt để preview; không có tài khoản khách, không có session giỏ hàng phía server và không có bảng cart. Trang `/gui-yeu-cau` là giỏ hàng kèm form gửi yêu cầu; không có `/thanh-toan`. Server đọc lại Bagisto để xác thực từng dòng giỏ (tồn tại, còn bán, tồn kho, MOQ, bước số lượng, giá bậc) và không tin giá, đơn giá hay tổng tiền do client gửi. Một submit được chấp nhận tạo một yêu cầu trong Sheet với dữ liệu canonical do server tính. Giỏ hàng không tạo order, thanh toán, giao hàng hay Bagisto order.

Giai đoạn demo được phép dùng nội dung và asset tạm: trust claim dạng demo được phép, asset demo là tạm thời, và kênh liên hệ demo là Zalo `06408115`, Messenger `https://m.me/qtudepdai`, email `qtu1053@gmail.com`, hotline `0868408115`. Toàn bộ nhóm này là demo, phải được chủ dự án xác nhận và thay bằng dữ liệu thật trước khi duyệt public.

Dịch vụ đại diện V1 là **Sấy & thực phẩm sấy** (`say-thuc-pham-say`). Tiêu đề, mô tả ngắn và nội dung chính của dịch vụ này hiện đọc từ Bagisto native CMS qua `GET /api/b2b/services/{slug}`; phép thử Admin save → API → Next storefront đã qua và dữ liệu thử đã được hoàn nguyên. `serviceFamilies` vẫn giữ taxonomy, liên kết dịch vụ và fallback cho các nhóm chưa di trú; media và các service family ngoài mẫu V1 vẫn **Cần làm** khi nội dung thật được duyệt.

Chỉ có một loại tài khoản nội bộ là `administrator`; khách không có tài khoản. Có đúng một tài khoản administrator dùng chung, do chủ/ông chủ giao cho một người sử dụng. Người tư vấn và người xử lý Sheet đều dùng tài khoản này; không có nhiều tài khoản định danh, role con hay granular RBAC. Sau audit Bagisto, người được giao dùng có thể tự đổi mật khẩu/khôi phục mật khẩu hoặc chủ/ông chủ chuyển giao người sử dụng theo quy trình Bagisto. V1 không cần chức năng tạo hoặc vô hiệu hóa nhiều tài khoản và không tự khẳng định khả năng native chưa audit.

Mục tiêu bàn giao là autonomy vận hành bị khóa: administrator dùng Bagisto admin và Google Sheet để quản lý sản phẩm, biến thể, giá, tồn, ngưỡng, nội dung/media/liên hệ và Sheet hằng ngày mà không cần lập trình viên. Điều này không cho phép ghi trực tiếp core Bagisto hoặc tạo khu quản trị Next.js riêng. Đổi bố cục, điều hướng hoặc chức năng mới vẫn cần kỹ thuật và ngoài phạm vi V1; không dùng page builder.

Trong giai đoạn hiện tại, Google Sheet và Apps Script thuộc tài khoản Google của user/chủ dự án. Trước bàn giao, ownership/quyền kiểm soát phải chuyển sang tài khoản Google/Workspace do khách sở hữu. Tài liệu không ghi email hoặc tên tài khoản; nếu Google không hỗ trợ chuyển ownership trực tiếp theo loại tài khoản, phải migration/redeploy sang project và Sheet do khách kiểm soát sau audit, rồi xác minh quyền cuối cùng.

Ngoài phạm vi vĩnh viễn: customer account/portal, checkout và `/thanh-toan`, tạo Bagisto order, payment, shipping, order completion, quote engine, vòng đời báo giá, company/team/approval, granular RBAC, wizard gia công phức tạp, tệp đính kèm, BOM/nguyên liệu/QC/tiến độ xưởng, đa kênh, đa ngôn ngữ, đa tiền tệ, payment gateway, carrier, promotion, rating/review/favorite và thay thế toàn bộ captured markup. Cart phía server (bảng cart, session giỏ hàng, cart API có state) cũng ngoài phạm vi; chỉ có guest cart `localStorage` nêu trên. Request inbox Bagisto chỉ được xem xét tại cổng quyết định Pha 3; cho đến lúc đó Google Sheet vẫn là nguồn chính. `b2b_briefs` và `b2b_catalog_audits` đã bị loại khỏi mã nguồn.

Tích hợp CRM là **optional**, ngoài đường tới hạn V1. Nếu làm, CRM chỉ nhận bản sao yêu cầu sau khi Sheet đã ghi thành công; Sheet vẫn là hàng đợi vận hành duy nhất và lỗi CRM không được chặn submit. Hiện **hoãn có chủ ý**: chưa có CRM đích, chưa có contract endpoint/auth và chưa có quyết định xử lý PII của chủ dự án. Không có tham chiếu CRM nào trong code hay contract; không giả lập một CRM chưa tồn tại.

## 2. Người dùng và ma trận quyền

Không có tài khoản khách. `administrator` là loại tài khoản nội bộ duy nhất; không có role/type nội bộ khác, company, team hay quyền chi tiết theo người dùng. Bagisto Admin là bề mặt quản trị duy nhất; `/quan-tri` Next.js, BFF quản trị và API `/api/b2b/admin/v1/*` đã được loại bỏ. Google Sheet là nơi xử lý yêu cầu.

| Dữ liệu / thao tác | Khách | Administrator |
| --- | --- | --- |
| Catalog — xem danh mục, sản phẩm, biến thể, giá bậc, tồn kho công khai và chính sách số lượng | Đọc | Đọc trong storefront/Bagisto admin |
| Giỏ hàng khách — thêm/sửa/xóa dòng, xem tạm tính | Tự quản trong `localStorage` trình duyệt của mình; server xác thực lại khi gửi | Không có bề mặt xem giỏ của khách; chỉ thấy dòng đã gửi trong Sheet |
| Catalog — tạo, sửa, ẩn/hiện, sắp xếp sản phẩm và biến thể | Không | CRUD vận hành trong màn hình product admin hiện có của Bagisto; không ghi trực tiếp core |
| Catalog — giá, tồn kho, MOQ, bước số lượng, ngưỡng liên hệ | Không | Tạo/sửa/ẩn/kiểm tra trong màn hình product/variant native của Bagisto; policy B2B đã được extension trên biến thể simple |
| Service family, trang dịch vụ, nội dung, media | Đọc nội dung public | Dịch vụ mẫu `say-thuc-pham-say` đã sửa nội dung qua Bagisto CMS/read API; taxonomy/link/media và các nhóm ngoài mẫu vẫn **Cần làm** khi được duyệt |
| Trang chủ, nội dung doanh nghiệp và thông tin liên hệ được chỉ định editable | Đọc | Sửa nội dung/media/contact qua Bagisto CMS/read API sau khi thiết lập **Cần làm** |
| Yêu cầu Sheet — tạo | Gửi form; submit được chấp nhận tạo dòng riêng | Apps Script thêm dòng, không qua Bagisto order |
| Chi tiết giỏ hàng Sheet — tạo, xem | Không xem Sheet; submit giỏ nhiều dòng sinh N dòng chi tiết cùng `Mã` | Chỉ đọc; toàn bộ tab do server/Apps Script ghi và được bảo vệ. Trạng thái vận hành chỉ nằm ở dòng `Yêu cầu`. **Cần làm** |
| Yêu cầu Sheet — xem, lọc, xử lý, phân công, ghi chú | Không | Template Apps Script đã triển khai xử lý trong L:N: **Trạng thái**, **Người phụ trách**, **Ghi chú**; owner-run authorization và live verification vẫn **Chờ xác nhận** |
| Yêu cầu Sheet — xóa hoặc đổi thứ tự dòng/cột | Không | Không trong V1; template Apps Script đã triển khai protection cấu trúc, còn owner-run/live verification **Chờ xác nhận** |
| Tài khoản nội bộ | Không | Có đúng một tài khoản dùng chung `administrator`; sau audit/cấu hình **Cần làm**, người được giao tự đổi/khôi phục mật khẩu hoặc chủ/ông chủ chuyển giao người sử dụng theo quy trình Bagisto. Không tạo/vô hiệu hóa nhiều tài khoản, không granular role. |

Template Apps Script giữ đúng 15 cột A:O cho intake tab `Yêu cầu`; `setupRequestWorkbook()` cấu hình validation/protection và `onEdit` cập nhật O cho single-cell operational edit. Tab thứ hai `Chi tiết giỏ hàng` là **Cần làm**: khóa theo `Mã` của dòng `Yêu cầu`, chỉ do server/Apps Script ghi, bảo vệ toàn bộ cột và không mang trạng thái vận hành. Cần xác minh trong Google account thật trước bàn giao. Giai đoạn hiện tại, user/chủ dự án là chủ sở hữu Google Sheet và Apps Script; ownership/quyền kiểm soát, trigger authorization và live verification vẫn **Chờ xác nhận**.

Dropdown/data validation và chuyển trạng thái sau đã được triển khai trong template Apps Script, nhưng chưa live verified: `Loại` chỉ nhận **Đặt sản phẩm**, **Tư vấn số lượng lớn**, **Tư vấn dịch vụ**; `Trạng thái` chỉ nhận **Mới**, **Đang tư vấn**, **Chờ khách phản hồi**, **Đã hoàn tất**, **Không tiếp tục**. Khi rời **Mới**, `Người phụ trách` bắt buộc không rỗng. Chuyển trạng thái hợp lệ: **Mới → Đang tư vấn**; **Đang tư vấn → Chờ khách phản hồi | Đã hoàn tất | Không tiếp tục**; **Chờ khách phản hồi → Đang tư vấn | Đã hoàn tất | Không tiếp tục**. **Đã hoàn tất** và **Không tiếp tục** là kết thúc, không mở lại trong V1. Owner-run authorization, ownership/quyền kiểm soát và live verification vẫn **Chờ xác nhận**.

Mỗi submit được chấp nhận luôn tạo một `Mã` và một dòng `Yêu cầu` riêng; submit giỏ hàng thêm N dòng `Chi tiết giỏ hàng` mang cùng `Mã`. Không có merge hoặc dedup engine. Nếu administrator kết luận một dòng trùng, đặt `Trạng thái=Không tiếp tục` và ghi `Trùng mã <reference>` ở `Ghi chú`.

## 3. MVP và phần hoãn

| Trong MVP | Ngoài phạm vi / hoãn rõ ràng |
| --- | --- |
| Catalog nhiều danh mục và nhiều sản phẩm đọc từ Bagisto: danh mục cha/con, danh sách có tìm kiếm/lọc/sắp xếp/phân trang đồng bộ URL, chi tiết có biến thể và giá bậc | Catalog production trước khi taxonomy/SKU/ảnh/nội dung/giá thật hết trạng thái **Chờ xác nhận** và được duyệt public |
| Hiển thị MOQ, bước số lượng, giá bậc và ngưỡng liên hệ | Quote engine, báo giá tự động, vòng đời báo giá |
| Hai CTA theo ngưỡng, đều `POST /api/contact` rồi chuyển yêu cầu vào Sheet | Customer account/portal, checkout, `/thanh-toan`, tạo Bagisto order, payment, shipping, order completion |
| Guest cart `localStorage` preview và `/gui-yeu-cau` (giỏ hàng + form gửi yêu cầu); server xác thực lại từng dòng với Bagisto trước khi ghi Sheet | Cart phía server, session giỏ hàng, cart API có state, khôi phục giỏ qua thiết bị |
| Loại bỏ rating, review và favorite ở mọi bề mặt | Rating/review/favorite, kể cả khi bộ handoff có mô tả |
| Nội dung demo giai đoạn hiện tại: trust claim demo được phép, asset demo tạm thời, kênh liên hệ demo Zalo/Messenger/email/hotline | Coi dữ liệu demo là dữ liệu production; duyệt public trước khi thay bằng dữ liệu thật |
| Một service family **Sấy & thực phẩm sấy**; CTA form và webhook Sheet | Nhiều service family public trong V1; dù vậy cơ chế quản trị content cần hỗ trợ family/page theo autonomy đã chốt |
| Intake Apps Script/Sheet `Yêu cầu` 15 cột, protection, validation, `onEdit` và tab **Tổng quan** đã có trong script; owner-run authorization/live verification và bàn giao Google còn **Chờ xác nhận** | Dashboard Next/Bagisto, API summary, request inbox Bagisto, đồng bộ order external |
| Tab `Chi tiết giỏ hàng` khóa theo `Mã` (A:I), chỉ đọc với administrator, do server/Apps Script ghi — đã có trong template | Trạng thái/phân công theo từng dòng giỏ; vận hành chỉ ở dòng `Yêu cầu` |
| CRM **optional**, ngoài đường tới hạn: hiện hoãn, nếu làm thì chỉ nhận bản sao sau khi Sheet ghi thành công | CRM là điều kiện bắt buộc để submit, hoặc CRM thay Sheet làm hàng đợi |
| Template Apps Script đã triển khai: administrator xử lý L:N; A:K/O và cấu trúc Sheet được bảo vệ. Owner-run authorization/live verification còn **Chờ xác nhận** | Xóa cứng dòng Sheet, merge/dedup engine |
| Bagisto admin native cho catalog, giá, tồn và policy B2B; dịch vụ mẫu đọc từ Bagisto CMS; một tài khoản administrator dùng chung | Mở rộng `/quan-tri`, `b2b_briefs`, `b2b_catalog_audits`, full audit |
| Ánh xạ CMS đã hoàn thành cho nội dung chính của `say-thuc-pham-say`; taxonomy/link tĩnh làm fallback có chủ ý | Mô tả toàn bộ service family/media là đã di trú khi chưa có nội dung được duyệt |
| Tiếng Việt, VND, giữ storefront/contact hiện có và thay giao diện dần | Đa kênh, đa locale, đa tiền tệ, promotion, redesign toàn diện |

Hiện `POST /api/contact` nhận cả `name, phone, email, message, source` và ngữ cảnh tùy chọn `product, service, variant, qty`. Server đọc catalog để xác thực ngữ cảnh sản phẩm, gán `request_type` theo ngưỡng và chỉ gửi giá trị canonical sang Apps Script; client-supplied `request_type` không quyết định loại. Template Apps Script thêm dòng/Mã riêng vào tab `Yêu cầu` với đúng 15 cột A:O, setup protection/validation, workflow `onEdit` và **Tổng quan**. Ngữ cảnh giỏ nhiều dòng và tab `Chi tiết giỏ hàng` là **Cần làm**: contract nhận danh sách dòng giỏ, server xác thực lại từng dòng với Bagisto và tự tính đơn giá/tạm tính, `Loại` lấy mức cao nhất của cả giỏ. Storefront/UI chưa nối ngữ cảnh sản phẩm/dịch vụ. Owner-run authorization, live verification và ownership/quyền kiểm soát Google vẫn **Chờ xác nhận**.

Custom B2B product policy fields phải xuất hiện trong màn hình product admin hiện có của Bagisto qua extension; không tạo UI quản trị mới hoặc mở rộng `/quan-tri`. No-code chỉ áp dụng vận hành dữ liệu/nội dung hằng ngày; đổi bố cục, điều hướng hoặc chức năng mới cần kỹ thuật và ngoài V1.

## 4. Sitemap đích

Sitemap là đích Lean V1, không suy diễn từ `docs/research/PAGE_TOPOLOGY.md`.

```text
/
├─ /san-pham                           Danh sách nhiều danh mục/sản phẩm; danh mục, tìm kiếm, lọc, sắp xếp, phân trang bằng query param
│  └─ /san-pham/[slug]                 Chi tiết, biến thể, giá bậc, số lượng, thêm vào giỏ, CTA form
├─ /gui-yeu-cau                        Giỏ hàng khách (localStorage) + form gửi yêu cầu; server xác thực lại với Bagisto
│  └─ POST /api/gui-yeu-cau/xac-thuc   Xác thực lại giỏ stateless, trả đơn giá/tạm tính canonical + snapshotToken
├─ /thue-gia-cong
│  └─ /thue-gia-cong/say-thuc-pham-say Dịch vụ đại diện, CTA form
├─ /lien-he                            Form chung, nhận ngữ cảnh sản phẩm/dịch vụ
├─ /gioi-thieu và storefront content được chỉ định editable
├─ Google Sheet (hàng đợi vận hành; owner hiện tại user/chủ dự án, owner cuối khách hàng)
│  ├─ tab Yêu cầu                      Dòng yêu cầu, trạng thái, người phụ trách, ghi chú
│  ├─ tab Chi tiết giỏ hàng            Dòng giỏ theo Mã, chỉ đọc, không mang trạng thái (Cần làm)
│  └─ tab Tổng quan                    Đếm Đơn mới và Yêu cầu mới
├─ /admin → Bagisto admin              Catalog, giá, tồn, policy B2B, CMS/content/media, một shared account
```

Danh mục dùng query param trên `/san-pham`, không tạo route con theo danh mục trong V1. Không có sitemap customer login/account/portal, `/gio-hang`, `/thanh-toan`, checkout, payment, shipping, order, quote, company, team, approval, dashboard vận hành riêng hoặc một màn hình quản trị mới. Route giỏ hàng duy nhất là `/gui-yeu-cau`; các đề xuất `/gio-hang` và `/thanh-toan` trong bộ handoff bị thay thế. Route dịch vụ giữ `/thue-gia-cong`; đề xuất `/dich-vu` trong bộ handoff cũng bị thay thế.

## 5. User flows ưu tiên

Các flow là đích Lean V1. Flow 5 đã có script setup/protection/validation/`onEdit`/ **Tổng quan**; owner-run authorization, live verification và handoff Google vẫn **Chờ xác nhận**.

1. **Sản phẩm, dưới ngưỡng → Đặt sản phẩm.** Khách duyệt `/san-pham` theo danh mục/tìm kiếm/lọc/sắp xếp, mở `/san-pham/[slug]`, chọn biến thể và nhập số lượng thỏa MOQ và bước số lượng. Storefront hiển thị giá bậc VND từ Bagisto. Dưới `contact_from_quantity`, CTA **Yêu cầu tư vấn đặt mua** mở `/lien-he`; phần **Cần làm** gửi `product`, `variant`, `qty`, nguồn và `request_type=Đặt sản phẩm` tới `/api/contact`. Mỗi submit được chấp nhận tạo một dòng Sheet riêng.
2. **Sản phẩm, từ ngưỡng → Tư vấn số lượng lớn.** Cùng quy tắc chọn; khi số lượng bằng hoặc lớn hơn ngưỡng, server thực thi quy tắc và CTA đổi thành **Liên hệ số lượng lớn**. Phần **Cần làm** gửi `request_type=Tư vấn số lượng lớn` cùng ngữ cảnh; mỗi submit được chấp nhận tạo một dòng Sheet riêng.
3. **Giỏ hàng khách → một yêu cầu nhiều dòng.** Khách thêm nhiều sản phẩm/biến thể vào giỏ; giỏ chỉ ghi ở `localStorage` (không tài khoản, không session server). Tại `/gui-yeu-cau`, server đọc lại Bagisto và xác thực từng dòng — tồn tại, còn bán, tồn kho, MOQ, bước số lượng, giá bậc — rồi hiển thị đơn giá và tạm tính do server tính; dòng sai được cảnh báo rõ và chặn gửi cho tới khi sửa. Khi gửi, server tự gán `Loại` theo mức cao nhất của cả giỏ: có bất kỳ dòng đạt `contact_from_quantity` thì **Tư vấn số lượng lớn**, nếu không thì **Đặt sản phẩm**. Một submit được chấp nhận tạo một `Mã` với một dòng `Yêu cầu` và N dòng `Chi tiết giỏ hàng` cùng `Mã`. Không tạo order, thanh toán hay giao hàng. Toàn bộ luồng này là **Cần làm**.
4. **Dịch vụ → Tư vấn dịch vụ.** Khách vào `/thue-gia-cong/say-thuc-pham-say`, đọc content public và gửi form. Phần **Cần làm** gửi `service=Sấy & thực phẩm sấy`, nguồn service và `request_type=Tư vấn dịch vụ`; mỗi submit được chấp nhận tạo một dòng riêng, không tạo brief hoặc Bagisto order.
5. **Administrator xử lý Sheet và bàn giao Google.** Sau khi chủ sở hữu chạy setup và xác minh live (đang **Chờ xác nhận**), administrator dùng một shared account để lọc các dòng **Mới**, điền **Người phụ trách** và chuyển **Đang tư vấn**, sau đó chỉ đi theo chuyển trạng thái ở phần 2. Administrator chỉ sửa L:N; template Apps Script cập nhật O; protection Sheet/range chặn xóa hoặc đổi thứ tự dòng/cột. Nếu đánh giá trùng, administrator chuyển **Không tiếp tục** và ghi `Trùng mã <reference>`. Tab **Tổng quan** đếm **Đơn mới** là `Loại=Đặt sản phẩm` + `Trạng thái=Mới`; **Yêu cầu mới** là hai loại tư vấn + `Trạng thái=Mới`. Hiện Sheet/Apps Script thuộc user/chủ dự án; trước bàn giao, chuyển ownership/quyền kiểm soát hoặc migration/redeploy sang Google/Workspace của khách và xác minh owner cuối.
6. **Administrator quản trị catalog, content và shared account.** Administrator dùng Bagisto admin để thêm/sửa/ẩn/sắp xếp sản phẩm, biến thể, giá, tồn, MOQ, bước số lượng, ngưỡng liên hệ; rồi kiểm tra storefront. Qua CMS/read API **Cần làm**, administrator cũng quản lý service family/page/content/media, homepage, thông tin doanh nghiệp và liên hệ được chỉ định editable. Sau audit Bagisto, người dùng shared account tự đổi/khôi phục mật khẩu hoặc chủ/ông chủ chuyển giao người sử dụng. Các field B2B nằm trong màn hình product admin hiện có qua extension; không dùng ghi thẳng MySQL hoặc endpoint `/quan-tri`/`operations/v1` mới.

## 6. Wireframe low-fi

Wireframe chỉ diễn tả các luồng ở phần 5, không tạo ngôn ngữ giao diện mới.

```text
[Danh sách sản phẩm /san-pham]
 Tìm kiếm | Danh mục (cha/con) | Lọc | Sắp xếp | Phân trang — tất cả đồng bộ query param
 Lưới thẻ sản phẩm: ảnh | tên | giá + đơn vị | quy cách | tồn kho | số lượng | [Thêm vào giỏ]
 Không rating, không review, không favorite

[Trang chi tiết /san-pham/[slug]]
 Tên | ảnh/nội dung được duyệt public
 Biến thể [...]   Số lượng [-  ___  +]   MOQ / bước / giá bậc VND / tạm tính
 [Thêm vào giỏ] → giỏ localStorage
 ├─ dưới ngưỡng: [Yêu cầu tư vấn đặt mua] → [Form: Loại=Đặt sản phẩm] → Sheet
 └─ từ ngưỡng : [Liên hệ số lượng lớn]   → [Form: Loại=Tư vấn số lượng lớn] → Sheet

[Giỏ hàng + gửi yêu cầu /gui-yeu-cau]  — Cần làm
 Dòng giỏ từ localStorage → server đọc lại Bagisto để xác thực và tính đơn giá/tạm tính
 Dòng sai (hết hàng | dưới MOQ | sai bước | đổi giá) được cảnh báo và chặn gửi
 Họ tên | Điện thoại | Email tùy chọn | Nội dung
 [Gửi yêu cầu] → một Mã: 1 dòng Yêu cầu + N dòng Chi tiết giỏ hàng
 Loại = mức cao nhất cả giỏ (có dòng đạt ngưỡng → Tư vấn số lượng lớn)
 Không thanh toán, không order, không giao hàng

[Trang dịch vụ: Sấy & thực phẩm sấy]
 Nội dung/media do CMS cấp sau phần Cần làm
 [Liên hệ dịch vụ] → [Form: Loại=Tư vấn dịch vụ] → Sheet

[Form liên hệ]
 Họ tên | Điện thoại | Email tùy chọn | Nội dung
 Ngữ cảnh chỉ đọc: sản phẩm / biến thể / số lượng hoặc dịch vụ, nếu có
 [Gửi yêu cầu] → Apps Script tạo Mã riêng → thêm một dòng Sheet

[Google Sheet]
 [Yêu cầu template] A:K,O khóa | L:N administrator sửa | dropdown Loại/Trạng thái
 Mới → Đang tư vấn → [Chờ khách phản hồi | Đã hoàn tất | Không tiếp tục]
 Trùng đã đánh giá → Không tiếp tục + Ghi chú “Trùng mã <reference>”
 [Chi tiết giỏ hàng — Cần làm] khóa theo Mã | toàn bộ cột khóa | chỉ đọc | không trạng thái
 [Tổng quan template] Đơn mới | Yêu cầu mới
 Owner hiện tại: user/chủ dự án → bàn giao: Google/Workspace do khách kiểm soát

[Bagisto admin]
 Màn hình product hiện có + extension policy B2B | catalog | giá | tồn | CMS/content/media
 Một shared account: đổi/khôi phục mật khẩu hoặc chuyển giao người dùng sau audit
```

## 7. ERD tối thiểu và ranh giới dữ liệu

Bagisto core được đọc/ghi qua service, repository hoặc API Bagisto; code mới không ghi trực tiếp bảng core. `b2b_product_configs` là cấu hình B2B hiện có theo biến thể. Google Sheets là đích duy nhất của hàng đợi yêu cầu. Không thiết kế bảng khách, cart, checkout, payment, shipping hoặc order cho website V1: giỏ hàng khách chỉ tồn tại ở `localStorage` trình duyệt và, sau khi gửi, ở các dòng `Chi tiết giỏ hàng`.

Trong sơ đồ dưới, Apps Script intake, schema 15 cột A:O tab `Yêu cầu`, protection A:K/O với L:N, `onEdit` và **Tổng quan** đã có trong script; tab `Chi tiết giỏ hàng` là **Cần làm**; handoff/authorization/live verification Google vẫn **Chờ xác nhận**.

```text
Bagisto core (qua service/repository/admin UI hiện có)
  categories (cha) 1 ── * categories (con) 1 ── * products
  products (parent) 1 ── * products (variant)
  products (variant) 1 ── 0..1 b2b_product_configs
                                  ├─ unit
                                  ├─ moq
                                  ├─ quantity_step
                                  └─ contact_from_quantity
  products/variants ── giá bậc, tồn kho (core Bagisto)

Giỏ hàng khách — không có bảng, không có state phía server
  browser localStorage "giacong.request-cart.v1" (schemaVersion 1, tối đa 20 dòng, 32 KB)
    [{ parentSlug, variantSku, quantity }]  ← chỉ để preview; không PII, không giá, không tổng tiền
    đọc lại từ storage luôn được coi là untrusted: sai schema → reset, dòng lỗi → drop
  POST /api/gui-yeu-cau/xac-thuc ──đọc lại Bagisto──> xác thực từng dòng + đơn giá/tạm tính canonical
  POST /api/contact (JSON)       ──đọc lại Bagisto──> xác thực lại lần hai + so snapshotToken
                                    client-supplied giá/tổng tiền/loại bị từ chối, không bao giờ được đọc

Bagisto CMS/content model — Cần làm, sau audit
  service family/page/content/media ──> Next storefront read API
  homepage/business/contact designated content ──> Next storefront read API

Next storefront ──đọc qua API──> Bagisto catalog + policy B2B + content sau Cần làm
Next POST /api/contact ──webhook──> Apps Script (owner hiện tại: user/chủ dự án) ──> Google Sheet / “Yêu cầu”
                                       trước bàn giao: chuyển ownership/quyền kiểm soát hoặc migration/redeploy → Google/Workspace khách
                                       createReference() tạo Mã riêng cho mỗi submit được chấp nhận
                                      A Mã | B Thời gian | C Loại | D Sản phẩm/Dịch vụ
                                      E Biến thể | F Số lượng | G Họ tên | H Điện thoại | I Email
                                      J Nội dung | K Nguồn | L Trạng thái | M Người phụ trách
                                      N Ghi chú | O Cập nhật lần cuối
                                      A:K,O bảo vệ; L:N administrator sửa

Google Sheet / “Chi tiết giỏ hàng” — đã triển khai trong template (live verification Chờ xác nhận)
  Yêu cầu.Mã 1 ── * Chi tiết giỏ hàng.Mã           (submit giỏ nhiều dòng)
  A Mã | B Dòng | C Sản phẩm | D Biến thể | E Đơn vị | F Số lượng | G Đơn giá | H Thành tiền | I Ghi chú hệ thống
  Toàn bộ cột do server/Apps Script ghi và được bảo vệ; không trạng thái/phân công theo dòng
  Thứ tự ghi: N dòng chi tiết bằng một setValues, rồi dòng Yêu cầu làm commit marker
  LockService tryLock(2000ms) < abort 5s của Next; CacheService map request_id → Mã chống retry trùng

Google Sheet / “Tổng quan”
  Đơn mới     = COUNTIFS('Yêu cầu'!C:C, “Đặt sản phẩm”, 'Yêu cầu'!L:L, “Mới”)
  Yêu cầu mới = COUNTIFS('Yêu cầu'!C:C, “Tư vấn số lượng lớn”, 'Yêu cầu'!L:L, “Mới”)
               + COUNTIFS('Yêu cầu'!C:C, “Tư vấn dịch vụ”, 'Yêu cầu'!L:L, “Mới”)

Đã loại khỏi mã nguồn: b2b_briefs; b2b_catalog_audits
```

`Mã` là mã tham chiếu riêng do Apps Script tạo khi thêm dòng và là khóa liên kết duy nhất giữa `Yêu cầu` và `Chi tiết giỏ hàng`. Với submit giỏ nhiều dòng, dòng `Yêu cầu` ghi tổng hợp ở D (`Giỏ hàng (N dòng)`) và để trống E:F; chi tiết từng dòng nằm ở tab `Chi tiết giỏ hàng`. Với submit một mặt hàng từ trang chi tiết, D:F giữ nguyên hành vi hiện tại. Schema 15 cột A:O không đổi. Migration hiện chỉ ép tối đa một `b2b_product_configs` cho mỗi `product_id`; nó không ép mọi variant phải có config nên quan hệ là `0..1`. Nếu một yêu cầu bị đánh giá trùng, dòng vẫn giữ nguyên, được đánh dấu kết thúc với ghi chú tham chiếu; không hợp nhất dữ liệu và không có dedup engine.

## 8. API và trạng thái chuyển tiếp

Trạng thái chính của mỗi route hoặc bề mặt chỉ là **Hiện có**, **Chuyển tiếp**, **Cần làm** hoặc **Đóng băng**. Với BFF Next, `502/504` là lỗi upstream không sẵn sàng/quá thời gian.

| Phương thức / loại bề mặt | Đường dẫn / đích | Người dùng | Hiện có | Cần làm / ranh giới V1 | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/contact` | Khách | Hai nhánh theo `Content-Type`. **FormData** (giữ nguyên): base fields và context tùy chọn `product?, service?, variant?, qty?`; server xác thực catalog, tự gán loại theo MOQ/step/ngưỡng. **JSON** (giỏ nhiều dòng): `{ name, phone, email, message, source, requestId, snapshotToken, lines[] }` — server đọc lại Bagisto, tự tính đơn giá/thành tiền/tạm tính, gán `Loại` theo mức cao nhất cả giỏ, ghi `Giỏ hàng (N dòng)` vào D và để trống E:F. Body tối đa 64 KB; `requestId` là UUID v4; lệch `snapshotToken` → `409 CART_DRIFTED` kèm snapshot mới; dòng sai → `409 CART_NOT_SUBMITTABLE`. Payload mang giá/tổng tiền/`request_type` do client gửi bị từ chối `400`. Apps Script tạo Mã/dòng riêng đúng 15 cột A:O trong `Yêu cầu` + N dòng `Chi tiết giỏ hàng` cùng `Mã`; URL/secret chỉ ở server. | Nối context và giỏ từ storefront/UI. Owner-run authorization, ownership/quyền kiểm soát và live verification Google còn **Chờ xác nhận**. Không tạo Bagisto order, không dedup/merge. | Chuyển tiếp |
| POST | `/api/gui-yeu-cau/xac-thuc` | Khách | Xác thực lại giỏ stateless: nhận `{ lines: [{ parentSlug, variantSku, quantity }] }`, đọc Bagisto một lần cho mỗi `parentSlug`, trả `ResolvedCart` gồm đơn giá/thành tiền/tạm tính canonical, `adjustments` theo dòng (`PRODUCT_NOT_FOUND`, `VARIANT_NOT_FOUND`, `VARIANT_UNAVAILABLE`, `QUANTITY_BELOW_MOQ`, `QUANTITY_OFF_STEP`, `PRICE_ON_REQUEST`) và `snapshotToken`. Không lưu giỏ phía server, không state, không tạo order. Body tối đa 16 KB, tối đa 20 dòng. | Nối UI `/gui-yeu-cau` vào endpoint này. | Hiện có |
| GET | `/api/catalog/products/[slug]` | Khách | BFF catalog hiện có cho product/variant/rules | Giữ BFF cho product flow; xác thực MOQ/bước/ngưỡng ở server. | Hiện có |
| GET | `/api/b2b/catalog/categories`, `/api/b2b/catalog/products`, `/api/b2b/catalog/products/{slug}` | Storefront | Nguồn catalog B2B hiện có | Nguồn đọc cho catalog nhiều danh mục/sản phẩm; cần hỗ trợ tìm kiếm, lọc, sắp xếp, phân trang server-side. Không biến thành CMS dịch vụ. | Chuyển tiếp |
| GET | `/api/b2b/services/{slug}` | Storefront | Đọc page native CMS theo channel/locale; dịch vụ mẫu cấp `name`, `summary`, `description`, `meta_title`; 404 dùng fallback tĩnh có chủ ý ở Next | Di trú thêm taxonomy/link/media hoặc service family khác chỉ khi nội dung được duyệt. | Hiện có |
| Màn quản trị | Bagisto admin › Sản phẩm (màn hình hiện có) | Administrator | Extension policy B2B (unit, MOQ, step, threshold) đã nằm trong form biến thể simple; Admin save → API → storefront đã kiểm thử | Dữ liệu production vẫn **Chờ xác nhận**; không UI quản trị mới, không direct core writes. | Hiện có |
| Màn quản trị | Bagisto admin › CMS/content | Administrator | Dịch vụ mẫu `say-thuc-pham-say` đã được tạo/sửa bằng CMS native và cấp cho Next | Taxonomy/link/media, homepage/business/contact và các trang ngoài mẫu vẫn **Cần làm** sau khi nội dung được duyệt. | Chuyển tiếp |
| Màn quản trị | Bagisto admin › Một tài khoản `administrator` dùng chung (cần audit) | Administrator | Chưa xác nhận bề mặt/quy trình native cho đổi/khôi phục mật khẩu hoặc chuyển giao người dùng | Audit, cấu hình và bàn giao quy trình đổi/khôi phục mật khẩu hoặc chuyển giao người dùng cho đúng một shared account; không tạo/vô hiệu hóa nhiều tài khoản, không granular RBAC hoặc UI mới. | Cần làm |
| GET, POST, PUT | `/api/operations/v1/products...` | Không dùng V1 | Chỉ có ở nhánh sạch chưa merge theo bằng chứng hiện có | Không làm/không merge cho V1. | Đóng băng |

Không có API checkout, cart có state, order, payment, shipping, rating/review/favorite, đồng bộ order external hoặc API summary trong V1. API liên quan giỏ hàng chỉ được đọc và xác thực, không lưu giỏ. Nếu làm CRM optional, nó là hiệu ứng phụ sau khi Sheet ghi thành công và lỗi CRM không chặn submit. Không hứa một endpoint CMS cụ thể trước khi audit Bagisto và integration cần thiết.

## 9. Công việc, vai trò và phụ thuộc

| Công việc | Owner | Trạng thái | Phụ thuộc | Deliverable |
| --- | --- | --- | --- | --- |
| Xác thực dữ liệu public: taxonomy danh mục, sản phẩm, trust claim, asset và kênh liên hệ | Người quyết định sản phẩm | Chưa bắt đầu | Taxonomy, SKU, ảnh, nội dung, giá thật **Chờ xác nhận**; nhóm demo (trust claim, asset, Zalo/Messenger/email/hotline) cần xác nhận và thay | Dữ liệu được duyệt, không dùng `B2B-DEMO` hay dữ liệu demo public |
| Chuẩn hóa catalog nhiều danh mục/sản phẩm, giá bậc, CTA và server validation | Terra implement | Hoàn thành lát cắt demo | Dữ liệu public, quy tắc Bagisto | Bagisto là nguồn canonical cho giá bậc, MOQ, bước số lượng, tồn và ngưỡng; batch resolve được dùng cả khi xem lại lẫn khi submit giỏ. Còn catalog production và dữ liệu public thật **Chờ xác nhận**. |
| Guest cart `localStorage` và `/gui-yeu-cau` | Terra implement | Hoàn thành lát cắt demo | App-layer contract đã lock; catalog read API | Storage versioned có sanitize, nút giỏ nổi, trang giỏ + form, `POST /api/gui-yeu-cau/xac-thuc`, đơn giá/tạm tính canonical và cảnh báo dòng sai đã được kiểm thử. Đã có một submit giỏ thử được Apps Script chấp nhận; owner vẫn cần kiểm tra trực quan dòng `Yêu cầu` và dòng `Chi tiết giỏ hàng` trong Sheet. Không cart phía server, không checkout. |
| Một hostname cho storefront + Bagisto | Terra implement | Hoàn thành local | Next proxy `/admin`, `/api/b2b` và asset Bagisto tới backend nội bộ | Storefront và Admin cùng origin `localhost:4317`; Bagisto chỉ công khai loopback `127.0.0.1:18001`; cổng `8081` đã loại bỏ. Khi production, thay origin public bằng tên miền HTTPS và dùng hostname service Bagisto trong private network. |
| Mở rộng `/api/contact` và Apps Script/Sheet | Terra implement | Hoàn thành lát cắt demo | Contract mới; giai đoạn hiện tại dùng Google account của user/chủ dự án | Backend validation/derivation và tab `Yêu cầu` 15 cột với Mã riêng; template script đã triển khai protection, dropdown, workflow và Tổng quan. Webhook Apps Script đã chấp nhận một form thử và một giỏ thử. Owner vẫn cần kiểm tra trực quan cột/trạng thái/protection và xác nhận quyền kiểm soát Google trước bàn giao. |
| Tab `Chi tiết giỏ hàng` khóa theo `Mã` | Terra implement | Hoàn thành trong template | Contract giỏ hàng; owner chạy lại `setupRequestWorkbook()` | Template ghi N dòng chi tiết cùng `Mã` (A:I), bảo vệ toàn bộ cột không có vùng vận hành, giữ nguyên schema A:O của `Yêu cầu`. Owner-run authorization/live verification **Chờ xác nhận** |
| Cấu hình vận hành Sheet và bàn giao quyền Google | Terra implement + chủ sở hữu | **Chờ xác nhận** | Audit Google; tài khoản Google/Workspace khách cần sẵn sàng trước bàn giao | Template đã có dropdown, A:K/O protection, L:N editable và workflow; khách/chủ sở hữu phải mở/sửa/deploy Apps Script, chạy setup, kiểm tra protection/dropdown và xác nhận ownership/quyền kiểm soát cuối cùng hoặc migration/redeploy |
| Mở rộng Bagisto product admin cho policy B2B | Terra implement | Hoàn thành lát cắt V1 | Dữ liệu production còn **Chờ xác nhận** | Unit/MOQ/step/threshold trong form biến thể simple; validation hiển thị đúng field; Admin save → storefront đã kiểm thử |
| Audit, cấu hình và bàn giao một shared account `administrator` | Terra implement + chủ/ông chủ | Chưa bắt đầu | Audit Bagisto admin | Hướng dẫn và kiểm thử đổi/khôi phục mật khẩu hoặc chuyển giao người dùng theo quy trình native; không tạo/vô hiệu hóa nhiều tài khoản, không granular RBAC/UI mới |
| Di trú/ánh xạ serviceFamilies và captured content | Terra implement + người duyệt nội dung | Hoàn thành dịch vụ mẫu | Nội dung thật cho các trang còn lại **Chờ xác nhận** | `say-thuc-pham-say` đã đọc title/summary/description từ native CMS; taxonomy/link fallback tĩnh; media và content khác **Cần làm** khi được duyệt |
| Loại bỏ `/quan-tri` và API quản trị B2B cũ | Terra implement | Hoàn thành | Bagisto Admin native | Không còn bề mặt quản trị Next, BFF quản trị hoặc `/api/b2b/admin/v1/*` |
| Bàn giao autonomy vận hành hằng ngày | Terra implement + chủ/ông chủ | Chưa bắt đầu | Catalog/content/Sheet/account và Google handoff hoàn tất | Hướng dẫn vận hành data/content/Sheet; bố cục, điều hướng và chức năng mới vẫn cần kỹ thuật, ngoài V1 |
| Kiểm thử và bàn giao | Terra implement | Chưa bắt đầu | Các mục trên | Bằng chứng phần 10, không push |

Terra là vai trò triển khai. Thay đổi hành vi bắt đầu bằng test RED, rồi code GREEN tối thiểu, sau đó lint, typecheck, build và review phù hợp. Không có task nào được hiểu là quyền ghi trực tiếp bảng core Bagisto.

## 10. Acceptance criteria có thể kiểm thử

| MVP | Tiêu chí chấp nhận |
| --- | --- |
| Scope sản phẩm | Catalog nhiều danh mục và nhiều sản phẩm đọc từ Bagisto; danh sách có tìm kiếm, lọc, sắp xếp, phân trang đồng bộ query param và giữ trạng thái khi reload. Taxonomy, SKU, ảnh, nội dung và giá thật còn **Chờ xác nhận** phải được duyệt trước public; không hard-code catalog trong component. |
| Giá và quy tắc số lượng | Storefront đọc MOQ, bước số lượng, giá bậc VND và `contact_from_quantity` từ Bagisto. Số lượng dưới MOQ hoặc sai bước bị chặn cả client/server. |
| Guest cart và `/gui-yeu-cau` | Giỏ chỉ ghi ở `localStorage` khóa `giacong.request-cart.v1`, không tài khoản khách, không state server, không bảng cart. Storage chỉ mang `parentSlug`, `variantSku`, `quantity` — không PII, không giá, không tổng tiền — và nội dung đọc lại luôn được sanitize như untrusted input (sai schema → reset, dòng lỗi → drop, quá 20 dòng hoặc 32 KB → cắt/reset). `/gui-yeu-cau` là route giỏ hàng duy nhất; không có `/gio-hang` hay `/thanh-toan`. Ở production, cả `POST /api/gui-yeu-cau/xac-thuc` và submit gọi một batch resolver của Bagisto để tự tính đơn giá/thành tiền/tạm tính; payload mang giá hoặc tổng tiền do client gửi bị từ chối `400`. Dòng hết hàng, dưới MOQ, sai bước hoặc đổi giá được cảnh báo và chặn gửi tới khi sửa. Demo fixture là fallback có chủ ý ngoài production. |
| Yêu cầu nhiều dòng | Một submit giỏ được chấp nhận tạo một `Mã` với đúng một dòng `Yêu cầu` và N dòng `Chi tiết giỏ hàng` cùng `Mã`. `Loại` do server gán theo mức cao nhất cả giỏ: có dòng đạt ngưỡng → **Tư vấn số lượng lớn**, ngược lại **Đặt sản phẩm**. Dòng `Yêu cầu` ghi `Giỏ hàng (N dòng)` ở D và để trống E:F; schema 15 cột A:O không đổi. Apps Script ghi N dòng chi tiết trước rồi dòng `Yêu cầu` làm commit marker, giữ `LockService.tryLock(2000ms)` dưới ngưỡng abort 5s của Next, và trả lại đúng `Mã` cũ khi cùng `request_id` được gửi lại. Không tạo order/thanh toán/giao hàng. |
| Không rating/review/favorite | Không có UI, data model, API hay structured data cho rating, review, favorite ở bất kỳ bề mặt nào, kể cả khi bộ handoff mô tả. |
| Nội dung demo | Trust claim demo và asset demo được phép ở giai đoạn hiện tại và được đánh dấu là tạm thời. Kênh liên hệ demo đúng giá trị đã chốt: Zalo `06408115`, Messenger `https://m.me/qtudepdai`, email `qtu1053@gmail.com`, hotline `0868408115`. Trước khi duyệt public, chủ dự án xác nhận và thay bằng dữ liệu thật. |
| Hai product flows | Khi nhận product/variant/qty, server chặn MOQ/bước và gán dưới ngưỡng là **Đặt sản phẩm**, bằng/trên ngưỡng là **Tư vấn số lượng lớn**; không tạo báo giá hoặc Bagisto order. Storefront/UI chưa gửi ngữ cảnh này. |
| Service flow | Server chỉ chấp nhận service slug `say-thuc-pham-say` và gán **Tư vấn dịch vụ**, không tạo brief/order. Storefront/UI CTA chưa nối ngữ cảnh service vào contract. |
| Contact → Sheet | Contract backend được kiểm thử cho `request_type`, `product`, `service`, `variant`, `qty`, cùng gán loại server; Apps Script tạo Mã riêng và thêm đúng 15 cột. URL/secret chỉ ở server; không fallback Bagisto. Việc nối ngữ cảnh storefront/UI vẫn **Cần làm**. |
| Submit trùng | Mỗi submit được chấp nhận tạo `Mã` riêng và đúng một dòng `Yêu cầu`. Không có merge/dedup engine. Administrator có thể đặt **Không tiếp tục** và ghi chính xác `Trùng mã <reference>`. |
| Hàng đợi Sheet | Tab `Yêu cầu` có schema A:O và dòng mới đặt **Mới**/để trống M:N; template Apps Script đã triển khai protection A:K/O, quyền sửa L:N và dropdown. Owner-run authorization/live verification vẫn **Chờ xác nhận**. |
| Tab `Chi tiết giỏ hàng` | Tồn tại như tab thứ hai khóa theo `Mã`; toàn bộ cột do server/Apps Script ghi và được bảo vệ; administrator chỉ đọc và không có trạng thái/phân công theo dòng. Vận hành vẫn chỉ diễn ra ở L:N của `Yêu cầu`. |
| CRM optional | Nếu chưa làm, không có tham chiếu CRM nào trong contract hay UI. Nếu làm, CRM chỉ nhận bản sao sau khi Sheet ghi thành công, lỗi CRM không chặn submit và Sheet vẫn là hàng đợi vận hành duy nhất. |
| Trạng thái và Tổng quan | Script đã có transition `onEdit` và tab **Tổng quan**; owner-run authorization/live verification vẫn **Chờ xác nhận**; không có dashboard Next/Bagisto hay API summary. |
| Autonomy catalog | Administrator trong Bagisto admin có thể thêm/sửa/ẩn/sắp xếp product/variant, giá, stock, MOQ, step, threshold bằng màn hình product hiện có được extension. Không direct core write, không UI `/quan-tri` mới. |
| Autonomy tài khoản | Có đúng một shared account `administrator` do chủ/ông chủ giao cho một người sử dụng. Sau audit/cấu hình, bằng chứng kiểm thử xác nhận người dùng đổi/khôi phục mật khẩu hoặc chủ/ông chủ chuyển giao người dùng theo quy trình Bagisto native đã audit. Không tạo/vô hiệu hóa nhiều tài khoản, không granular RBAC hoặc UI quản trị Next.js. |
| Autonomy content | `say-thuc-pham-say` đã sửa title/summary/description trong Bagisto CMS và hiện ở storefront. Taxonomy/link fallback, media, homepage/business/contact và các trang ngoài mẫu vẫn **Cần làm**; không mô tả chúng là đã di trú. |
| Ranh giới no-code | Administrator vận hành dữ liệu/nội dung hằng ngày không cần lập trình viên: sản phẩm, biến thể, giá, tồn, ngưỡng, content/media/liên hệ và Sheet. Đổi bố cục, điều hướng hoặc chức năng mới cần kỹ thuật, ngoài V1; không có page builder. |
| Bàn giao Google | Giai đoạn hiện tại Sheet/Apps Script thuộc Google account của user/chủ dự án. Trước bàn giao, checklist và bằng chứng kiểm thử xác nhận Google/Workspace khách mở/sửa Sheet, cấu hình protection/dropdown, mở/sửa/deploy Apps Script và là bên kiểm soát cuối cùng; user/chủ dự án không còn là bên kiểm soát duy nhất. Ownership/quyền kiểm soát được chuyển; nếu không thể chuyển trực tiếp sau audit Google, project/Sheet được migration/redeploy dưới quyền khách. Tài liệu không ghi email/tên tài khoản. |
| Ranh giới vĩnh viễn | Không có customer account/portal, checkout, `/thanh-toan`, cart phía server, tạo Bagisto order, payment, shipping, order completion, quote engine, rating/review/favorite hay API tương ứng. Guest cart chỉ là preview `localStorage` + xác thực lại phía server. Không ghi trực tiếp bảng core Bagisto. Không tạo lại `/quan-tri`, BFF quản trị hoặc API quản trị B2B riêng. |
| Chất lượng bàn giao | Focused tests, lint, typecheck, build và review chạy theo thay đổi thực tế; `git diff --check` không lỗi; không push. |

### Câu hỏi ưu tiên kế tiếp

Không có câu hỏi ưu tiên mới. Quyết định một shared account `administrator`, ranh giới no-code hằng ngày, bàn giao Google cho khách, catalog nhiều danh mục/sản phẩm, guest cart `localStorage` với `/gui-yeu-cau`, xác thực lại phía server, hai tab Sheet khóa theo `Mã`, bỏ rating/review/favorite và cho phép nội dung demo tạm thời đều đã khóa. Còn **Chờ xác nhận** trước public: taxonomy/SKU/ảnh/nội dung/giá production thật, nhóm dữ liệu demo (trust claim, asset, kênh liên hệ) và bàn giao quyền Google. CRM là **optional**, chỉ chốt khi chủ dự án yêu cầu; không lặp lại thành câu hỏi ở nhóm này.

## 11. Ranh giới frontend và backend

Ranh giới này chia công việc theo luồng, **không** chia theo thư mục: cây thư mục giữ nguyên. Lý do là `bagisto/` đã là repo git riêng (junction, bị `.gitignore` loại trừ) và bên trong `src/` biên đã được ngôn ngữ tự chặn bằng `import "server-only"`. Dời `src/` sang `frontend/` sẽ phải sửa `tsconfig.json`, `components.json`, `eslint.config.mjs`, `Dockerfile`, `docker-compose.yml`, `.dockerignore` và 16 file trong `scripts/` đang import theo đường dẫn tương đối, trong khi chức năng không đổi.

| Luồng | Sở hữu |
| --- | --- |
| FE | `src/app/**` trừ `api/`, `src/components/**`, `src/styles/**`, `src/app/globals.css`, `src/app/(storefront)/captured-layers.css`, `public/styles/**`, `src/data/pages/**` |
| BE | `src/app/api/**`, các module `server-only` trong `src/lib/`, `bagisto/` |

Các module `server-only` (không client component nào import được): `bagisto-api.ts`, `bagisto-catalog.ts`, `catalog-detail-source.ts`, `commerce-nav.ts`, `request-cart-resolver.ts`.

Hai module thuộc BE nhưng **cố ý không** mang `server-only` vì test Node import trực tiếp qua `--experimental-strip-types`: `contact-webhook.ts` và `request-cart.ts`. Comment đầu file đã ghi lý do; đừng thêm `server-only` vào chúng.

### File chung biên, phải sửa theo cặp

| Cặp | Vì sao |
| --- | --- |
| `src/lib/contact-webhook.ts` ↔ `src/components/contact-form.ts` và form liên hệ React | Contract `/api/contact` dùng slug sản phẩm + SKU biến thể; đổi một bên là 400 ở bên kia |
| `src/lib/request-cart-resolver.ts` ↔ `src/lib/request-cart-client.ts` | Hình dạng `ResolvedCart` và `snapshotToken` |
| `src/lib/commerce-nav.ts` ↔ `src/components/commerce/commerce-navigation.ts` | Dữ liệu điều hướng đọc ở server, dựng menu ở client |

### Lệnh theo luồng

`npm run check` vẫn là cổng đầy đủ và là điều kiện để kết thúc mỗi pha. Hai lệnh dưới chỉ để chạy nhanh trong lúc làm:

- `npm run check:fe` — test commerce/header/listing/detail/catalog-purchase-ui, lint, typecheck
- `npm run check:be` — test contact/catalog/service, lint, typecheck

Cả hai đều **không** bao gồm harness `qa:*`. Các bộ Playwright là thứ duy nhất bắt được hồi quy chrome, nên phải chạy riêng theo từng pha.

## 12. Kế hoạch backend Bagisto tiếp theo

Thực hiện theo thứ tự dưới đây; không vô hiệu hóa thêm package Webkul trước khi chức năng thay thế và kiểm thử tương ứng đã đạt.

| Pha | Phạm vi | Điều kiện hoàn thành |
| --- | --- | --- |
| 0. Khóa baseline | **Hoàn thành demo.** Docker/Bagisto, test catalog và `ProductConfig`, route quản trị B2B/brief cũ `404`, route catalog và ranh giới Shop frontend đã được kiểm tra. Runtime chỉ giữ một origin public; `8081` đã bỏ. | Không dùng dữ liệu thật; không xóa bảng trực tiếp; toàn bộ test backend hiện có đạt. |
| 1. Bagisto Admin native | **Hoàn thành lát cắt demo.** MOQ, bước số lượng, ngưỡng liên hệ và field B2B cần thiết đã gắn vào product/variant native. Giữ auth, media, category, inventory và trạng thái sản phẩm theo Bagisto native. | Một `administrator` vận hành trọn catalog demo trong Bagisto Admin; không direct core-table write và không UI quản trị mới. |
| 2. Domain catalog và giỏ | **Hoàn thành lát cắt demo.** `CatalogCartResolver` trong Acme B2b quyết định giá bậc, MOQ, bước số lượng, tồn, ngưỡng và snapshot qua `POST /api/b2b/catalog/resolve-cart`; `CatalogService::findProducts()` đọc các parent theo batch. Next gọi cùng batch resolver khi xem lại và submit giỏ; demo fixture vẫn là fallback ngoài production. | Next không quyết định giá/trạng thái gửi ở production; client không thể giả giá/tổng; test contract, batch query và kiểm tra HTTP xác nhận snapshot/giá của Next khớp Bagisto. |
| 3. Intake yêu cầu | Trước khi code, chốt một nguồn sự thật: khuyến nghị Bagisto lưu yêu cầu + dòng yêu cầu + idempotency, còn Google Sheet là bản sao vận hành qua outbox/webhook. Nếu tiếp tục để Sheet làm nguồn chính, giữ contract hiện tại và không tạo model Bagisto trùng lặp. | Có một nguồn sự thật duy nhất, retry không nhân bản yêu cầu, email bắt buộc và các kênh SMS/Zalo dùng cùng dữ liệu canonical. |
| 4. Nội dung vận hành | Ánh xạ có chọn lọc homepage, service family/page, media và thông tin liên hệ sang Bagisto CMS/read API; tiếp tục dùng dữ liệu demo cho tới khi dữ liệu thật được duyệt. | Administrator sửa nội dung chỉ trong Bagisto Admin; storefront không hard-code nội dung đã chọn quản trị. |
| 5. Làm gọn runtime | **Đang làm từng lát cắt.** Shop frontend đã bị chặn, cổng `8081` và artifact kiểm thử tạm đã loại bỏ. Tiếp tục dựa trên dependency graph và test trước khi vô hiệu hóa customer account, checkout/cart server, sales/order, payment, shipping, review/wishlist hoặc dịch vụ hạ tầng không dùng. | Bagisto Admin, catalog API, request intake và CMS vẫn đạt test; không xóa vật lý package upstream khi còn dependency. |

Ưu tiên triển khai tiếp theo là **owner-run verification Google Sheet**, sau đó Pha 4 nội dung vận hành. Pha 3 chỉ mở lại khi chủ dự án muốn đổi nguồn sự thật khỏi Google Sheet; cho tới lúc đó Sheet vẫn là nguồn chính và không tạo model yêu cầu trùng trong Bagisto. Pha 5 tiếp tục theo lát cắt nhỏ sau mỗi vòng dependency/test, không xóa package upstream hàng loạt.
