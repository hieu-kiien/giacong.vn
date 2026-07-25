# Hồ sơ sản phẩm và kỹ thuật — Lean V1

**Trạng thái:** nguồn quyết định hiện hành và hồ sơ Lean V1 duy nhất.
**Ranh giới tài liệu:** [BAGISTO_HEADLESS_MVP.md](./BAGISTO_HEADLESS_MVP.md) là lưu trữ; [GOOGLE_SHEETS_CONTACT_WEBHOOK.md](./GOOGLE_SHEETS_CONTACT_WEBHOOK.md) là hướng dẫn vận hành webhook hiện tại. `docs/research/PAGE_TOPOLOGY.md` chỉ mô tả bố cục trang clone, không phải sitemap đích.
**Ranh giới triển khai:** hồ sơ này không sửa code/UI/Bagisto, không ghi trực tiếp bảng core Bagisto, không điều khiển hay đổi cấu hình cổng `3000`, `8000`, `8001`. Backend Bagisto nội bộ dùng `127.0.0.1:18001`. Không push.

## 1. Bài toán Lean V1

Lean V1 giúp khách B2B xem một dòng sản phẩm, chọn biến thể và số lượng hợp lệ, đọc giá theo số lượng bằng VND, hoặc chọn một dịch vụ đại diện. Khi khách gửi form sau lựa chọn đó, website chuyển yêu cầu đầy đủ ngữ cảnh sang tư vấn và tạo một dòng đơn/yêu cầu trong Google Sheet để nhân viên tư vấn, phân công và kiểm soát. Website kết thúc trách nhiệm sau khi yêu cầu được Sheet chấp nhận.

Phạm vi sản phẩm V1 là family **Bột dinh dưỡng**, gồm **Bột dinh dưỡng vị vani** và **Bột dinh dưỡng vị ít ngọt**. Đây là lựa chọn cấu trúc gọn dựa trên parent/variant trong `DemoCatalogSeeder.php`, không xác nhận danh mục production. SKU, ảnh, nội dung, giá và dữ liệu thương mại thật đều **Chờ xác nhận** trước khi duyệt public; không được coi dữ liệu `B2B-DEMO` là production.

Hiển thị giá bậc, MOQ, bước số lượng và ngưỡng liên hệ lấy từ Bagisto. Dưới `contact_from_quantity`, yêu cầu có loại **Đặt sản phẩm**; từ ngưỡng trở lên, loại là **Tư vấn số lượng lớn**. Dịch vụ đại diện đã chốt là **Sấy & thực phẩm sấy** (`say-thuc-pham-say`), luôn có loại **Tư vấn dịch vụ**. Cả ba dùng `POST /api/contact`, chuyển yêu cầu vào Sheet và không có quote engine.

Khách không tạo tài khoản. Customer login, customer account, customer portal, checkout, cart, tạo Bagisto order, thanh toán, giao hàng và hoàn tất đơn là ranh giới vĩnh viễn ngoài website V1. Không có tích hợp đơn ngoài, API summary hay dashboard Next/Bagisto cho hàng đợi này: tab **Tổng quan** trong chính Google Sheet là nơi đếm và kiểm soát vận hành.

Ngoài phạm vi vĩnh viễn: customer account/portal, checkout, cart, tạo order, payment, shipping, order completion, quote engine, vòng đời báo giá, chuyển báo giá thành order, company/team/approval, granular RBAC, request inbox trong Bagisto, nhiều service family, wizard gia công phức tạp, tệp đính kèm, BOM/nguyên liệu/QC/tiến độ xưởng, đa kênh, đa ngôn ngữ, đa tiền tệ, payment gateway, carrier, promotion và thay thế toàn bộ captured markup. `b2b_briefs` và `b2b_catalog_audits` là legacy, không mở rộng.

## 2. Người dùng và ma trận quyền

