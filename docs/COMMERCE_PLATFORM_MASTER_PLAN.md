# Hồ sơ sản phẩm và kỹ thuật — Lean V1

**Trạng thái:** nguồn quyết định hiện hành và hồ sơ Lean V1 duy nhất.
**Ranh giới tài liệu:** [BAGISTO_HEADLESS_MVP.md](./BAGISTO_HEADLESS_MVP.md) chỉ là lưu trữ; [GOOGLE_SHEETS_CONTACT_WEBHOOK.md](./GOOGLE_SHEETS_CONTACT_WEBHOOK.md) chỉ là hướng dẫn vận hành webhook. `docs/research/PAGE_TOPOLOGY.md` mô tả bố cục trang clone, **không phải** sitemap đích.
**Ranh giới triển khai:** không sửa code/UI/Bagisto trong hồ sơ này; không ghi trực tiếp vào bảng core Bagisto; không điều khiển hay đổi cấu hình cổng `3000`, `8000`, `8001`. Backend Bagisto nội bộ dùng `127.0.0.1:18001`. Không push.

## 1. Bài toán Lean V1

Lean V1 phục vụ khách B2B đang cần tìm hiểu, mua một sản phẩm tiêu chuẩn theo số lượng hoặc gửi yêu cầu gia công. Khách cần biết nhanh sản phẩm có những biến thể nào, số lượng tối thiểu, bước đặt hàng, giá theo số lượng bằng VND và khi nào phải chuyển sang liên hệ. Với dịch vụ gia công, khách cần một trang đủ rõ để mô tả nhu cầu cơ bản và gửi thông tin liên hệ, thay vì bị dẫn vào một biểu mẫu dài hay một quy trình phức tạp. Website tiếp tục dùng tiếng Việt, giữ storefront và nội dung liên hệ hiện tại; phần giao diện captured được thay dần sau, không redesign đồng loạt.

V1 chỉ chứng minh hai việc có ích cho vận hành. Việc thứ nhất là một **product family đại diện — Chờ xác nhận** có thể đi từ xem sản phẩm, chọn biến thể và số lượng đúng quy tắc, đến đặt mua trực tiếp khi số lượng dưới ngưỡng liên hệ. Việc thứ hai là một **service family đại diện — Chờ xác nhận** có thể đưa khách đến liên hệ, ghi yêu cầu vào Google Sheets và để nhân viên xử lý. Giá theo số lượng, MOQ, bước số lượng và ngưỡng liên hệ là dữ liệu thương mại của Bagisto. Khi lượng khách chọn đạt ngưỡng cấu hình, storefront không tính hay tạo báo giá; nó mở liên hệ với ngữ cảnh sản phẩm, biến thể và số lượng đã chọn.

Vận hành phải có một nơi sở hữu dữ liệu rõ ràng. Bagisto admin là back office dài hạn cho sản phẩm, giá, tồn kho, đơn hàng và hai loại tài khoản nội bộ cố định. Google Sheets là hàng đợi yêu cầu liên hệ, không phải inbox Bagisto. Dashboard V1 chỉ cần hai số: yêu cầu mới và đơn mới. Cách lấy số yêu cầu mới từ Sheet bằng link hay API đếm là **Chờ xác nhận**; trạng thái xử lý trong Sheet cũng là **Chờ xác nhận**. Mục tiêu là nhân viên biết có việc mới và biết xử lý ở đâu, không tạo một hệ thống vận hành song song trong Next.js.

Một V1 thành công khi khách có thể xem và chọn đúng dữ liệu thực; số lượng dưới ngưỡng đi vào luồng mua trực tiếp; số lượng từ ngưỡng đi vào luồng liên hệ có đủ ngữ cảnh; yêu cầu dịch vụ tạo đúng một dòng Sheet; nhân viên thấy yêu cầu mới và đơn mới; quản trị viên cập nhật được dữ liệu sản phẩm theo quyền đã chốt; và các luồng đó có tiêu chí nghiệm thu cụ thể ở phần 10. Hình thức thanh toán, giao hàng và trạng thái nào được coi là hoàn tất đơn đều **Chờ xác nhận**, nên V1 không được tự gán trạng thái hoặc hứa một phương thức chưa được duyệt. Khách mua không tài khoản hay có tài khoản cũng **Chờ xác nhận**.

