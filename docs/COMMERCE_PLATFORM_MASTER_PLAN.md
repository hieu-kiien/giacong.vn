# Hồ sơ sản phẩm và kỹ thuật — Lean V1

**Trạng thái:** nguồn quyết định hiện hành và hồ sơ Lean V1 duy nhất.
**Ranh giới tài liệu:** [BAGISTO_HEADLESS_MVP.md](./BAGISTO_HEADLESS_MVP.md) là lưu trữ; [GOOGLE_SHEETS_CONTACT_WEBHOOK.md](./GOOGLE_SHEETS_CONTACT_WEBHOOK.md) mô tả webhook hiện tại. `docs/research/PAGE_TOPOLOGY.md` chỉ là bố cục clone, không phải sitemap đích.
**Ranh giới triển khai:** hồ sơ này không sửa code/UI/Bagisto, không ghi trực tiếp bảng core Bagisto, không đổi cổng `3000`, `8000`, `8001`. Backend Bagisto nội bộ dùng `127.0.0.1:18001`. Không push.

## 1. Bài toán Lean V1

Lean V1 cho khách B2B xem catalog, chọn biến thể và số lượng hợp lệ, đọc giá theo số lượng bằng VND, hoặc chọn dịch vụ; sau đó gửi form có đủ ngữ cảnh. Website chuyển yêu cầu sang Google Sheet qua Apps Script và kết thúc trách nhiệm khi một submit được chấp nhận. Không có báo giá tự động, order, thanh toán, giao hàng hay fulfillment trong website V1.

Phạm vi sản phẩm V1 là family **Bột dinh dưỡng**, gồm **Bột dinh dưỡng vị vani** và **Bột dinh dưỡng vị ít ngọt**. Đây là lựa chọn cấu trúc gọn dựa trên parent/variant trong `DemoCatalogSeeder.php`, không xác nhận catalog production. SKU, ảnh, nội dung, giá và dữ liệu thương mại thật đều **Chờ xác nhận** trước khi duyệt public; dữ liệu `B2B-DEMO` không phải dữ liệu production.

Dịch vụ đại diện V1 là **Sấy & thực phẩm sấy** (`say-thuc-pham-say`). Hiện storefront còn chứa `serviceFamilies` và nội dung captured tĩnh; chúng phải được kiểm kê rồi di trú hoặc ánh xạ có chọn lọc vào Bagisto CMS/read API. Đây là **Cần làm**. Không có bằng chứng rằng Bagisto native CMS hiện đã cấp nội dung cho Next storefront.

Chỉ có một loại tài khoản nội bộ là `administrator`; khách không có tài khoản. Người tư vấn và người xử lý Sheet đều là administrator. Số lượng tài khoản administrator (một tài khoản dùng chung hay nhiều tài khoản cùng vai trò theo tên) là **Chờ xác nhận**. Đề xuất dùng các tài khoản định danh riêng để tăng an toàn và truy vết, nhưng không tạo role chi tiết.

Mục tiêu bàn giao là autonomy vận hành bị khóa: administrator dùng Bagisto admin và Google Sheet để quản lý dữ liệu/nội dung hằng ngày mà không cần lập trình viên. Điều này không cho phép ghi trực tiếp core Bagisto hay mở rộng `/quan-tri`. Ranh giới “không cần lập trình viên” có bao gồm đổi bố cục trang, điều hướng hoặc chức năng mới hay không là **Chờ xác nhận**. Đề xuất chỉ no-code cho dữ liệu/nội dung hằng ngày; cấu trúc/bố cục/chức năng mới vẫn là code. Nếu cần no-code toàn bộ bố cục, phải bổ sung page builder và mở rộng phạm vi, không tự thêm vào Lean V1.

Ngoài phạm vi vĩnh viễn: customer account/portal, cart, checkout, tạo Bagisto order, payment, shipping, order completion, quote engine, vòng đời báo giá, company/team/approval, granular RBAC, request inbox Bagisto, wizard gia công phức tạp, tệp đính kèm, BOM/nguyên liệu/QC/tiến độ xưởng, đa kênh, đa ngôn ngữ, đa tiền tệ, payment gateway, carrier, promotion và thay thế toàn bộ captured markup. `b2b_briefs` và `b2b_catalog_audits` là legacy, không mở rộng.

