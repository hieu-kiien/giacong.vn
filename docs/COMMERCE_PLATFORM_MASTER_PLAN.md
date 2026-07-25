# Hồ sơ sản phẩm và kỹ thuật — Lean V1

**Trạng thái:** nguồn quyết định hiện hành và hồ sơ Lean V1 duy nhất.
**Ranh giới tài liệu:** [BAGISTO_HEADLESS_MVP.md](./BAGISTO_HEADLESS_MVP.md) là lưu trữ; [GOOGLE_SHEETS_CONTACT_WEBHOOK.md](./GOOGLE_SHEETS_CONTACT_WEBHOOK.md) là hướng dẫn vận hành webhook. `docs/research/PAGE_TOPOLOGY.md` chỉ mô tả bố cục trang clone, không phải sitemap đích.
**Ranh giới triển khai:** hồ sơ này không sửa code/UI/Bagisto, không ghi trực tiếp bảng core Bagisto, không điều khiển hay đổi cấu hình cổng `3000`, `8000`, `8001`. Backend Bagisto nội bộ dùng `127.0.0.1:18001`. Không push.

## 1. Bài toán Lean V1

Lean V1 giúp khách B2B xem một dòng sản phẩm, chọn biến thể và số lượng hợp lệ, đọc giá theo số lượng bằng VND, rồi gửi yêu cầu cho bên tư vấn. Website kết thúc trách nhiệm khi chuyển đủ ngữ cảnh `product/service`, `variant`, `quantity` và thông tin liên hệ vào Google Sheets. Bên tư vấn hoặc hệ thống bên ngoài chịu trách nhiệm xử lý tiếp.

Phạm vi sản phẩm V1 đã chọn là family **Bột dinh dưỡng**, gồm hai biến thể **Bột dinh dưỡng vị vani** và **Bột dinh dưỡng vị ít ngọt**. Đây là lựa chọn cấu trúc gọn dựa trên parent/variant có trong `DemoCatalogSeeder.php`, không phải xác nhận danh mục production. SKU, ảnh, nội dung, giá và dữ liệu thương mại thật đều **Chờ xác nhận** trước khi public; không được coi bất kỳ dữ liệu `B2B-DEMO` nào là dữ liệu production.

Hiển thị giá bậc, MOQ, bước số lượng và ngưỡng liên hệ lấy từ Bagisto. Nếu số lượng dưới `contact_from_quantity`, CTA là **Yêu cầu tư vấn đặt mua**; nếu bằng hoặc trên ngưỡng, CTA là **Liên hệ số lượng lớn**. Cả hai CTA chỉ mở form/handoff Google Sheets với đầy đủ ngữ cảnh; không có quote engine.

Khách không tạo tài khoản, kể cả sau khi dự án hoàn thiện. Customer login, customer account, customer portal, checkout, cart, tạo đơn, thanh toán, giao hàng và hoàn tất đơn là ranh giới vĩnh viễn ngoài website V1. Website không thay thế hệ thống xử lý đơn bên ngoài.

Vận hành dùng Bagisto admin làm back office dài hạn cho catalog, giá, tồn kho và hai loại tài khoản nội bộ cố định. Google Sheets là hàng đợi yêu cầu liên hệ. Dashboard Bagisto mong muốn có chỉ số yêu cầu mới và có thể có tile **đơn mới**, nhưng nguồn đơn bên ngoài có được đẩy vào Bagisto/dashboard hay tile này phải bỏ là **Chờ xác nhận**. Không cam kết integration đơn ngoài trong V1.

Ngoài phạm vi vĩnh viễn: customer account/portal, checkout, cart, tạo đơn, payment, shipping, order completion, quote engine, vòng đời báo giá, chuyển báo giá thành đơn, company/team/approval, granular RBAC, request inbox trong Bagisto, nhiều service family, wizard gia công phức tạp, tệp đính kèm, BOM/nguyên liệu/QC/tiến độ xưởng, đa kênh, đa ngôn ngữ, đa tiền tệ, payment gateway, carrier, promotion và thay thế toàn bộ captured markup. `b2b_briefs` và `b2b_catalog_audits` là legacy, không mở rộng.

## 2. Người dùng và ma trận quyền