Không có tài khoản khách. Chỉ có hai loại tài khoản nội bộ: `administrator` và `employee`; không có company, team, role con hay quyền chi tiết theo người dùng. `/quan-tri` Next.js và BFF của nó là bề mặt chuyển tiếp đã đóng băng: chỉ duy trì tương thích và bảo mật, không cấp thêm quyền hay tính năng. Bagisto admin là đích quản trị dài hạn cho catalog, giá, tồn kho và tài khoản nội bộ. Google Sheet là nơi làm việc vận hành yêu cầu của nhân viên.

| Dữ liệu / thao tác | Khách | Employee | Administrator |
| --- | --- | --- | --- |
| Catalog — xem giá bậc, biến thể, quy tắc số lượng | Có | Có | Có |
| Catalog — tạo | Không | Không | Có trong Bagisto admin |
| Catalog — sửa sản phẩm, biến thể, giá | Không | **Chờ xác nhận**; đề xuất: chỉ administrator được sửa | Có trong Bagisto admin |
| Catalog — xóa | Không | Không | Không xóa cứng trong V1 |
| Yêu cầu Sheet — tạo | Gửi form chuyển yêu cầu | Không phải luồng gửi của V1 | Không phải luồng gửi của V1 |
| Yêu cầu Sheet — xem, xử lý, phân công | Không | Có | Có |
| Yêu cầu Sheet — sửa ô | Không | Chỉ cột L:N | Có; cấu hình bảo vệ Sheet/range |
| Yêu cầu Sheet — xóa hoặc đổi thứ tự dòng/cột | Không | Không | Không trong V1 |
| Tài khoản nội bộ — quản trị | Không | Chỉ tài khoản của mình nếu Bagisto hỗ trợ | Có cho `administrator`/`employee` |

Tab `Yêu cầu` dùng các cột A:O. Employee chỉ sửa L:N: **Trạng thái**, **Nhân viên phụ trách**, **Ghi chú**. A:K và O được bảo vệ; O (**Cập nhật lần cuối**) do Apps Script tự cập nhật sau một chỉnh sửa hợp lệ. Quản trị/chủ sở hữu Sheet cấu hình bảo vệ Sheet/range và dropdown; Apps Script chạy dưới tài khoản chủ sở hữu để thêm dòng, nhân viên chỉ xử lý chứ không xóa, chèn, đổi thứ tự dòng/cột.

Dropdown/data validation: `Loại` chỉ nhận **Đặt sản phẩm**, **Tư vấn số lượng lớn**, **Tư vấn dịch vụ**; `Trạng thái` chỉ nhận **Mới**, **Đang tư vấn**, **Chờ khách phản hồi**, **Đã hoàn tất**, **Không tiếp tục**. Khi rời **Mới**, `Nhân viên phụ trách` bắt buộc không rỗng. Chuyển trạng thái hợp lệ là: **Mới → Đang tư vấn**; **Đang tư vấn → Chờ khách phản hồi | Đã hoàn tất | Không tiếp tục**; **Chờ khách phản hồi → Đang tư vấn | Đã hoàn tất | Không tiếp tục**. **Đã hoàn tất** và **Không tiếp tục** là kết thúc, không mở lại trong V1.

Không thiết kế quyền cho khách, order, thanh toán, giao hàng hoặc fulfillment vì toàn bộ các bề mặt đó nằm ngoài website.

## 3. MVP và phần hoãn