## 2. Người dùng và ma trận quyền

Không có tài khoản khách. `administrator` là loại tài khoản nội bộ duy nhất; không có role/type nội bộ khác, company, team hay quyền chi tiết theo người dùng. `/quan-tri` Next.js và BFF của nó là bề mặt chuyển tiếp đã đóng băng: chỉ duy trì tương thích và bảo mật. Bagisto admin là đích quản trị dài hạn; Google Sheet là nơi xử lý yêu cầu.

| Dữ liệu / thao tác | Khách | Administrator |
| --- | --- | --- |
| Catalog — xem sản phẩm, biến thể, giá bậc, tồn kho công khai và chính sách số lượng | Đọc | Đọc trong storefront/Bagisto admin |
| Catalog — tạo, sửa, ẩn/hiện, sắp xếp sản phẩm và biến thể | Không | CRUD vận hành trong màn hình product admin hiện có của Bagisto; không ghi trực tiếp core |
| Catalog — giá, tồn kho, MOQ, bước số lượng, ngưỡng liên hệ | Không | Tạo/sửa/ẩn/kiểm tra trong màn hình product admin hiện có của Bagisto sau khi mở rộng các field B2B **Cần làm** |
| Service family, trang dịch vụ, nội dung, media | Đọc nội dung public | CRUD vận hành qua Bagisto CMS/read API sau khi di trú/ánh xạ có chọn lọc **Cần làm** |
| Trang chủ, nội dung doanh nghiệp và thông tin liên hệ được chỉ định editable | Đọc | Sửa nội dung/media/contact qua Bagisto CMS/read API sau khi thiết lập **Cần làm** |
| Yêu cầu Sheet — tạo | Gửi form; submit được chấp nhận tạo dòng riêng | Apps Script thêm dòng, không qua Bagisto order |
| Yêu cầu Sheet — xem, lọc, xử lý, phân công, ghi chú | Không | CRUD xử lý trong L:N: **Trạng thái**, **Người phụ trách**, **Ghi chú** |
| Yêu cầu Sheet — xóa hoặc đổi thứ tự dòng/cột | Không | Không trong V1; cấu trúc được bảo vệ |
| Tài khoản nội bộ | Không | Quản lý các tài khoản cùng loại `administrator` trong Bagisto theo khả năng đã audit; không có granular role |

Tab `Yêu cầu` có đúng 15 cột A:O. Administrator chỉ sửa L:N; A:K và O được bảo vệ, O (**Cập nhật lần cuối**) do Apps Script cập nhật sau chỉnh sửa hợp lệ. Chủ sở hữu Sheet cấu hình protection/range và dropdown; Apps Script chạy dưới tài khoản chủ sở hữu để thêm dòng. Tài khoản Google/Workspace khách hàng sở hữu Sheet và Apps Script là **Chờ xác nhận**.

Dropdown/data validation: `Loại` chỉ nhận **Đặt sản phẩm**, **Tư vấn số lượng lớn**, **Tư vấn dịch vụ**; `Trạng thái` chỉ nhận **Mới**, **Đang tư vấn**, **Chờ khách phản hồi**, **Đã hoàn tất**, **Không tiếp tục**. Khi rời **Mới**, `Người phụ trách` bắt buộc không rỗng. Chuyển trạng thái hợp lệ: **Mới → Đang tư vấn**; **Đang tư vấn → Chờ khách phản hồi | Đã hoàn tất | Không tiếp tục**; **Chờ khách phản hồi → Đang tư vấn | Đã hoàn tất | Không tiếp tục**. **Đã hoàn tất** và **Không tiếp tục** là kết thúc, không mở lại trong V1.

Mỗi submit được chấp nhận luôn tạo một `Mã`/dòng Apps Script riêng. Không có merge hoặc dedup engine. Nếu administrator kết luận một dòng trùng, đặt `Trạng thái=Không tiếp tục` và ghi `Trùng mã <reference>` ở `Ghi chú`.

## 3. MVP và phần hoãn