Ngoài phạm vi V1 là quote engine, vòng đời báo giá, chuyển báo giá thành đơn, company account, team, phê duyệt, phân quyền chi tiết, audit đầy đủ, inbox yêu cầu trong Bagisto, nhiều service family, wizard gia công phức tạp, tệp đính kèm, BOM/nguyên liệu/QC/tiến độ xưởng, đa kênh, đa ngôn ngữ, đa tiền tệ, cổng thanh toán, hãng vận chuyển, khuyến mãi và thay thế toàn bộ captured markup. `b2b_briefs` và `b2b_catalog_audits` đã có là legacy; không mở rộng chúng. V1 ưu tiên dữ liệu thật, một luồng đại diện và vận hành ít bước hơn là mở rộng phạm vi.

## 2. Người dùng và ma trận quyền

Chỉ có hai loại tài khoản nội bộ: `administrator` và `employee`. Không có company, team, role con hay quyền chi tiết theo người dùng. Khách mua có cần tài khoản là **Chờ xác nhận**; quyết định đó không tạo thêm loại tài khoản nội bộ.

| Việc | Khách | Employee | Administrator |
| --- | --- | --- | --- |
| Xem storefront, sản phẩm, giá VND, dịch vụ | Có | Có | Có |
| Chọn biến thể/số lượng; mua trực tiếp dưới ngưỡng | Có, theo quyết định tài khoản **Chờ xác nhận** | Không phải luồng chính | Không phải luồng chính |
| Gửi liên hệ sản phẩm/dịch vụ | Có | Có thể kiểm tra kết quả | Có thể kiểm tra kết quả |
| Xử lý yêu cầu trong Google Sheets | Không | Có | Có |
| Xem đơn và tồn kho trong Bagisto admin | Không | Có | Có |
| Sửa sản phẩm/giá trong Bagisto admin | Không | **Chờ xác nhận**; đề xuất mặc định: không | Có |
| Quản lý hai loại tài khoản nội bộ | Không | Không | Có |
| Dashboard hai số | Không | Có | Có |

`/quan-tri` Next.js và BFF của nó là bề mặt chuyển tiếp đã đóng băng: chỉ duy trì tương thích và bảo mật, không cấp thêm quyền hay tính năng. Bagisto admin là đích quản trị dài hạn.

## 3. MVP và phần hoãn

| Trong MVP | Hoãn rõ ràng |
| --- | --- |
| Một product family đại diện, biến thể, MOQ, bước số lượng, giá bậc, ngưỡng liên hệ do Bagisto cung cấp | Quote engine, báo giá, chuyển báo giá thành đơn |
| Một service family đại diện, nội dung cần thiết và CTA liên hệ | Nhiều service family, wizard phức tạp, tệp đính kèm, BOM/nguyên liệu/QC/tiến độ |
| Mua trực tiếp dưới ngưỡng; từ ngưỡng mở liên hệ kèm ngữ cảnh | Company account, team, approval, granular RBAC |
| `POST /api/contact` chuyển webhook tới Google Sheets; nhân viên xử lý trong Sheet | Request inbox trong Bagisto, đồng bộ Sheet từ Bagisto, bảng yêu cầu mới |
| Bagisto admin cho sản phẩm, giá, tồn kho, đơn và hai tài khoản nội bộ | Full audit, mở rộng `b2b_briefs` hoặc `b2b_catalog_audits` |
| Dashboard chỉ có yêu cầu mới và đơn mới | Dashboard phân tích, dashboard Next mới |
| Tiếng Việt, VND, giữ nội dung storefront/contact hiện tại và thay giao diện dần | Đa kênh, đa locale, đa tiền tệ, payment gateway, carrier, promotion, redesign toàn diện |

Không hồi sinh bất kỳ phần hoãn nào dưới tên khác. Không tạo bảng cho phần hoãn và không ghi trực tiếp bảng core Bagisto từ code mới.

## 4. Sitemap đích

Sitemap dưới đây là đích của Lean V1, không suy diễn từ `docs/research/PAGE_TOPOLOGY.md`; tài liệu research đó chỉ ghi thứ tự/bố cục của trang clone.

```text
/
├─ /san-pham
│  └─ /san-pham/[slug]                 Chi tiết sản phẩm, biến thể, giá, số lượng, CTA mua/liên hệ
├─ /thue-gia-cong
│  └─ /thue-gia-cong/[family]          Một service family đại diện trước; các family khác chỉ khi được duyệt
├─ /lien-he                            Form chung; nhận ngữ cảnh nếu đi từ sản phẩm/dịch vụ
├─ /gioi-thieu và nội dung storefront hiện có
├─ Bagisto admin (back office dài hạn) Sản phẩm, giá, tồn, đơn, tài khoản nội bộ
└─ /quan-tri                           Tồn tại để chuyển tiếp, frozen; không phải sitemap đích mở rộng
```