| Trong MVP | Ngoài phạm vi / hoãn rõ ràng |
| --- | --- |
| Một family **Bột dinh dưỡng** với hai biến thể đã nêu, đọc dữ liệu catalog từ Bagisto | Bất kỳ catalog production nào trước khi SKU/ảnh/nội dung/giá thật được **Chờ xác nhận** và duyệt public |
| Hiển thị MOQ, bước số lượng, giá bậc và ngưỡng liên hệ | Quote engine, báo giá tự động, vòng đời báo giá |
| Hai CTA theo ngưỡng, đều `POST /api/contact` và chuyển yêu cầu vào Sheet | Customer account/portal, cart, checkout, tạo Bagisto order, payment, shipping, order completion |
| Một service family **Sấy & thực phẩm sấy** (`say-thuc-pham-say`), CTA form và webhook Google Sheets | Nhiều service family; cách quản lý dịch vụ về sau qua Bagisto CMS hay developer **Chờ xác nhận** |
| Mở rộng Apps Script/Sheet từ tab `Yeu cau` 8 cột hiện tại sang tab `Yêu cầu` 15 cột và tab **Tổng quan** | Dashboard Next/Bagisto, API summary, request inbox Bagisto, đồng bộ order external |
| Employee xử lý, phân công, cập nhật L:N; bảo vệ A:K/O, không xóa dòng | Xóa cứng dòng Sheet, cơ chế xử lý gửi trùng |
| Bagisto admin cho catalog/giá/tồn kho và tài khoản nội bộ | Mở rộng `/quan-tri`, `b2b_briefs`, `b2b_catalog_audits`, full audit |
| Tiếng Việt, VND, giữ storefront/contact hiện có và thay giao diện dần | Đa kênh, đa locale, đa tiền tệ, promotion, redesign toàn diện |

Hiện `POST /api/contact` chỉ nhận contract năm trường `name, phone, email, message, source`; Apps Script/guide hiện chỉ tạo tab `Yeu cau` với tám cột. Việc thêm `request_type, product, service, variant, qty`, gán loại theo ngưỡng ở server và thay Sheet thành schema mục tiêu là **Cần làm**, không phải hành vi đã có.

Không hồi sinh phần ngoài phạm vi dưới tên khác. Không tạo bảng cho phần hoãn và không ghi trực tiếp bảng core Bagisto từ code mới.

## 4. Sitemap đích

Sitemap là đích Lean V1, không suy diễn từ `docs/research/PAGE_TOPOLOGY.md`.

```text
/
├─ /san-pham
│  └─ /san-pham/[slug]                 Chi tiết, biến thể, giá bậc, số lượng, CTA form/chuyển yêu cầu
├─ /thue-gia-cong
│  └─ /thue-gia-cong/say-thuc-pham-say Dịch vụ Sấy & thực phẩm sấy, CTA form/chuyển yêu cầu
├─ /lien-he                            Form chung; nhận ngữ cảnh sản phẩm/dịch vụ
├─ /gioi-thieu và nội dung storefront hiện có
├─ Google Sheet (nơi làm việc nhân viên)
│  ├─ tab Yêu cầu                      Hàng đợi, phân công, trạng thái, ghi chú
│  └─ tab Tổng quan                    Đếm Đơn mới và Yêu cầu mới
├─ Bagisto admin (quản trị dài hạn)    Catalog, giá, tồn, tài khoản nội bộ
└─ /quan-tri                           Tồn tại để chuyển tiếp, frozen; không mở rộng
```

Không có sitemap customer login/account/portal, cart, checkout, payment, shipping, order, quote, company, team, approval, audit hoặc dashboard vận hành riêng.

## 5. User flows ưu tiên