| Trong MVP | Ngoài phạm vi / hoãn rõ ràng |
| --- | --- |
| Một family **Bột dinh dưỡng** với hai biến thể đã nêu, đọc catalog từ Bagisto | Catalog production trước khi SKU/ảnh/nội dung/giá thật hết trạng thái **Chờ xác nhận** và được duyệt public |
| Hiển thị MOQ, bước số lượng, giá bậc và ngưỡng liên hệ | Quote engine, báo giá tự động, vòng đời báo giá |
| Hai CTA theo ngưỡng, đều `POST /api/contact` rồi chuyển yêu cầu vào Sheet | Customer account/portal, cart, checkout, tạo Bagisto order, payment, shipping, order completion |
| Một service family **Sấy & thực phẩm sấy**; CTA form và webhook Sheet | Nhiều service family public trong V1; dù vậy cơ chế quản trị content cần hỗ trợ family/page theo autonomy đã chốt |
| Mở rộng Apps Script/Sheet từ tab `Yeu cau` 8 cột hiện tại sang tab `Yêu cầu` 15 cột và tab **Tổng quan** | Dashboard Next/Bagisto, API summary, request inbox Bagisto, đồng bộ order external |
| Administrator xử lý L:N; A:K/O và cấu trúc Sheet được bảo vệ | Xóa cứng dòng Sheet, merge/dedup engine |
| Bagisto admin cho catalog, giá, tồn và nội dung vận hành sau phần mở rộng **Cần làm** | Mở rộng `/quan-tri`, `b2b_briefs`, `b2b_catalog_audits`, full audit |
| Di trú/ánh xạ có chọn lọc serviceFamilies/captured content sang Bagisto CMS/read API **Cần làm** | Cam kết sẵn có của Bagisto CMS cho Next trước khi triển khai/audit |
| Tiếng Việt, VND, giữ storefront/contact hiện có và thay giao diện dần | Đa kênh, đa locale, đa tiền tệ, promotion, redesign toàn diện |

Hiện `POST /api/contact` chỉ nhận `name, phone, email, message, source`; Apps Script/guide hiện tạo tab `Yeu cau` tám cột. Thêm `request_type, product, service, variant, qty`, gán loại theo ngưỡng ở server, 15 cột mục tiêu, protection và workflow là **Cần làm**, không phải hành vi đã có.

Custom B2B product policy fields phải xuất hiện trong màn hình product admin hiện có của Bagisto qua extension; không tạo UI quản trị mới hoặc mở rộng `/quan-tri`. Việc có thể tự thay đổi bố cục/điều hướng/chức năng mới sau bàn giao là **Chờ xác nhận** và không nằm trong MVP mặc định.

## 4. Sitemap đích

Sitemap là đích Lean V1, không suy diễn từ `docs/research/PAGE_TOPOLOGY.md`.

```text
/
├─ /san-pham
│  └─ /san-pham/[slug]                 Chi tiết, biến thể, giá bậc, số lượng, CTA form
├─ /thue-gia-cong
│  └─ /thue-gia-cong/say-thuc-pham-say Dịch vụ đại diện, CTA form
├─ /lien-he                            Form chung, nhận ngữ cảnh sản phẩm/dịch vụ
├─ /gioi-thieu và storefront content được chỉ định editable
├─ Google Sheet (hàng đợi vận hành)
│  ├─ tab Yêu cầu                      Dòng yêu cầu, trạng thái, người phụ trách, ghi chú
│  └─ tab Tổng quan                    Đếm Đơn mới và Yêu cầu mới
├─ Bagisto admin (đích quản trị)       Catalog, giá, tồn, policy B2B, CMS/content/media, accounts
└─ /quan-tri                           Tồn tại chuyển tiếp, frozen; không mở rộng
```

Không có sitemap customer login/account/portal, cart, checkout, payment, shipping, order, quote, company, team, approval, dashboard vận hành riêng hoặc một màn hình quản trị mới.

## 5. User flows ưu tiên