Màn hình tài khoản khách và đường dẫn checkout cụ thể phụ thuộc quyết định **Chờ xác nhận** về khách mua có/không có tài khoản và thanh toán/giao hàng. Không thêm sitemap cho báo giá, company, team, phê duyệt hay audit.

## 5. User flows ưu tiên

1. **Sản phẩm, số lượng dưới ngưỡng → mua trực tiếp.** Khách mở `/san-pham/[slug]`, chọn biến thể, nhập số lượng thỏa MOQ và bước số lượng. Storefront hiển thị giá bậc VND từ Bagisto. Nếu số lượng nhỏ hơn `contact_from_quantity`, CTA đi đến luồng checkout Bagisto. Việc khách mua có/không có tài khoản, thanh toán/giao hàng và trạng thái hoàn tất đơn là **Chờ xác nhận**.
2. **Sản phẩm, từ ngưỡng → liên hệ.** Cùng bước chọn trên, nếu số lượng bằng hoặc lớn hơn ngưỡng, server thực thi quy tắc và CTA chuyển sang `/lien-he`. Form mang theo product, variant, quantity và nguồn; khách gửi tên, điện thoại, email tùy chọn, nội dung. `POST /api/contact` chuyển dữ liệu chuẩn hóa tới Google Sheets và trả mã tham chiếu.
3. **Dịch vụ → Google Sheets.** Khách vào `/thue-gia-cong/[family]` của service family đại diện, đọc nội dung/lựa chọn cần thiết, nhấn liên hệ và gửi form. Cách khách tự thêm service bằng Bagisto CMS hay cần developer là **Chờ xác nhận**. Mỗi lần gửi thành công tạo một dòng trong Sheet, không tạo brief trong Bagisto.
4. **Nhân viên xử lý.** Employee mở dashboard để thấy yêu cầu mới và đơn mới, rồi mở Google Sheet để nhận và cập nhật yêu cầu. Cách dashboard lấy số yêu cầu mới từ Sheet (link hay API đếm) và các trạng thái xử lý Sheet là **Chờ xác nhận**. Nhân viên không dùng `/quan-tri` để có tính năng mới.
5. **Quản trị sửa dữ liệu sản phẩm/giá.** Administrator vào Bagisto admin, sửa sản phẩm, biến thể, giá bậc/ngưỡng theo cơ chế Bagisto rồi kiểm tra storefront đọc đúng dữ liệu. Employee có được sửa sản phẩm/giá không là **Chờ xác nhận**; mặc định đề xuất chỉ administrator được sửa. Không dùng ghi thẳng MySQL hay endpoint `operations/v1` chưa nhập.

## 6. Wireframe low-fi

Wireframe chỉ diễn tả luồng ở phần 5, không tạo ngôn ngữ giao diện mới hay trang trí mới.

```text
[Trang sản phẩm]
 Tên | ảnh/nội dung hiện có
 Biến thể [v]   Số lượng [-  ___  +]   MOQ / bước / giá VND
 ├─ dưới ngưỡng: [Mua trực tiếp]
 └─ từ ngưỡng : [Liên hệ về số lượng này]

[Trang dịch vụ đại diện]
 Nội dung hiện có | lựa chọn cần thiết
 [Liên hệ dịch vụ] → [Form liên hệ có nguồn=service]

[Form liên hệ]
 Họ tên | Điện thoại | Email | Nội dung
 Ngữ cảnh chỉ đọc: sản phẩm / biến thể / số lượng, nếu có
 [Gửi yêu cầu] → Mã tham chiếu → Google Sheets

[Bagisto admin]
 Sản phẩm | giá | tồn kho | đơn | tài khoản nội bộ
 Dashboard: [Yêu cầu mới] [Đơn mới]
```

## 7. ERD tối thiểu và ranh giới dữ liệu

Bagisto core được đọc/ghi qua service hoặc repository/API của Bagisto; code mới không ghi thẳng bảng core. `b2b_product_configs` là cấu hình B2B hiện có theo biến thể sản phẩm. Google Sheets là đích yêu cầu liên hệ. Không thiết kế bảng cho bất kỳ hạng mục hoãn nào.