Không có tài khoản khách. Chỉ có hai loại tài khoản nội bộ: `administrator` và `employee`; không có company, team, role con hay quyền chi tiết theo người dùng. `/quan-tri` Next.js và BFF của nó là bề mặt chuyển tiếp đã đóng băng: chỉ duy trì tương thích và bảo mật, không cấp thêm quyền hay tính năng. Bagisto admin là đích quản trị dài hạn.

| Dữ liệu / thao tác | Khách | Employee | Administrator |
| --- | --- | --- | --- |
| Catalog — xem giá bậc, biến thể, quy tắc số lượng | Có | Có | Có |
| Catalog — tạo | Không | Không | Có trong Bagisto admin |
| Catalog — sửa sản phẩm, biến thể, giá | Không | **Chờ xác nhận**; đề xuất an toàn: mặc định không cho đến khi xác nhận | Có trong Bagisto admin |
| Catalog — xóa | Không | **Chờ xác nhận** | **Chờ xác nhận**; đề xuất an toàn: không hard-delete trong V1 |
| Yêu cầu Sheet — tạo | Gửi form contact/handoff | Không phải flow V1 | Không phải flow V1 |
| Yêu cầu Sheet — xem/xử lý | Không | Có; trạng thái **Chờ xác nhận** | Có; trạng thái **Chờ xác nhận** |
| Tài khoản nội bộ — quản trị | Không | Chỉ tài khoản của mình nếu Bagisto hỗ trợ; **Chờ xác nhận** | Có cho `administrator`/`employee` |
| Dashboard Bagisto | Không | Có | Có |

Không thiết kế quyền cho khách, đơn, thanh toán, giao hàng hoặc fulfillment vì toàn bộ các bề mặt đó nằm ngoài website.

## 3. MVP và phần hoãn

| Trong MVP | Ngoài phạm vi / hoãn rõ ràng |
| --- | --- |
| Một family **Bột dinh dưỡng** với hai biến thể đã nêu, đọc dữ liệu catalog từ Bagisto | Bất kỳ catalog production nào trước khi SKU/ảnh/nội dung/giá thật được **Chờ xác nhận** và duyệt public |
| Hiển thị MOQ, bước số lượng, giá bậc và ngưỡng liên hệ | Quote engine, báo giá tự động, vòng đời báo giá |
| Hai CTA theo ngưỡng, đều gửi handoff có ngữ cảnh qua form/Google Sheets | Customer account/portal, cart, checkout, tạo đơn, payment, shipping, order completion |
| Một service family đại diện, CTA form và webhook Google Sheets | Nhiều service family; cơ chế thêm service qua CMS/developer là **Chờ xác nhận**; wizard phức tạp, tệp đính kèm |
| `POST /api/contact`; nhân viên xử lý trong Sheet | Request inbox Bagisto, đồng bộ Sheet từ Bagisto, integration đơn ngoài |
| Bagisto admin cho catalog/giá/tồn kho và tài khoản nội bộ | Mở rộng `/quan-tri`, `b2b_briefs`, `b2b_catalog_audits`, full audit |
| Dashboard Bagisto với yêu cầu mới; tile đơn mới khi nguồn được **Chờ xác nhận** | Dashboard Next/B2B cũ, phân tích nâng cao, cam kết count/link mechanism trước khi cơ chế được **Chờ xác nhận** |
| Tiếng Việt, VND, giữ storefront/contact hiện có và thay giao diện dần | Đa kênh, đa locale, đa tiền tệ, promotion, redesign toàn diện |

Không hồi sinh phần ngoài phạm vi dưới tên khác. Không tạo bảng cho phần hoãn và không ghi trực tiếp bảng core Bagisto từ code mới.

## 4. Sitemap đích

Sitemap là đích Lean V1, không suy diễn từ `docs/research/PAGE_TOPOLOGY.md`.

```text
/
├─ /san-pham
│  └─ /san-pham/[slug]                 Chi tiết, biến thể, giá bậc, số lượng, CTA form/handoff
├─ /thue-gia-cong
│  └─ /thue-gia-cong/[family]          Một service family đại diện sau khi được **Chờ xác nhận**
├─ /lien-he                            Form chung; nhận ngữ cảnh sản phẩm/dịch vụ
├─ /gioi-thieu và nội dung storefront hiện có
├─ Bagisto admin (back office dài hạn) Catalog, giá, tồn, tài khoản nội bộ, dashboard
└─ /quan-tri                           Tồn tại để chuyển tiếp, frozen; không mở rộng
```