1. **Sản phẩm, dưới ngưỡng → Đặt sản phẩm.** Khách mở `/san-pham/[slug]`, chọn vani hoặc ít ngọt, nhập số lượng thỏa MOQ và bước số lượng. Storefront hiển thị giá bậc VND từ Bagisto. Nếu số lượng nhỏ hơn `contact_from_quantity`, CTA **Yêu cầu tư vấn đặt mua** mở `/lien-he`; sau phần mở rộng cần làm, form gửi `product`, `variant`, `qty`, nguồn và `request_type=Đặt sản phẩm` tới `/api/contact`. Một lần gửi được chấp nhận tạo một dòng Sheet.
2. **Sản phẩm, từ ngưỡng → Tư vấn số lượng lớn.** Cùng quy tắc chọn, nếu số lượng bằng hoặc lớn hơn ngưỡng, server phải thực thi quy tắc và CTA đổi thành **Liên hệ số lượng lớn**. Sau phần mở rộng cần làm, form gửi `product`, `variant`, `qty`, nguồn và `request_type=Tư vấn số lượng lớn`; một lần gửi được chấp nhận tạo một dòng Sheet.
3. **Dịch vụ → Tư vấn dịch vụ.** Khách vào `/thue-gia-cong/say-thuc-pham-say`, đọc nội dung/lựa chọn cần thiết và gửi form. Sau phần mở rộng cần làm, form gửi `service=Sấy & thực phẩm sấy`, nguồn service và `request_type=Tư vấn dịch vụ`; một lần gửi được chấp nhận tạo một dòng Sheet, không tạo brief hoặc order trong Bagisto.
4. **Nhân viên xử lý trong Sheet.** Employee mở tab **Yêu cầu**, lọc các dòng **Mới**, đặt người phụ trách và chuyển sang **Đang tư vấn**. Sau đó chỉ đi theo chuyển trạng thái ở phần 2; employee chỉ sửa L:N, Apps Script cập nhật O, còn Sheet/range ngăn xóa hoặc đổi thứ tự dòng/cột. Tab **Tổng quan** đếm **Đơn mới** là `Loại=Đặt sản phẩm` và `Trạng thái=Mới`, còn **Yêu cầu mới** là hai loại tư vấn và `Trạng thái=Mới`.
5. **Quản trị catalog trong Bagisto.** Administrator sửa catalog, biến thể, giá bậc và ngưỡng qua Bagisto admin, rồi kiểm tra storefront đọc đúng dữ liệu. Quyền employee sửa product/price là **Chờ xác nhận**; đề xuất mặc định chỉ administrator được sửa. Không dùng ghi thẳng MySQL hoặc endpoint `operations/v1` chưa nhập.

Luồng cơ bản chỉ bảo đảm một lần gửi được chấp nhận tạo một dòng. Retry, gửi trùng hoặc replay nghi vấn là chính sách **Chờ xác nhận**; chưa có cơ chế xử lý gửi trùng trong V1.

## 6. Wireframe low-fi

Wireframe chỉ diễn tả luồng phần 5, không tạo ngôn ngữ giao diện mới.

```text
[Trang sản phẩm: Bột dinh dưỡng]
 Tên | ảnh/nội dung đã được duyệt public
 Biến thể [Vani | Ít ngọt]   Số lượng [-  ___  +]   MOQ / bước / giá bậc VND
 ├─ dưới ngưỡng: [Yêu cầu tư vấn đặt mua] → [Form: Loại=Đặt sản phẩm] → Sheet
 └─ từ ngưỡng : [Liên hệ số lượng lớn]   → [Form: Loại=Tư vấn số lượng lớn] → Sheet

[Trang dịch vụ: Sấy & thực phẩm sấy]
 Nội dung hiện có | lựa chọn cần thiết
 [Liên hệ dịch vụ] → [Form: Loại=Tư vấn dịch vụ] → Sheet

[Form liên hệ]
 Họ tên | Điện thoại | Email tùy chọn | Nội dung
 Ngữ cảnh chỉ đọc: sản phẩm / biến thể / số lượng hoặc dịch vụ, nếu có
 [Gửi yêu cầu] → Apps Script tạo Mã tham chiếu → thêm dòng Sheet

[Google Sheet]
 [Yêu cầu] A:K,O khóa | L:N nhân viên sửa | dropdown Loại/Trạng thái
 Mới → Đang tư vấn → [Chờ khách phản hồi | Đã hoàn tất | Không tiếp tục]
 [Tổng quan] Đơn mới | Yêu cầu mới

[Bagisto admin]
 Catalog | giá | tồn kho | tài khoản nội bộ
```

## 7. ERD tối thiểu và ranh giới dữ liệu

Bagisto core được đọc/ghi qua service, repository hoặc API Bagisto; code mới không ghi trực tiếp bảng core. `b2b_product_configs` là cấu hình B2B hiện có theo biến thể. Google Sheets là đích duy nhất của hàng đợi đơn/yêu cầu. Không thiết kế bảng khách, cart, checkout, payment, shipping hoặc order cho website V1.

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
Next POST /api/contact ──webhook──> Apps Script (chủ sở hữu) ──> Google Sheet / "Yêu cầu"
                                       createReference() tạo Mã
                                      A Mã | B Thời gian | C Loại | D Sản phẩm/Dịch vụ
                                      E Biến thể | F Số lượng | G Họ tên | H Điện thoại | I Email
                                      J Nội dung | K Nguồn | L Trạng thái | M Nhân viên phụ trách
                                      N Ghi chú | O Cập nhật lần cuối
                                      A:K,O bảo vệ; L:N employee được sửa