```text
Bagisto core (qua service/repository)
  products (parent) 1 ── * products (variant)
  products (variant) 1 ── 1 b2b_product_configs
                                  ├─ unit
                                  ├─ moq
                                  ├─ quantity_step
                                  └─ contact_from_quantity
  products/variants ── giá bậc, tồn kho, đơn (core Bagisto)

Next storefront ──đọc qua API──> Bagisto core + b2b_product_configs
Next POST /api/contact ──webhook──> Google Sheets / "Yeu cau"
                                      Mã, Thời gian, Họ tên, Điện thoại,
                                      Email, Nội dung, Nguồn, Trạng thái

Legacy, không mở rộng: b2b_briefs; b2b_catalog_audits
```

`b2b_briefs` không phải hàng đợi V1; `/api/b2b/briefs` không dùng. `b2b_catalog_audits` là legacy, không biến thành full audit. Không tạo bảng quote, company, team, approval, request inbox hoặc audit mới.

## 8. API và trạng thái chuyển tiếp

Ký hiệu trạng thái: **hiện có** = route đã audit trong Next hoặc Bagisto; **chuyển tiếp** = chỉ giữ tương thích/bảo mật khi chuyển sang Bagisto admin; **cần làm** = cần triển khai sau khi câu hỏi liên quan được chốt; **đóng băng** = không mở rộng trong Lean V1. Bagisto admin API bên dưới được audit từ checkout Bagisto hiện có; checkout đó đang dirty và không bị sửa trong task này.