Không có sitemap customer login/account/portal, cart, checkout, payment, shipping, order, quote, company, team, approval hoặc audit.

## 5. User flows ưu tiên

1. **Sản phẩm, dưới ngưỡng → handoff tư vấn.** Khách mở `/san-pham/[slug]`, chọn vani hoặc ít ngọt, nhập số lượng thỏa MOQ và bước số lượng. Storefront hiển thị giá bậc VND từ Bagisto. Nếu số lượng nhỏ hơn `contact_from_quantity`, CTA **Yêu cầu tư vấn đặt mua** mở `/lien-he` với product, variant, quantity và nguồn.
2. **Sản phẩm, từ ngưỡng → handoff số lượng lớn.** Cùng quy tắc chọn, nếu số lượng bằng hoặc lớn hơn ngưỡng, server thực thi quy tắc và CTA đổi thành **Liên hệ số lượng lớn**. Form tại `/lien-he` mang theo product, variant, quantity và nguồn rồi gửi tới Google Sheets.
3. **Dịch vụ → Google Sheets.** Khách vào `/thue-gia-cong/[family]` của service family đại diện, đọc nội dung/lựa chọn cần thiết và gửi form. Mỗi lần gửi thành công tạo một dòng Sheet, không tạo brief trong Bagisto.
4. **Nhân viên xử lý.** Employee mở dashboard Bagisto để thấy số yêu cầu mới theo cơ chế link/count **Chờ xác nhận**, mở Google Sheet và cập nhật yêu cầu. Trạng thái Sheet là **Chờ xác nhận**. Nguồn đơn bên ngoài có đẩy vào dashboard hay phải bỏ tile **đơn mới** là **Chờ xác nhận**; V1 không tự tạo integration.
5. **Quản trị sửa dữ liệu sản phẩm/giá.** Administrator sửa catalog, biến thể, giá bậc và ngưỡng qua Bagisto admin, rồi kiểm tra storefront đọc đúng dữ liệu. Employee có được sửa product/price không là **Chờ xác nhận**; mặc định không cho đến khi xác nhận. Không dùng ghi thẳng MySQL hoặc endpoint `operations/v1` chưa nhập.

## 6. Wireframe low-fi

Wireframe chỉ diễn tả luồng phần 5, không tạo ngôn ngữ giao diện mới.

```text
[Trang sản phẩm: Bột dinh dưỡng]
 Tên | ảnh/nội dung đã được duyệt public
 Biến thể [Vani | Ít ngọt]   Số lượng [-  ___  +]   MOQ / bước / giá bậc VND
 ├─ dưới ngưỡng: [Yêu cầu tư vấn đặt mua] → [Form/handoff Sheet]
 └─ từ ngưỡng : [Liên hệ số lượng lớn]   → [Form/handoff Sheet]

[Trang dịch vụ đại diện]
 Nội dung hiện có | lựa chọn cần thiết
 [Liên hệ dịch vụ] → [Form liên hệ có nguồn=service] → Google Sheets

[Form liên hệ]
 Họ tên | Điện thoại | Email tùy chọn | Nội dung
 Ngữ cảnh chỉ đọc: sản phẩm / biến thể / số lượng hoặc service, nếu có
 [Gửi yêu cầu] → Mã tham chiếu → Google Sheets

[Bagisto admin]
 Catalog | giá | tồn kho | tài khoản nội bộ
 Dashboard: [Yêu cầu mới] [Đơn mới: nguồn/tile **Chờ xác nhận**]
```

## 7. ERD tối thiểu và ranh giới dữ liệu

Bagisto core được đọc/ghi qua service, repository hoặc API Bagisto; code mới không ghi trực tiếp bảng core. `b2b_product_configs` là cấu hình B2B hiện có theo biến thể. Google Sheets là đích duy nhất của yêu cầu liên hệ. Không thiết kế bảng khách, cart, checkout, payment, shipping hoặc order cho website V1.

```text
Bagisto core (qua service/repository)
  products (parent: Bột dinh dưỡng) 1 ── * products (variant: Vani | Ít ngọt)
  products (variant) 1 ── 0..1 b2b_product_configs
                                  ├─ unit
                                  ├─ moq
                                  ├─ quantity_step
                                  └─ contact_from_quantity
  products/variants ── giá bậc, tồn kho (core Bagisto)

Next storefront ──đọc qua API──> Bagisto core + b2b_product_configs
Next POST /api/contact ──webhook──> Google Sheets / "Yêu cầu"
                                      Mã, thời gian, họ tên, điện thoại,
                                      email, nội dung, product/service,
                                      variant, quantity, nguồn, trạng thái

Legacy, không mở rộng: b2b_briefs; b2b_catalog_audits
```