Google Sheet / "Tổng quan"
  Đơn mới     = COUNTIFS('Yêu cầu'!C:C, "Đặt sản phẩm", 'Yêu cầu'!L:L, "Mới")
  Yêu cầu mới = COUNTIFS('Yêu cầu'!C:C, "Tư vấn số lượng lớn", 'Yêu cầu'!L:L, "Mới")
               + COUNTIFS('Yêu cầu'!C:C, "Tư vấn dịch vụ", 'Yêu cầu'!L:L, "Mới")

Legacy, không mở rộng: b2b_briefs; b2b_catalog_audits
```

`Mã` là mã tham chiếu duy nhất do Apps Script tạo bằng `createReference()` khi thêm dòng. `Trạng thái` chỉ nhận năm giá trị ở phần 2, và Apps Script tự cập nhật O sau chỉnh sửa hợp lệ. Một lần gửi được chấp nhận tạo một hàng; chính sách retry/gửi trùng/replay là **Chờ xác nhận**, nên chưa gộp, bỏ hoặc xác định lại các lần gửi này. Migration hiện chỉ ép tối đa một `b2b_product_configs` cho mỗi `product_id`; nó không ép mọi variant phải có config nên quan hệ là `0..1`.

## 8. API và trạng thái chuyển tiếp

Trạng thái chính chỉ có một giá trị mỗi route: **hiện có**, **chuyển tiếp**, **cần làm** hoặc **đóng băng**. Với BFF Next, `502/504` là lỗi upstream không sẵn sàng/quá thời gian.

| Method | Path | Người dùng | Input → output | Quyền | Lỗi chính | Trạng thái chính | Hành động V1 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/api/contact` | Khách | Hiện có: `name, phone, email, message, source` → `202 {ok, reference}`. Mục tiêu: thêm `request_type, product?, service?, variant?, qty?` | Public | 400; 502/503/504 webhook | Cần làm | Route năm trường hiện có; cần mở rộng contract, xác thực/gán một trong ba `request_type` theo ngưỡng ở server, rồi chuyển yêu cầu sang Apps Script mục tiêu 15 cột. `Mã` do `createReference()` của Apps Script tạo; không tạo Bagisto order, không fallback Bagisto. |
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
| GET | `/api/b2b/admin/v1/dashboard` | Nội bộ | — → dashboard catalog hiện tại | `b2b.dashboard` | 401/403 | Chuyển tiếp | Không mở rộng; không tích hợp hàng đợi Sheet hoặc số đếm V1. |
| GET | `/api/b2b/admin/v1/product-aggregates` | Nội bộ | lọc → danh sách sản phẩm | `b2b.catalog.read` | 401/403/422 | Chuyển tiếp | Chỉ duy trì bề mặt cũ trong khi vận hành catalog chuyển về Bagisto admin. |
| GET | `/api/b2b/admin/v1/product-aggregates/{slug}` | Nội bộ | `slug` → chi tiết | `b2b.catalog.read` | 401/403/404 | Chuyển tiếp | Chỉ duy trì tương thích. |
| PUT | `/api/b2b/admin/v1/product-aggregates/{slug}/commercial-rules` | Nội bộ | version, published, variants → product | `b2b.catalog.write` | 401/403/404/412/419/422/428/429 | Chuyển tiếp | Không dùng cho tính năng V1 mới; quyền employee sửa product/price vẫn **Chờ xác nhận**. |
| GET | `/api/b2b/catalog/categories` | Storefront | — → categories | Public, throttled | 429; lỗi khác cần audit route | Hiện có | Nguồn catalog khi cần; không thành CMS service. |
| GET | `/api/b2b/catalog/products` | Storefront | lọc → products | Public, throttled | 429; lỗi khác cần audit route | Hiện có | Nguồn catalog cho family đại diện; không có quote data. |
| GET | `/api/b2b/catalog/products/{slug}` | Storefront | `slug` → product/variant/rules | Public, throttled | 404/429; lỗi khác cần audit route | Hiện có | Dùng cho product flow; enforce ngưỡng ở server. |
| POST | `/api/b2b/briefs` | Không dùng V1 | brief → legacy record | Public, throttled | 429; lỗi khác cần audit route | Đóng băng | Không gọi, không mở rộng `b2b_briefs`. |
| GET, POST, PUT | `/api/operations/v1/products...` | Không dùng V1 | product snapshot/create/variant/policy | Phiên + `b2b.catalog.*` | Cần audit route | Đóng băng | Chỉ ở nhánh sạch `codex/slice1-product-application-contract`, chưa merge; không làm/không merge. |