1. **Sản phẩm, dưới ngưỡng → Đặt sản phẩm.** Khách mở `/san-pham/[slug]`, chọn vani hoặc ít ngọt, nhập số lượng thỏa MOQ và bước số lượng. Storefront hiển thị giá bậc VND từ Bagisto. Dưới `contact_from_quantity`, CTA **Yêu cầu tư vấn đặt mua** mở `/lien-he`; phần **Cần làm** gửi `product`, `variant`, `qty`, nguồn và `request_type=Đặt sản phẩm` tới `/api/contact`. Mỗi submit được chấp nhận tạo một dòng Sheet riêng.
2. **Sản phẩm, từ ngưỡng → Tư vấn số lượng lớn.** Cùng quy tắc chọn; khi số lượng bằng hoặc lớn hơn ngưỡng, server thực thi quy tắc và CTA đổi thành **Liên hệ số lượng lớn**. Phần **Cần làm** gửi `request_type=Tư vấn số lượng lớn` cùng ngữ cảnh; mỗi submit được chấp nhận tạo một dòng Sheet riêng.
3. **Dịch vụ → Tư vấn dịch vụ.** Khách vào `/thue-gia-cong/say-thuc-pham-say`, đọc content public và gửi form. Phần **Cần làm** gửi `service=Sấy & thực phẩm sấy`, nguồn service và `request_type=Tư vấn dịch vụ`; mỗi submit được chấp nhận tạo một dòng riêng, không tạo brief hoặc Bagisto order.
4. **Administrator xử lý Sheet.** Administrator lọc các dòng **Mới**, điền **Người phụ trách** và chuyển **Đang tư vấn**, sau đó chỉ đi theo chuyển trạng thái ở phần 2. Administrator chỉ sửa L:N; Apps Script cập nhật O; Sheet/range chặn xóa hoặc đổi thứ tự dòng/cột. Nếu đánh giá trùng, administrator chuyển **Không tiếp tục** và ghi `Trùng mã <reference>`. Tab **Tổng quan** đếm **Đơn mới** là `Loại=Đặt sản phẩm` + `Trạng thái=Mới`; **Yêu cầu mới** là hai loại tư vấn + `Trạng thái=Mới`.
5. **Administrator quản trị catalog và content.** Administrator dùng Bagisto admin để thêm/sửa/ẩn/sắp xếp sản phẩm, biến thể, giá, tồn, MOQ, bước số lượng, ngưỡng liên hệ; rồi kiểm tra storefront. Qua CMS/read API **Cần làm**, administrator cũng quản lý service family/page/content/media, homepage, thông tin doanh nghiệp và liên hệ được chỉ định editable. Các field B2B nằm trong màn hình product admin hiện có qua extension; không dùng ghi thẳng MySQL hoặc endpoint `/quan-tri`/`operations/v1` mới.

## 6. Wireframe low-fi

Wireframe chỉ diễn tả các luồng ở phần 5, không tạo ngôn ngữ giao diện mới.

```text
[Trang sản phẩm: Bột dinh dưỡng]
 Tên | ảnh/nội dung được duyệt public
 Biến thể [Vani | Ít ngọt]   Số lượng [-  ___  +]   MOQ / bước / giá bậc VND
 ├─ dưới ngưỡng: [Yêu cầu tư vấn đặt mua] → [Form: Loại=Đặt sản phẩm] → Sheet
 └─ từ ngưỡng : [Liên hệ số lượng lớn]   → [Form: Loại=Tư vấn số lượng lớn] → Sheet

[Trang dịch vụ: Sấy & thực phẩm sấy]
 Nội dung/media do CMS cấp sau phần Cần làm
 [Liên hệ dịch vụ] → [Form: Loại=Tư vấn dịch vụ] → Sheet

[Form liên hệ]
 Họ tên | Điện thoại | Email tùy chọn | Nội dung
 Ngữ cảnh chỉ đọc: sản phẩm / biến thể / số lượng hoặc dịch vụ, nếu có
 [Gửi yêu cầu] → Apps Script tạo Mã riêng → thêm một dòng Sheet

[Google Sheet]
 [Yêu cầu] A:K,O khóa | L:N administrator sửa | dropdown Loại/Trạng thái
 Mới → Đang tư vấn → [Chờ khách phản hồi | Đã hoàn tất | Không tiếp tục]
 Trùng đã đánh giá → Không tiếp tục + Ghi chú “Trùng mã <reference>”
 [Tổng quan] Đơn mới | Yêu cầu mới

[Bagisto admin]
 Màn hình product hiện có + extension policy B2B | catalog | giá | tồn | CMS/content/media
```