Migration hiện chỉ ép tối đa một `b2b_product_configs` cho mỗi `product_id`; nó không ép mọi variant phải có config nên quan hệ là `0..1`. `b2b_briefs` không phải hàng đợi V1 và `/api/b2b/briefs` không dùng. Không tạo bảng quote, company, team, approval, request inbox hoặc audit mới.

## 8. API và trạng thái chuyển tiếp

Trạng thái chính chỉ có một giá trị mỗi route: **hiện có**, **chuyển tiếp**, **cần làm** hoặc **đóng băng**. Với BFF Next, `502/504` là lỗi upstream không sẵn sàng/quá thời gian.

| Method | Path | Người dùng | Input → output | Quyền | Lỗi chính | Trạng thái chính | Hành động V1 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/api/contact` | Khách | `name, phone, email?, message, source, product?, variant?, quantity?, service?` → `202 {ok, reference}` | Public | 400; 502/503/504 webhook | Hiện có | Giữ contract; chuẩn hóa ngữ cảnh handoff và gửi Google Sheets; không fallback Bagisto. |
| GET | `/api/catalog/products/[slug]` | Khách | `slug` → `{product}` | Public | 422/404/502/504 | Hiện có | Giữ BFF catalog để hiển thị family/variant, giá bậc và quy tắc số lượng. |
| GET | `/api/quan-tri/dashboard` | Nội bộ cũ | — → số liệu catalog hiện tại | Phiên/permission cũ | 401/403/502/504 | Đóng băng | Chỉ security/compat; không làm dashboard V1 ở đây. |
| GET | `/api/quan-tri/me` | Nội bộ cũ | — → danh tính/permission cũ | Phiên cũ | 401/403/502/504 | Đóng băng | Chỉ security/compat; không thêm role. |
| POST | `/api/quan-tri/session` | Nội bộ cũ | credentials → session | Phiên cũ | 401/403/419/422/429/502/504 | Đóng băng | Chỉ security/compat. |
| DELETE | `/api/quan-tri/session` | Nội bộ cũ | — → `204` | Phiên cũ | 403/419/502/504 | Đóng băng | Chỉ security/compat. |
| POST | `/api/quan-tri/two-factor` | Nội bộ cũ | mã 6 số → xác thực | Phiên cũ | 401/403/419/422/429/502/504 | Đóng băng | Chỉ security/compat. |
| GET | `/api/quan-tri/san-pham` | Nội bộ cũ | lọc trang → danh sách aggregate | Permission cũ | 401/403/422/502/504 | Đóng băng | Chỉ security/compat. |
| GET | `/api/quan-tri/san-pham/[slug]` | Nội bộ cũ | `slug` → chi tiết aggregate | Permission cũ | 401/403/404/502/504 | Đóng băng | Chỉ security/compat. |
| PUT | `/api/quan-tri/san-pham/[slug]` | Nội bộ cũ | commercial rules + version → product | Permission cũ | 401/403/404/412/419/422/428/429/502/504 | Đóng băng | Không dùng cho quyền employee hay tính năng mới. |
| POST | `/api/b2b/admin/v1/session` | Nội bộ | credentials → session | Admin API | 401; 403 (`two_factor_unavailable`); 419/422/429 | Chuyển tiếp | Chỉ phục vụ bề mặt Next cũ trong khi chuyển sang Bagisto admin. |
| DELETE | `/api/b2b/admin/v1/session` | Nội bộ | — → `204` | Phiên web | 419 | Chuyển tiếp | Chỉ duy trì tương thích cho bề mặt cũ. |
| POST | `/api/b2b/admin/v1/two-factor` | Nội bộ | mã → đã xác thực | Phiên admin | 401; 403 (`two_factor_unavailable`); 419/422/429 | Chuyển tiếp | Chỉ duy trì tương thích cho bề mặt cũ. |
| GET | `/api/b2b/admin/v1/me` | Nội bộ | — → danh tính | Phiên admin | 401/403 | Chuyển tiếp | Chỉ duy trì tương thích; không granular RBAC. |
| GET | `/api/b2b/admin/v1/dashboard` | Nội bộ | — → dashboard catalog hiện tại | `b2b.dashboard` | 401/403 | Chuyển tiếp | Không mở rộng; dashboard Bagisto native về yêu cầu mới/link/count và tile đơn mới đều **Chờ xác nhận**. |
| GET | `/api/b2b/admin/v1/product-aggregates` | Nội bộ | lọc → danh sách sản phẩm | `b2b.catalog.read` | 401/403/422 | Chuyển tiếp | Chỉ duy trì bề mặt cũ trong khi vận hành catalog chuyển về Bagisto admin. |
| GET | `/api/b2b/admin/v1/product-aggregates/{slug}` | Nội bộ | `slug` → chi tiết | `b2b.catalog.read` | 401/403/404 | Chuyển tiếp | Chỉ duy trì tương thích. |
| PUT | `/api/b2b/admin/v1/product-aggregates/{slug}/commercial-rules` | Nội bộ | version, published, variants → product | `b2b.catalog.write` | 401/403/404/412/419/422/428/429 | Chuyển tiếp | Employee sửa product/price là **Chờ xác nhận**; mặc định không cho. Không ghi core table trực tiếp. |
| GET | `/api/b2b/catalog/categories` | Storefront | — → categories | Public, throttled | 429; lỗi khác **Chờ xác nhận sau audit route** | Hiện có | Nguồn catalog khi cần; không thành CMS service. |
| GET | `/api/b2b/catalog/products` | Storefront | lọc → products | Public, throttled | 429; lỗi khác **Chờ xác nhận sau audit route** | Hiện có | Nguồn catalog cho family đại diện; không có quote data. |
| GET | `/api/b2b/catalog/products/{slug}` | Storefront | `slug` → product/variant/rules | Public, throttled | 404/429; lỗi khác **Chờ xác nhận sau audit route** | Hiện có | Dùng cho product flow; enforce ngưỡng ở server. |
| POST | `/api/b2b/briefs` | Không dùng V1 | brief → legacy record | Public, throttled | 429; lỗi khác **Chờ xác nhận sau audit route** | Đóng băng | Không gọi, không mở rộng `b2b_briefs`. |
| GET, POST, PUT | `/api/operations/v1/products...` | Không dùng V1 | product snapshot/create/variant/policy | Phiên + `b2b.catalog.*` | **Chờ xác nhận sau audit route** | Đóng băng | Chỉ ở nhánh sạch `codex/slice1-product-application-contract`, chưa merge; không làm/không merge. |

Không có API checkout, cart, tạo đơn, payment, shipping hoặc order trong V1. Không thêm endpoint thay thế hay route BFF cho các chức năng đó.

## 9. Công việc, vai trò và phụ thuộc

| Công việc | Owner | Reviewer/router | Trạng thái | Phụ thuộc | Deliverable |
| --- | --- | --- | --- | --- | --- |
| Xác thực dữ liệu public cho family/biến thể đã chọn | Người quyết định sản phẩm | Luna review phạm vi | Chưa bắt đầu | SKU, ảnh, nội dung, giá thật **Chờ xác nhận** | Dữ liệu được duyệt; không dùng `B2B-DEMO` public |
| Chuẩn hóa catalog, hiển thị giá bậc và hai CTA handoff | Terra implement | Luna independent review; Gemini/agy simplicity/router | Chưa bắt đầu | Dữ liệu public và quy tắc Bagisto | Luồng sản phẩm + test |
| Hoàn chỉnh dịch vụ đại diện và contact → Sheet | Terra implement | Luna independent review; Gemini/agy simplicity/router | Chưa bắt đầu | Service family, trạng thái Sheet **Chờ xác nhận** | Trang + webhook vận hành |
| Thiết lập vận hành Sheet và dashboard Bagisto native | Terra implement | Luna independent review; Gemini/agy simplicity/router | Chưa bắt đầu | Cơ chế link/count, trạng thái Sheet, quyết định nguồn/tile đơn mới **Chờ xác nhận** | Quy trình nhân viên + dashboard tối giản, không mở rộng dashboard Next/B2B cũ |
| Chuyển quản trị về Bagisto admin; giữ `/quan-tri` frozen | Terra implement | Luna independent review; Gemini/agy simplicity/router | Chưa bắt đầu | Quyền employee sửa product/price và destructive **Chờ xác nhận** | Đường vận hành Bagisto admin |
| Kiểm thử và bàn giao | Terra implement | Luna independent review | Chưa bắt đầu | Các mục trên | Bằng chứng theo phần 10 |

Terra là vai trò triển khai; Luna thực hiện review độc lập; Gemini/agy kiểm tra độ đơn giản và routing. Thay đổi hành vi bắt đầu bằng test RED, rồi code GREEN tối thiểu, sau đó lint, typecheck, build và review phù hợp.

## 10. Acceptance criteria có thể kiểm thử

| MVP | Tiêu chí chấp nhận |
| --- | --- |
| Scope sản phẩm | Chỉ có family **Bột dinh dưỡng** với hai biến thể vani/ít ngọt trong V1. Bằng chứng demo chỉ dùng để xác nhận cấu trúc; SKU, ảnh, nội dung và giá thật phải được **Chờ xác nhận** và duyệt trước public. |
| Giá và quy tắc số lượng | Storefront đọc MOQ, bước số lượng, giá bậc VND và `contact_from_quantity` từ Bagisto. Chọn dưới MOQ hoặc sai bước bị chặn cả client/server. |
| Handoff dưới ngưỡng | Số lượng dưới `contact_from_quantity` chỉ hiện/mở **Yêu cầu tư vấn đặt mua**; form gửi product, variant, quantity và contact context tới Sheet, không tạo báo giá hoặc đơn trên website. |
| Handoff từ ngưỡng | Số lượng bằng/trên ngưỡng chỉ hiện/mở **Liên hệ số lượng lớn**; form gửi cùng ngữ cảnh tới Sheet, không tính báo giá tự động. |
| Service family đại diện | Có đúng một service family sau khi được **Chờ xác nhận**; CTA đi tới contact với nguồn service family đó; mỗi lần gửi thành công tạo một dòng Sheet. |
| Contact → Sheet | Một lần gửi hợp lệ `name`, `phone`, `email` tùy chọn, `message`, `source` và ngữ cảnh nhận `202` cùng mã tham chiếu; dữ liệu không hợp lệ nhận `400`; URL/secret chỉ ở server; không fallback Bagisto. Retry/dedup là **Chờ xác nhận**. |
| Nhân viên xử lý | Employee mở được Sheet từ dashboard Bagisto và có số yêu cầu mới bằng cơ chế link/count đã chốt. Trạng thái Sheet phải được **Chờ xác nhận** và có kịch bản mới → đã xử lý. Tile **đơn mới** chỉ xuất hiện nếu nguồn hệ thống ngoài và cơ chế count được **Chờ xác nhận**; nếu không, tile bị bỏ. |
| Quản trị sản phẩm/giá | Administrator sửa dữ liệu đã cho phép trong Bagisto admin và storefront phản ánh đúng. Employee sửa product/price là **Chờ xác nhận**; mặc định không cho đến khi xác nhận và sau đó kiểm tra đúng quyền. |
| Ranh giới vĩnh viễn | Không có customer account/portal, cart, checkout, tạo đơn, payment, shipping, order completion, quote engine hay API tương ứng trên website V1. Không có tính năng mới trên `/quan-tri`; không có direct core table write. |
| Chất lượng bàn giao | Focused tests, lint, typecheck, build và independent review chạy theo thay đổi thực tế; `git diff --check` không lỗi; không push. |

### Câu hỏi **Chờ xác nhận**

**Nhóm ưu tiên kế tiếp — vận hành và nội dung:**

1. Tile **đơn mới** trên dashboard lấy từ hệ thống bên ngoài nào, với cơ chế link/count nào, hay phải bỏ tile?
2. Service family đại diện là gì?
3. Các trạng thái xử lý trong Google Sheets là gì?

**Nhóm sau — quyền và dữ liệu còn lại:**

4. Employee có được sửa product/price không? Đề xuất an toàn: mặc định không cho đến khi xác nhận.
5. SKU, ảnh, nội dung và giá production của hai biến thể là gì để duyệt public?
6. Cách thêm service bằng Bagisto CMS hay cần developer là **Chờ xác nhận**; chỉ quyết định khi mở rộng sau service family đại diện.
7. Retry/dedup webhook và thao tác xóa/vô hiệu hóa catalog, Sheet, tài khoản nội bộ là **Chờ xác nhận**; không chặn luồng handoff cơ bản.