| Method | Path | Người dùng | Input → output | Quyền | Lỗi chính | Hiện có | Chuyển tiếp | Cần làm | Đóng băng |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/api/contact` | Khách | Form `name, phone, email, message, source` → `202 {ok, reference}` | Public | 400 dữ liệu; 502/503/504 webhook | Có, Next → Apps Script/Sheet | Giữ contract trình duyệt | Bổ sung ngữ cảnh sản phẩm/dịch vụ theo flow | Không fallback Bagisto |
| GET | `/api/catalog/products/[slug]` | Khách | `slug` → `{product}` | Public | 422/404/502/504 | Có, BFF catalog | Giữ cho storefront | Xác nhận family đại diện | Không thành admin API |
| GET | `/api/quan-tri/dashboard` | Nội bộ | — → số liệu catalog hiện tại | Phiên/permission cũ | 401/403/502/504 | Có | Đưa quản trị về Bagisto admin | Dashboard chỉ yêu cầu mới + đơn mới | Có |
| GET | `/api/quan-tri/me` | Nội bộ | — → danh tính/permission cũ | Phiên cũ | 401/403/502 | Có | Chỉ tương thích | Không thêm role | Có |
| POST, DELETE | `/api/quan-tri/session` | Nội bộ | đăng nhập/đăng xuất → session | Phiên cũ | 403/419/422/502 | Có | Chỉ tương thích | Không thêm luồng | Có |
| POST | `/api/quan-tri/two-factor` | Nội bộ | mã 6 số → xác thực | Phiên cũ | 403/419/422/502 | Có | Chỉ tương thích | Không mở rộng | Có |
| GET | `/api/quan-tri/san-pham` | Nội bộ | lọc trang → danh sách aggregate | `b2b.catalog.read` cũ | 401/403/422/502 | Có | Chuyển sang Bagisto admin | Không thêm bộ lọc/tính năng | Có |
| GET | `/api/quan-tri/san-pham/[slug]` | Nội bộ | `slug` → chi tiết aggregate | `b2b.catalog.read` cũ | 401/403/404/502 | Có | Chuyển sang Bagisto admin | Không mở rộng | Có |
| PUT | `/api/quan-tri/san-pham/[slug]` | Nội bộ | commercial rules + version → product | `b2b.catalog.write` cũ | 401/403/409/422/502 | Có | Chuyển sang Bagisto admin | Quyền employee **Chờ xác nhận** | Có |
| POST, DELETE | `/api/b2b/admin/v1/session` | Nội bộ | credentials/session → session | Admin API | 401/419/422 | Có, Bagisto | Bagisto admin dài hạn | Chuẩn hóa chỉ admin/employee | Không thêm role |
| POST | `/api/b2b/admin/v1/two-factor` | Nội bộ | mã → đã xác thực | Phiên admin | 401/419/422 | Có, Bagisto | Bagisto admin dài hạn | Chỉ duy trì nếu cần | Không thêm flow |
| GET | `/api/b2b/admin/v1/me` | Nội bộ | — → danh tính | Phiên admin | 401/403 | Có, Bagisto | Bagisto admin dài hạn | Map hai loại tài khoản | Không granular RBAC |
| GET | `/api/b2b/admin/v1/dashboard` | Nội bộ | — → dashboard catalog hiện tại | `b2b.dashboard` | 401/403 | Có, Bagisto | Mục tiêu chỉ hai số V1 | Nguồn Sheet **Chờ xác nhận** | Không dashboard phân tích |
| GET | `/api/b2b/admin/v1/product-aggregates` | Nội bộ | lọc → danh sách sản phẩm | `b2b.catalog.read` | 401/403/422 | Có, Bagisto | Dùng/tiến về Bagisto admin | Family đại diện | Không API quản trị Next mới |
| GET | `/api/b2b/admin/v1/product-aggregates/{slug}` | Nội bộ | `slug` → chi tiết | `b2b.catalog.read` | 401/403/404 | Có, Bagisto | Dùng/tiến về Bagisto admin | — | Không mở rộng contract V1 |
| PUT | `/api/b2b/admin/v1/product-aggregates/{slug}/commercial-rules` | Nội bộ | version, published, variants → product | `b2b.catalog.write` | 401/403/409/422 | Có, Bagisto | Dùng/tiến về Bagisto admin | Employee sửa giá **Chờ xác nhận** | Không viết thẳng core tables |
| GET | `/api/b2b/catalog/categories` | Storefront | — → categories | Public, throttled | 429/5xx | Có, Bagisto | Nguồn catalog | Chỉ dùng khi sitemap cần | Không thành CMS service |
| GET | `/api/b2b/catalog/products` | Storefront | lọc → products | Public, throttled | 429/5xx | Có, Bagisto | Nguồn catalog | Family đại diện | Không quote data |
| GET | `/api/b2b/catalog/products/{slug}` | Storefront | `slug` → product/variant/rules | Public, throttled | 404/429/5xx | Có, Bagisto | Nguồn product flow | Enforce ngưỡng server | Không bypass Bagisto |
| POST | `/api/b2b/briefs` | Không dùng | brief → legacy record | Public, throttled | 4xx/429/5xx | Có, Bagisto | Không chuyển tiếp | Không làm | Có; không dùng |
| GET, POST, PUT | `/api/operations/v1/products...` | Không dùng V1 | product snapshot/create/variant/policy | Phiên + `b2b.catalog.*` | 401/403/405/409/422 | Chỉ ở nhánh sạch `codex/slice1-product-application-contract`, chưa merge | Không chuyển tiếp vào V1 | Không làm/không merge | Có |
| — | Luồng checkout/direct order | Khách | giỏ/checkout → đơn Bagisto | **Chờ xác nhận** | **Chờ xác nhận** | Chưa audit được route V1 trong Next | Phải qua Bagisto, không ghi core trực tiếp | Chốt tài khoản, thanh toán/giao hàng, trạng thái hoàn tất | Không tự dựng endpoint ghi DB |

## 9. Công việc, vai trò và phụ thuộc

| Công việc | Owner | Reviewer/router | Trạng thái | Phụ thuộc | Deliverable |
| --- | --- | --- | --- | --- | --- |
| Chốt product family và service family đại diện | Người quyết định sản phẩm **Chờ xác nhận** | Luna review phạm vi | Chờ xác nhận | Danh mục/nội dung thật | Hai family được ghi rõ, không thêm family khác |
| Chuẩn hóa luồng catalog, ngưỡng và direct order | Terra implement | Luna independent review; Gemini/agy simplicity/router | Chưa bắt đầu | Family, tài khoản khách, payment/shipping/order completion | Luồng đại diện + test |
| Hoàn chỉnh trang dịch vụ và contact → Sheet | Terra implement | Luna independent review; Gemini/agy simplicity/router | Chưa bắt đầu | Service family, nguồn/ trạng thái Sheet | Trang + webhook vận hành |
| Thiết lập vận hành Sheet và dashboard hai số | Terra implement | Luna independent review; Gemini/agy simplicity/router | Chưa bắt đầu | Cách đếm Sheet, trạng thái xử lý | Quy trình nhân viên + dashboard tối giản |
| Chuyển quản trị về Bagisto admin; giữ `/quan-tri` frozen | Terra implement | Luna independent review; Gemini/agy simplicity/router | Chưa bắt đầu | Quyền employee sửa sản phẩm/giá | Đường vận hành Bagisto admin |
| Kiểm thử và bàn giao | Terra implement | Luna independent review; Gemini/agy simplicity/router | Chưa bắt đầu | Các mục trên | Bằng chứng theo phần 10 |

Terra là vai trò triển khai; Luna thực hiện review độc lập; Gemini/agy giữ vai trò kiểm tra độ đơn giản và routing. Không giả tên khách, nhân viên hay quản trị viên. Mọi thay đổi đáng kể đi theo router Terra → Luna → Gemini/agy; thay đổi hành vi bắt đầu bằng test RED, rồi code GREEN tối thiểu, sau đó lint, typecheck, build và review phù hợp.

## 10. Acceptance criteria có thể kiểm thử

| MVP | Tiêu chí chấp nhận |
| --- | --- |
| Product family đại diện | Có đúng một family được chốt; một sản phẩm cấu hình/biến thể thật hiển thị bằng tiếng Việt/VND; dữ liệu MOQ, bước số lượng, giá bậc và ngưỡng lấy từ Bagisto. |
| Quy tắc số lượng | Chọn số lượng dưới MOQ hoặc sai bước bị chặn; số lượng dưới `contact_from_quantity` chỉ hiện/mở luồng mua; số lượng bằng hoặc trên ngưỡng chỉ hiện/mở luồng liên hệ có product, variant, quantity. Kiểm tra cả phía server. |
| Mua trực tiếp | Khách hoàn tất direct order qua Bagisto mà không có ghi trực tiếp core tables từ Next. Cách xác thực khách, payment/shipping và trạng thái hoàn tất phải được chốt trước test nghiệm thu; nếu còn **Chờ xác nhận**, hạng mục chưa đạt. |
| Service family đại diện | Có đúng một family được chốt, CTA đi tới liên hệ và ngữ cảnh nguồn là service family đó. Cách thêm service bằng CMS/developer phải được chốt trước khi mở rộng. |
| Contact → Sheet | Gửi `name`, `phone`, `email` tùy chọn, `message`, `source` hợp lệ nhận `202`, mã tham chiếu và đúng một dòng Sheet; dữ liệu không hợp lệ nhận `400`; URL/secret chỉ ở server; không có fallback Bagisto. |
| Nhân viên xử lý | Employee nhìn thấy hai số yêu cầu mới/đơn mới và mở được Sheet để xử lý. Cách đếm, link/API và trạng thái Sheet phải được chốt và có một kịch bản kiểm tra trạng thái mới → đã xử lý. |
| Quản trị sản phẩm/giá | Administrator sửa được dữ liệu đã cho phép trong Bagisto admin và storefront phản ánh dữ liệu đó. Employee không sửa được cho đến khi có quyết định khác; nếu được phép thì test đúng giới hạn đã chốt. |
| Ranh giới quản trị | Không có tính năng mới trên `/quan-tri` hoặc BFF Next; Bagisto admin là đường quản trị được hướng dẫn. Chỉ tồn tại admin/employee, không có granular RBAC/company/team/approval. |
| Phạm vi hoãn | Không có route, bảng hay luồng V1 mới cho quote engine, `b2b_briefs`, full audit, `operations/v1`, company/team/approval. Không có direct core table write. |
| Chất lượng bàn giao | Focused tests, lint, typecheck, build và independent review chạy theo thay đổi thực tế; kiểm tra `git diff --check` không lỗi; không push. |

### Câu hỏi cần xác nhận

**Ưu tiên 1 — chặn nghiệm thu luồng mua:**

1. Product family đại diện là gì?
2. Khách mua trực tiếp không cần tài khoản hay phải có tài khoản?
3. Hình thức thanh toán, giao hàng và trạng thái nào được coi là hoàn tất order?

**Ưu tiên 2 — chặn phạm vi dịch vụ và vận hành:**

4. Service family đại diện là gì?
5. Khách tự thêm service bằng Bagisto CMS hay cần developer?
6. Dashboard lấy số yêu cầu mới từ Sheet bằng link hay API đếm?
7. Các trạng thái xử lý trong Sheet là gì?

**Ưu tiên 3 — chặn quyền sửa dữ liệu:**

8. Employee có được sửa product/price không? Đề xuất mặc định: chỉ administrator được sửa.