Không có API checkout, cart, tạo order, payment, shipping, order, đồng bộ order external hoặc API summary trong V1.

## 9. Công việc, vai trò và phụ thuộc

| Công việc | Owner | Reviewer/router | Trạng thái | Phụ thuộc | Deliverable |
| --- | --- | --- | --- | --- | --- |
| Xác thực dữ liệu public cho family/biến thể đã chọn | Người quyết định sản phẩm | Luna review phạm vi | Chưa bắt đầu | SKU, ảnh, nội dung, giá thật **Chờ xác nhận** | Dữ liệu được duyệt; không dùng `B2B-DEMO` public |
| Chuẩn hóa catalog, hiển thị giá bậc và hai CTA chuyển yêu cầu | Terra implement | Luna independent review; Gemini/agy simplicity/router | Chưa bắt đầu | Dữ liệu public và quy tắc Bagisto | Luồng sản phẩm + test |
| Mở rộng `/api/contact` và Apps Script | Terra implement | Luna independent review; Gemini/agy simplicity/router | Chưa bắt đầu | Contract mới, Apps Script/guide 8 cột hiện tại | `request_type/product/service/variant/qty`, gán loại server, Apps Script `Yêu cầu` 15 cột và `Tổng quan` |
| Thiết lập quy trình Sheet tối thiểu | Terra implement | Luna independent review; Gemini/agy simplicity/router | Chưa bắt đầu | Quyền truy cập Google Sheet | Dropdown, bảo vệ A:K/O và cấu trúc Sheet, L:N employee sửa, chuyển trạng thái, Apps Script tự cập nhật O |
| Hoàn chỉnh **Sấy & thực phẩm sấy** | Terra implement | Luna independent review; Gemini/agy simplicity/router | Chưa bắt đầu | Nội dung dịch vụ | Trang + chuyển yêu cầu Sheet |
| Chuyển quản trị catalog về Bagisto admin; giữ `/quan-tri` frozen | Terra implement | Luna independent review; Gemini/agy simplicity/router | Chưa bắt đầu | Quyền employee sửa product/price **Chờ xác nhận** | Đường vận hành Bagisto admin |
| Kiểm thử và bàn giao | Terra implement | Luna independent review | Chưa bắt đầu | Các mục trên; chính sách gửi trùng/replay **Chờ xác nhận** | Bằng chứng theo phần 10 |

Terra là vai trò triển khai; Luna thực hiện review độc lập; Gemini/agy kiểm tra độ đơn giản và routing. Thay đổi hành vi bắt đầu bằng test RED, rồi code GREEN tối thiểu, sau đó lint, typecheck, build và review phù hợp.

## 10. Acceptance criteria có thể kiểm thử