## 7. ERD tối thiểu và ranh giới dữ liệu

Bagisto core được đọc/ghi qua service, repository hoặc API Bagisto; code mới không ghi trực tiếp bảng core. `b2b_product_configs` là cấu hình B2B hiện có theo biến thể. Google Sheets là đích duy nhất của hàng đợi yêu cầu. Không thiết kế bảng khách, cart, checkout, payment, shipping hoặc order cho website V1.

```text
Bagisto core (qua service/repository/admin UI hiện có)
  products (parent: Bột dinh dưỡng) 1 ── * products (variant: Vani | Ít ngọt)
  products (variant) 1 ── 0..1 b2b_product_configs
                                  ├─ unit
                                  ├─ moq
                                  ├─ quantity_step
                                  └─ contact_from_quantity
  products/variants ── giá bậc, tồn kho (core Bagisto)

Bagisto CMS/content model — Cần làm, sau audit
  service family/page/content/media ──> Next storefront read API
  homepage/business/contact designated content ──> Next storefront read API

Next storefront ──đọc qua API──> Bagisto catalog + policy B2B + content sau Cần làm
Next POST /api/contact ──webhook──> Apps Script (chủ sở hữu) ──> Google Sheet / “Yêu cầu”
                                       createReference() tạo Mã riêng cho mỗi submit được chấp nhận
                                      A Mã | B Thời gian | C Loại | D Sản phẩm/Dịch vụ
                                      E Biến thể | F Số lượng | G Họ tên | H Điện thoại | I Email
                                      J Nội dung | K Nguồn | L Trạng thái | M Người phụ trách
                                      N Ghi chú | O Cập nhật lần cuối
                                      A:K,O bảo vệ; L:N administrator sửa

Google Sheet / “Tổng quan”
  Đơn mới     = COUNTIFS('Yêu cầu'!C:C, “Đặt sản phẩm”, 'Yêu cầu'!L:L, “Mới”)
  Yêu cầu mới = COUNTIFS('Yêu cầu'!C:C, “Tư vấn số lượng lớn”, 'Yêu cầu'!L:L, “Mới”)
               + COUNTIFS('Yêu cầu'!C:C, “Tư vấn dịch vụ”, 'Yêu cầu'!L:L, “Mới”)

Legacy, không mở rộng: b2b_briefs; b2b_catalog_audits
```

`Mã` là mã tham chiếu riêng do Apps Script tạo khi thêm dòng. Migration hiện chỉ ép tối đa một `b2b_product_configs` cho mỗi `product_id`; nó không ép mọi variant phải có config nên quan hệ là `0..1`. Nếu một yêu cầu bị đánh giá trùng, dòng vẫn giữ nguyên, được đánh dấu kết thúc với ghi chú tham chiếu; không hợp nhất dữ liệu và không có dedup engine.

## 8. API và trạng thái chuyển tiếp

Trạng thái chính của route chỉ là **Hiện có**, **Chuyển tiếp**, **Cần làm** hoặc **Đóng băng**. Với BFF Next, `502/504` là lỗi upstream không sẵn sàng/quá thời gian.