| MVP | Tiêu chí chấp nhận |
| --- | --- |
| Scope sản phẩm | Chỉ có family **Bột dinh dưỡng** với hai biến thể vani/ít ngọt trong V1. Bằng chứng demo chỉ dùng để xác nhận cấu trúc; SKU, ảnh, nội dung và giá thật phải được **Chờ xác nhận** và duyệt trước public. |
| Giá và quy tắc số lượng | Storefront đọc MOQ, bước số lượng, giá bậc VND và `contact_from_quantity` từ Bagisto. Chọn dưới MOQ hoặc sai bước bị chặn cả client/server. |
| Chuyển yêu cầu dưới ngưỡng | Số lượng dưới `contact_from_quantity` chỉ hiện/mở **Yêu cầu tư vấn đặt mua**; phần mở rộng cần làm tạo một hàng Sheet loại **Đặt sản phẩm** với product, variant, qty và contact context, không tạo báo giá hoặc Bagisto order. |
| Chuyển yêu cầu từ ngưỡng | Số lượng bằng/trên ngưỡng chỉ hiện/mở **Liên hệ số lượng lớn**; phần mở rộng cần làm tạo một hàng Sheet loại **Tư vấn số lượng lớn** với cùng ngữ cảnh, không tính báo giá tự động. |
| Service family đại diện | Có đúng một service family **Sấy & thực phẩm sấy** tại slug `say-thuc-pham-say`; CTA hợp lệ tạo một hàng Sheet loại **Tư vấn dịch vụ**, không tạo brief hay order. |
| Contact → Sheet | Route hiện có năm trường được mở rộng và kiểm thử cho `request_type`, `product`, `service`, `variant`, `qty` và gán loại ở server. Apps Script tạo `Mã` bằng `createReference()`, thêm đúng schema 15 cột; URL/secret chỉ ở server; không fallback Bagisto. |
| Hàng đợi nhân viên | Quản trị/chủ sở hữu cấu hình bảo vệ để employee chỉ sửa L:N; A:K/O và cấu trúc Sheet không bị employee xóa/đổi thứ tự. Dropdown chặn Loại/Trạng thái ngoài danh sách; rời **Mới** không có nhân viên phụ trách bị từ chối; Apps Script tự cập nhật O. |
| Trạng thái Sheet | Chỉ cho phép các chuyển trạng thái ở phần 2; **Đã hoàn tất** và **Không tiếp tục** không mở lại trong V1. |
| Tổng quan Sheet | Tab **Tổng quan** trong cùng Google Sheet hiển thị `Đơn mới` đúng bằng loại **Đặt sản phẩm** + trạng thái **Mới**, và `Yêu cầu mới` đúng bằng hai loại tư vấn + trạng thái **Mới**. Không có dashboard Next/Bagisto, API summary hoặc đồng bộ order external cho các số này. |
| Gửi trùng | Một lần gửi được chấp nhận tạo một dòng; retry/gửi trùng/replay là **Chờ xác nhận** và không bị ngầm gộp hay loại bỏ. |
| Quản trị sản phẩm/giá | Administrator sửa dữ liệu đã cho phép trong Bagisto admin và storefront phản ánh đúng. Employee sửa product/price là **Chờ xác nhận**; đề xuất chỉ administrator được sửa. |
| Ranh giới vĩnh viễn | Không có customer account/portal, cart, checkout, tạo Bagisto order, payment, shipping, order completion, quote engine hay API tương ứng trên website V1. Không có tính năng mới trên `/quan-tri`; không có direct core table write. |
| Chất lượng bàn giao | Focused tests, lint, typecheck, build và independent review chạy theo thay đổi thực tế; `git diff --check` không lỗi; không push. |

### Câu hỏi ưu tiên kế tiếp

1. Employee có được sửa product/price không? **Chờ xác nhận.** Đề xuất: chỉ administrator được sửa.
2. Khi mở rộng sau này, dịch vụ nên được quản lý qua Bagisto CMS hay bởi developer? **Chờ xác nhận.** Đề xuất: Bagisto CMS.
3. Retry, gửi trùng hoặc replay nghi vấn nên tạo hàng riêng hay gộp? **Chờ xác nhận.** Đề xuất: mỗi submit tạo một hàng có Mã riêng; nhân viên đánh dấu trùng, không xây cơ chế xử lý gửi trùng.