| Method | Path | Người dùng | Hiện có | Cần làm / ranh giới V1 | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/contact` | Khách | Nhận `name, phone, email, message, source`; webhook hướng dẫn hiện ghi 8 cột | Thêm/xác thực `request_type, product?, service?, variant?, qty?`; server gán loại theo ngưỡng; Apps Script ghi 15 cột và Mã riêng cho mỗi submit được chấp nhận. Không tạo Bagisto order, không dedup/merge. | Cần làm |
| GET | `/api/catalog/products/[slug]` | Khách | BFF catalog hiện có cho product/variant/rules | Giữ BFF cho product flow; xác thực MOQ/bước/ngưỡng ở server. | Hiện có |
| GET | `/api/b2b/catalog/categories`, `/api/b2b/catalog/products`, `/api/b2b/catalog/products/{slug}` | Storefront | Nguồn catalog B2B hiện có | Giữ như legacy/transitional catalog routes; không biến thành CMS dịch vụ. | Chuyển tiếp |
| Chưa audit | Endpoint đọc service family/page/content/media | Storefront | `src/data/service-families.ts` và captured content còn tĩnh | Thiết kế/triển khai read API + mapping/di trú có chọn lọc từ Bagisto CMS; không tự đặt path khi chưa audit. | Cần làm |
| Bagisto admin product screens | Administrator | Là bề mặt quản trị catalog đích dài hạn | Extension các field policy B2B (MOQ, step, threshold và field liên quan) trong chính màn hình hiện có; không UI quản trị mới, không direct core writes. | Cần làm |
| Bagisto admin CMS screens | Administrator | Chưa có bằng chứng Next đang được CMS Bagisto cấp dữ liệu | Cho phép quản lý service families/pages/content/media, homepage/business/contact designated editable và cấp read API cho storefront. | Cần làm |
| `/api/quan-tri/*` | Nội bộ cũ | Có BFF/phiên/aggregate cũ | Chỉ security/compatibility; không thêm quyền, CRUD hay dashboard. | Đóng băng |
| `/api/b2b/admin/v1/*` | Nội bộ cũ | Session, identity, dashboard và product aggregate cũ | Chỉ tương thích trong quá trình chuyển sang Bagisto admin; không mở rộng, không gắn hàng đợi Sheet. | Chuyển tiếp |
| `/api/operations/v1/products...` | Không dùng V1 | Chỉ có ở nhánh sạch chưa merge theo bằng chứng hiện có | Không làm/không merge cho V1. | Đóng băng |

Không có API checkout, cart, order, payment, shipping, đồng bộ order external hoặc API summary trong V1. Không hứa một endpoint CMS cụ thể trước khi audit Bagisto và integration cần thiết.

## 9. Công việc, vai trò và phụ thuộc

| Công việc | Owner | Trạng thái | Phụ thuộc | Deliverable |
| --- | --- | --- | --- | --- |
| Xác thực dữ liệu public cho family/biến thể đã chọn | Người quyết định sản phẩm | Chưa bắt đầu | SKU, ảnh, nội dung, giá thật **Chờ xác nhận** | Dữ liệu được duyệt, không dùng `B2B-DEMO` public |
| Chuẩn hóa catalog, giá bậc, CTA và server validation | Terra implement | Chưa bắt đầu | Dữ liệu public, quy tắc Bagisto | Luồng sản phẩm + test |
| Mở rộng `/api/contact` và Apps Script/Sheet | Terra implement | Chưa bắt đầu | Contract mới, Google account/Workspace chủ sở hữu **Chờ xác nhận** | 15 cột, Mã riêng từng submit, validation, protection, Tổng quan |
| Cấu hình vận hành Sheet | Administrator/chủ sở hữu Sheet | Chưa bắt đầu | Quyền Google Sheet | Dropdown, A:K/O bảo vệ, L:N editable, workflow và quy tắc đánh dấu trùng |
| Mở rộng Bagisto product admin cho policy B2B | Terra implement | Chưa bắt đầu | Audit extension point Bagisto | MOQ/step/threshold và field B2B trong màn hình product hiện có |
| Di trú/ánh xạ serviceFamilies và captured content | Terra implement + người duyệt nội dung | Chưa bắt đầu | Audit Bagisto CMS/read API, content được duyệt | Service/page/content/media và homepage/business/contact designated editable qua Bagisto; status **Cần làm** |
| Giữ `/quan-tri` frozen, đưa vận hành về Bagisto admin | Terra implement | Chưa bắt đầu | Bagisto admin extension + CMS/read API | Không có bề mặt quản trị Next mới |
| Xác định ranh giới no-code sau bàn giao | Người quyết định sản phẩm | Chưa bắt đầu | Quyết định layout/navigation/new features **Chờ xác nhận** | Xác nhận data/content only hoặc scope page builder mở rộng |
| Kiểm thử và bàn giao | Terra implement | Chưa bắt đầu | Các mục trên | Bằng chứng phần 10, không push |

Terra là vai trò triển khai. Thay đổi hành vi bắt đầu bằng test RED, rồi code GREEN tối thiểu, sau đó lint, typecheck, build và review phù hợp. Không có task nào được hiểu là quyền ghi trực tiếp bảng core Bagisto.

## 10. Acceptance criteria có thể kiểm thử

| MVP | Tiêu chí chấp nhận |
| --- | --- |
| Scope sản phẩm | Chỉ có family **Bột dinh dưỡng** với hai biến thể vani/ít ngọt trong V1. SKU, ảnh, nội dung và giá thật còn **Chờ xác nhận** phải được duyệt trước public. |
| Giá và quy tắc số lượng | Storefront đọc MOQ, bước số lượng, giá bậc VND và `contact_from_quantity` từ Bagisto. Số lượng dưới MOQ hoặc sai bước bị chặn cả client/server. |
| Hai product flows | Dưới ngưỡng chỉ tạo loại **Đặt sản phẩm**; bằng/trên ngưỡng chỉ tạo **Tư vấn số lượng lớn**; đều có product/variant/qty/context và không tạo báo giá hoặc Bagisto order. |
| Service flow | Có đúng một service family public V1 **Sấy & thực phẩm sấy** tại slug `say-thuc-pham-say`; CTA tạo một dòng **Tư vấn dịch vụ**, không tạo brief/order. |
| Contact → Sheet | Contract hiện có được mở rộng và kiểm thử cho `request_type`, `product`, `service`, `variant`, `qty`, cùng gán loại server. Apps Script tạo Mã riêng và thêm đúng 15 cột; URL/secret chỉ ở server; không fallback Bagisto. |
| Submit trùng | Mỗi submit được chấp nhận tạo dòng/Mã riêng. Không có merge/dedup engine. Administrator có thể đặt **Không tiếp tục** và ghi chính xác `Trùng mã <reference>`. |
| Hàng đợi Sheet | A:K/O và cấu trúc Sheet được bảo vệ; administrator chỉ sửa L:N. Dropdown chặn giá trị ngoài danh sách; rời **Mới** thiếu **Người phụ trách** bị từ chối; Apps Script cập nhật O. |
| Trạng thái và Tổng quan | Chỉ cho phép các chuyển trạng thái phần 2; **Đã hoàn tất**/**Không tiếp tục** không mở lại. Tab **Tổng quan** đếm đúng Đơn mới và Yêu cầu mới; không có dashboard Next/Bagisto hay API summary. |
| Autonomy catalog | Administrator trong Bagisto admin có thể thêm/sửa/ẩn/sắp xếp product/variant, giá, stock, MOQ, step, threshold bằng màn hình product hiện có được extension. Không direct core write, không UI `/quan-tri` mới. |
| Autonomy content | Service family/page/content/media, homepage/business/contact designated editable được di trú/ánh xạ có chọn lọc và quản lý qua Bagisto CMS/read API. Cho đến khi hoàn tất, đây là **Cần làm**, không được mô tả là năng lực hiện có. |
| Ranh giới no-code | Data/content hằng ngày không cần lập trình viên. Việc layout/navigation/chức năng mới chỉ được đưa vào autonomy nếu quyết định **Chờ xác nhận** yêu cầu page builder và scope mở rộng. |
| Ranh giới vĩnh viễn | Không có customer account/portal, cart, checkout, tạo Bagisto order, payment, shipping, order completion, quote engine hay API tương ứng. `/quan-tri` frozen; B2B routes cũ chỉ legacy/transitional. |
| Chất lượng bàn giao | Focused tests, lint, typecheck, build và review chạy theo thay đổi thực tế; `git diff --check` không lỗi; không push. |

### Câu hỏi ưu tiên kế tiếp

1. Một tài khoản administrator dùng chung hay các tài khoản administrator định danh riêng? **Chờ xác nhận**. Đề xuất: tài khoản định danh riêng.
2. “Không cần lập trình viên” chỉ áp dụng dữ liệu/nội dung hằng ngày, hay bao gồm cả bố cục, điều hướng và chức năng mới? **Chờ xác nhận**. Đề xuất: chỉ dữ liệu/nội dung; lựa chọn còn lại cần page builder và mở rộng scope.
3. Google account/Workspace nào do khách hàng sở hữu sẽ là chủ sở hữu Google Sheet và Apps Script? **Chờ xác nhận**. Đề xuất: tài khoản/Workspace do khách hàng kiểm soát.
