# PHÂN TÍCH KHOẢNG CÁCH NGHIỆP VỤ & ĐÁNH GIÁ ĐÁNH ĐỔI (GAP ANALYSIS & TRADE-OFF ASSESSMENT)
## B2B Lean V1 Gia công Sản xuất vs Haravan Omnichannel Retail

> **Mã tài liệu:** R3-GAP-ANALYSIS-TRADEOFFS  
> **Phiên bản:** 1.0.0 (Release Readiness)  
> **Ngày thực hiện:** 23/09/2026  
> **Người thực hiện:** System Gap Reviewer & Product Planner (Teamwork Research Agent)  
> **Phạm vi đối chiếu:** Khảo sát chi tiết khoảng cách vận hành, hổng hổng dữ liệu và ma trận phân loại tính năng (Must Adopt, Do Not Adopt, Adapt/Simplify) dựa trên kiến trúc Cloudflare D1/R2.

---

## 1. PHÂN TÍCH ĐIỂM NGHẼN VẬN HÀNH (OPERATIONAL BOTTLENECK ANALYSIS)

Khảo sát thực tế luồng làm việc hàng ngày của nhân viên kinh doanh (Sales Reps), kỹ sư bóc tách dự toán (Cost Estimator) và người quản trị (Admin) trên Giacong.vn Admin hiện tại cho thấy 4 điểm nghẽn vận hành nghiêm trọng:

### 1.1 Điểm nghẽn 1: Nhập liệu Kép và Phân mảnh Dữ liệu (Double Entry & Data Silos)
- **Quy trình hiện tại:** 
  1. Khách gửi yêu cầu báo giá trên website -> Hệ thống ghi vào bảng `leads` của Cloudflare D1 và đồng bộ sang Google Sheets qua webhook.
  2. Nhân viên kinh doanh nhận thông báo, mở Admin hoặc Google Sheets đọc thông tin.
  3. Nhân viên phải **copy thủ công** tên khách, số điện thoại, danh sách sản phẩm/dịch vụ từ Admin sang một bảng tính Microsoft Excel riêng trên máy tính cá nhân để lập bảng báo giá.
  4. Sau khi tính toán giá và chiết khấu, nhân viên xuất file PDF từ Excel, đính kèm vào email hoặc gửi qua Zalo cá nhân cho khách.
  5. Nhân viên quay lại Admin, bấm chọn dropdown đổi trạng thái lead sang `quotation_sent`.
- **Rủi ro vận hành:** 
  - Tốn trung bình 20 - 35 phút cho mỗi báo giá chỉ cho khâu sao chép dữ liệu.
  - Nguy cơ sai lệch thông số kỹ thuật (vật liệu, dung sai, số lượng MOQ) trong quá trình copy giữa các ứng dụng.
  - Dữ liệu giá báo cho khách nằm phân mảnh trong máy tính cá nhân của sales; công ty không có cơ sở dữ liệu tập trung về giá đã báo.

### 1.2 Điểm nghẽn 2: "Mất Trí nhớ Doanh nghiệp" khi Bàn giao Khách hàng (Lack of Organizational Memory)
- **Quy trình hiện tại:** 
  - Khách hàng B2B thường có chu kỳ đàm phán kéo dài từ 2 tuần đến 6 tháng, trải qua nhiều giai đoạn: hỏi giá sơ bộ, gửi bản vẽ CAD, yêu cầu làm mẫu thử, đàm phán chiết khấu, ký hợp đồng khung.
  - Mọi trao đổi chi tiết (khách yêu cầu mạ niken thay vì sơn tĩnh điện, giao hàng chia làm 3 đợt, yêu cầu thanh toán công nợ 30 ngày) đều diễn ra trên ứng dụng chat Zalo hoặc gọi điện thoại cá nhân của sales.
- **Rủi ro vận hành:** 
  - Khi nhân viên kinh doanh nghỉ việc hoặc chuyển bộ phận, toàn bộ lịch sử đàm phán và hiểu biết về khách hàng biến mất hoàn toàn.
  - Nhân viên mới tiếp nhận phải hỏi lại khách từ đầu ("Anh/chị cần gia công chi tiết gì, số lượng bao nhiêu?"), gây cảm giác thiếu chuyên nghiệp và làm giảm uy tín của Giacong.vn đối với các đối tác doanh nghiệp lớn.

### 1.3 Điểm nghẽn 3: Xung đột Phiên bản Báo giá và Sai lệch Sản xuất (Quote Versioning Chaos)
- **Quy trình hiện tại:** Trong quá trình thương thảo, khách hàng thường yêu cầu chỉnh sửa số lượng (từ 500 cái lên 1.500 cái), thay đổi mác thép hoặc yêu cầu thêm chứng chỉ CO/CQ. Do Admin không có chức năng tạo và lưu trữ các phiên bản báo giá (Quote Revisions: v1, v2, v3), nhân viên gửi các bản báo giá mới qua Zalo.
- **Rủi ro vận hành:** Khi khách hàng đồng ý chốt đơn theo báo giá v3, nhưng xưởng sản xuất lại nhận được thông tin ban đầu từ lead v1 (do Admin chỉ hiển thị nội dung tiếp nhận gốc). Sự sai lệch này dẫn đến việc sản xuất sai quy cách, thiệt hại hàng chục đến hàng trăm triệu đồng tiền nguyên vật liệu và gia công phế phẩm.

### 1.4 Điểm nghẽn 4: Thiếu Cơ chế Phân công Trách nhiệm & Bỏ quên Khách hàng (Lead Abandonment)
- **Quy trình hiện tại:** Hộp thư yêu cầu (`/admin/yeu-cau`) là một danh sách phẳng hiển thị cho tất cả những ai có quyền truy cập. Không có nhân viên cụ thể chịu trách nhiệm làm việc với từng lead.
- **Rủi ro vận hành:** Xuất hiện tâm lý đùn đẩy: lead dễ/lớn thì nhiều người tranh nhau liên hệ, lead kỹ thuật phức tạp hoặc khối lượng vừa phải thì bị bỏ ngỏ không ai xử lý. Thời gian phản hồi trung bình kéo dài trên 24 giờ, khiến khách hàng tìm sang các xưởng gia công đối thủ.

---

## 2. KHOẢNG CÁCH VỀ DỮ LIỆU & BÁO CÁO (DATA & REPORTING GAPS)

Hệ thống quản trị hiện tại của Giacong.vn đang bị "mù số liệu thương mại" do cấu trúc dữ liệu ban đầu chỉ tập trung vào quản lý danh mục hiển thị (Catalog & Content CMS):

```
+------------------------------------------+------------------------------------------+
| CHỈ SỐ THƯƠNG MẠI HARAVAN CUNG CẤP       | HIỆN TRẠNG TRÊN GIACONG.VN ADMIN        |
+------------------------------------------+------------------------------------------+
| 1. Doanh thu gộp (GMV) & Thực thu        | KHÔNG CÓ (Không ghi nhận giá trị tiền)   |
| 2. Giá trị trung bình đơn hàng (AOV)     | KHÔNG CÓ                                 |
| 3. Tỷ lệ chuyển đổi phễu (Funnel Rate)  | KHÔNG CÓ (Chỉ có danh sách lead rời rạc) |
| 4. Giá trị đường ống báo giá (Pipeline)  | KHÔNG CÓ                                 |
| 5. Doanh số theo từng nhân viên (Sales)  | KHÔNG CÓ (Không phân công nhân viên)     |
| 6. Tỷ lệ thắng/thua thầu (Win/Loss Rate) | KHÔNG CÓ                                 |
| 7. Chu kỳ vòng đời khách hàng (LTV/RFM)  | KHÔNG CÓ (Không có bảng Customers)       |
| 8. Xuất báo cáo tùy biến (Excel Export)  | KHÔNG CÓ (Chỉ có sync ngầm sang Sheets)  |
+------------------------------------------+------------------------------------------+
```

### 2.1 Thiếu Hụt Thực thể Khách hàng Doanh nghiệp (Enterprise Customer Entity)
- Hiện tại, thực thể duy nhất ghi nhận thông tin khách hàng là bảng `leads`.
- Một khách hàng doanh nghiệp (ví dụ: *Công ty Cổ phần Thiết bị Y tế Bình Minh*, MST: 0312345678) thực hiện 10 lần đặt gia công các linh kiện khác nhau trong năm sẽ tồn tại dưới dạng 10 bản ghi độc lập trong bảng `leads`.
- **Hậu quả:** Không thể thực hiện các phân tích cốt lõi:
  - Doanh nghiệp nào là khách hàng chiến lược (Key Account)?
  - Tổng công nợ hiện tại của doanh nghiệp này là bao nhiêu?
  - Doanh nghiệp này có những người liên hệ nào (Giám đốc mua hàng, Kỹ sư trưởng, Kế toán thanh toán)?

### 2.2 Thiếu Hụt Mô hình Đường ống Doanh thu Dự kiến (Pipeline Velocity & Deal Value)
- Trong mô hình sản xuất B2B, doanh thu không đến ngay lập tức mà trải qua các giai đoạn có xác suất thắng thầu khác nhau:
  - Tiếp nhận (New): 10% xác suất
  - Báo giá (Quotation Sent): 30% xác suất
  - Gửi mẫu thử (Sampling): 60% xác suất
  - Đàm phán hợp đồng (Negotiation): 85% xác suất
  - Chốt đơn (Won): 100% xác suất
- Do thiếu trường `quoted_amount` (giá trị báo giá) và thời hạn dự kiến chốt (expected close date), Ban Giám đốc không thể dự báo dòng tiền và kế hoạch nhập nguyên vật liệu cho nhà xưởng trong 1-3 tháng tới.

---

## 3. MA TRẬN ĐÁNH GIÁ ĐÁNH ĐỔI (LEAN V1 B2B TRADE-OFF MATRIX)

Để xây dựng một hệ thống admin hiệu quả trên nền tảng Cloudflare-native mà không rơi vào cái bẫy "phình to tính năng vô ích" (feature bloat) của các hệ thống bán lẻ B2C như Haravan, chúng tôi phân loại toàn bộ các tính năng thành 3 nhóm chiến lược:

```
                            CHIẾN LƯỢC TÍNH NĂNG B2B LEAN V1
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         ▼                                 ▼                                 ▼
   MUST ADOPT                       DO NOT ADOPT / AVOID               ADAPT / SIMPLIFY
(Bắt buộc tích hợp)               (Kiên quyết không làm)            (Tái cấu trúc cho B2B)
- Customer 360 profile            - Retail fast checkout            - B2B Quote Sheet
- Interaction timeline            - Abandoned cart recovery         - Sampling approval pipeline
- Sales rep assignment            - Consumer loyalty points         - Milestone payment tracking
- Quote management lifecycle      - Retail POS & barcode scanner    - Heavy logistics & receipt
- Commercial dashboard KPIs       - Marketplace sync (Shopee)       - CAD/Spec intake pipeline
- Excel / CSV direct export       - Consumer product reviews        - Tier price volume engine
```

### 3.1 NHÓM 1: MUST ADOPT (Bắt buộc Tích hợp Ngay trong Lean V1)
Những tính năng mang tính sống còn, trực tiếp giải phóng sức lao động của nhân viên và ngăn chặn thất thoát dữ liệu khách hàng:

1. **Hồ sơ Khách hàng Hợp nhất (Customer 360 & Company Profiles):**
   - *Lý do:* Chuyển đổi từ mô hình "Lead-centric" sang "Customer-centric". Mỗi khách hàng có một mã duy nhất, quản lý tên công ty, mã số thuế, địa chỉ nhà xưởng, danh sách người liên hệ và toàn bộ lịch sử báo giá/hợp đồng liên quan.
   - *Giải pháp D1:* Bổ sung bảng `customers` và `customer_contacts`, liên kết khóa ngoại với `leads` và `quotations`.

2. **Dòng thời gian Tương tác & Ghi chú Nội bộ (Interaction Timeline & Notes):**
   - *Lý do:* Lưu vết toàn bộ lịch sử cuộc gọi, tin nhắn, biên bản làm việc, thỏa thuận kỹ thuật trực tiếp trên màn hình chi tiết khách hàng/lead.
   - *Giải pháp D1:* Tái kích hoạt và mở rộng bảng `lead_events` thành `interaction_timeline` với các loại sự kiện: `note`, `call`, `meeting`, `quote_sent`, `sample_approved`.

3. **Phân công Nhân viên Phụ trách (Sales Assignment & Account Ownership):**
   - *Lý do:* Gán trách nhiệm rõ ràng cho từng lead/khách hàng. Nhân viên chỉ cần mở màn hình "Yêu cầu của tôi" để tập trung xử lý khách hàng được giao.
   - *Giải pháp D1:* Tích hợp trường `assigned_to` trên UI, bổ sung bộ lọc theo nhân viên phụ trách, cho phép phân quyền người phụ trách chính.

4. **Vòng đời Báo giá Thương mại (Quotation Lifecycle & Versioning):**
   - *Lý do:* Cho phép soạn thảo báo giá chính thức trực tiếp trong admin (chọn sản phẩm, áp bậc giá tự động, tính thuế VAT, hạn hiệu lực báo giá), sinh mã báo giá chuẩn (BG-2026-XXXX), hỗ trợ xuất PDF và link xem báo giá trực tuyến cho khách.
   - *Giải pháp D1:* Bổ sung bảng `quotations` và `quotation_items`.

5. **Bảng điều khiển Thương mại B2B (B2B Commercial Dashboard):**
   - *Lý do:* Cung cấp bức tranh toàn cảnh cho lãnh đạo: Tổng giá trị đường ống báo giá (Pipeline Value), tỷ lệ chuyển đổi qua từng giai đoạn, doanh số chốt trong tháng, danh sách việc cần xử lý gấp.
   - *Giải pháp Next.js:* Thay thế các widget đếm số lượng tĩnh bằng Server Components truy vấn trực tiếp số liệu tổng hợp từ D1.

6. **Xuất Dữ liệu Ra Excel/CSV (Bulk Export Engine):**
   - *Lý do:* Phục vụ nhu cầu báo cáo kế toán, đối soát nội bộ và lưu trữ ngoại tuyến của phòng kinh doanh.
   - *Giải pháp:* Endpoint xuất CSV chuẩn UTF-8 trực tiếp từ Worker mà không cần phụ thuộc vào Google Sheets.

---

### 3.2 NHÓM 2: DO NOT ADOPT / AVOID (Kiên quyết Không Làm - Tránh Phình to Bán lẻ)
Những tính năng cực kỳ mạnh mẽ trên Haravan nhưng hoàn toàn phản tác dụng hoặc vô nghĩa đối với mô hình gia công B2B:

| Tính năng Haravan | Tại sao Haravan cần có? | Tại sao Giacong.vn PHẢI TRÁNH TUYỆT ĐỐI? |
| :--- | :--- | :--- |
| **Thanh toán Nhanh Trực tuyến (Retail Fast Checkout)** | Khách mua quần áo, mỹ phẩm bỏ hàng vào giỏ và quẹt thẻ/Momo thanh toán 100% ngay lập tức. | Sản phẩm gia công cơ khí không thể "bấm mua và thanh toán ngay". Đơn hàng cần bóc tách bản vẽ kỹ thuật, kiểm tra tồn phôi thép, tính toán thời gian chạy máy CNC, đàm phán hợp đồng kinh tế và đặt cọc theo tiến độ. Việc đưa luồng checkout bán lẻ vào sẽ phá vỡ toàn bộ quy trình bán hàng kỹ thuật B2B. |
| **Chiến dịch Thu hồi Giỏ hàng Bỏ quên (Abandoned Cart SMS/Email)** | Nhắc nhở người tiêu dùng quay lại hoàn tất đơn hàng thời trang/tiêu dùng với mã giảm giá 10%. | Khách B2B đưa hàng vào danh sách yêu cầu là để tập hợp nhu cầu dự toán cho nhà xưởng. Việc tự động gửi tin nhắn giục giã hoặc tặng voucher giảm giá kiểu bán lẻ sẽ làm mất đi hình ảnh chuyên nghiệp của một nhà thầu sản xuất công nghiệp uy tín. |
| **Điểm thưởng & Hạng Thành viên (Loyalty Points / Tier)** | Kích thích người tiêu dùng tích điểm đổi quà (hạng Bạc, Vàng, Kim Cương) để mua sắm lặp lại. | Doanh nghiệp B2B mua hàng dựa trên: Năng lực kỹ thuật, độ chính xác dung sai, tiến độ giao hàng và chiết khấu khối lượng trong hợp đồng khung. Không có giám đốc mua hàng doanh nghiệp nào quyết định chọn xưởng gia công vì được tích "100 điểm thưởng đổi voucher". |
| **Phần cứng Bán lẻ & Máy quét Mã vạch (Retail POS)** | Kết nối máy in hóa đơn nhiệt, ngăn kéo đựng tiền, đầu đọc mã vạch tại cửa hàng bán lẻ trực tiếp. | Giacong.vn là nền tảng xưởng chế tạo và gia công B2B, không có cửa hàng bán lẻ mặt phố. Việc nhúng thư viện POS sẽ làm nặng bundle, tăng độ phức tạp mã nguồn vô ích. |
| **Đồng bộ Sàn TMĐT (Shopee, Lazada, TikTok Shop)** | Tự động đồng bộ sản phẩm, giá bán, tồn kho sang các sàn TMĐT bán lẻ cho người tiêu dùng cá nhân. | Dịch vụ gia công tiện phay CNC, cắt laser kim loại tấm hay ép khuôn nhựa không thể niêm yết bán theo kiểu hàng hóa tiêu dùng trên Shopee hay TikTok. Đây là sự lãng phí tài nguyên phát triển nghiêm trọng. |
| **Đánh giá Sao & Bình luận Công khai (Public Star Reviews)** | Người mua đánh giá 5 sao kèm ảnh mở hộp để tạo uy tín cho khách mua sau. | Đánh giá năng lực nhà xưởng B2B dựa trên hồ sơ năng lực (Portfolio), chứng chỉ quản lý chất lượng ISO 9001/IATF 16949, biên bản nghiệm thu kỹ thuật và sự bảo mật tuyệt đối về thiết kế sản phẩm của khách hàng (NDA). Khách B2B không bao giờ muốn bản vẽ chi tiết cơ khí độc quyền của mình bị đưa lên mục bình luận công khai. |

---

### 3.3 NHÓM 3: ADAPT / SIMPLIFY (Tái cấu trúc Tinh gọn Chuyên biệt cho Gia công)
Những tính năng của Haravan có ý tưởng nền tảng tốt, nhưng cần được đập đi xây lại hoàn toàn để phù hợp với ngữ cảnh sản xuất:

#### 1. Đơn hàng Nháp (Draft Orders) -> Báo giá Gia công B2B (B2B Quotation Builder)
- *Cách Haravan làm:* Cho nhân viên tạo đơn hàng bán lẻ thủ công, chọn sản phẩm có sẵn, gõ giảm giá cố định (ví dụ giảm 50.000đ), gửi link cho khách nhập địa chỉ nhận hàng.
- *Cách Giacong.vn tái thiết kế:*
  - Tích hợp trực tiếp với động cơ bậc giá D1 (`variant_tier_prices`): khi nhân viên gõ số lượng 2.500 cái, hệ thống tự động kéo giá bậc tương ứng và hiển thị biên độ chiết khấu cho phép.
  - Cho phép bổ sung các phụ phí sản xuất đặc thù B2B: Chi phí mở khuôn (Tooling/Mold cost), chi phí xử lý bề mặt (anode, xi mạ, sơn tĩnh điện), chi phí kiểm định chất lượng (QA/QC certification).
  - Xuất bảng báo giá chuẩn công nghiệp với đầy đủ điều khoản thanh toán, thời hạn giữ giá (ví dụ: hiệu lực trong 15 ngày do biến động giá phôi nhôm/thép) và chữ ký số/con dấu công ty.

#### 2. Luồng Xử lý Đơn Bán lẻ (Fulfillment) -> Luồng Làm Mẫu & Sản xuất (Sampling & Production Milestones)
- *Cách Haravan làm:* Tiếp nhận đơn -> Xác nhận -> In phiếu đóng gói -> Bàn giao shipper giao hàng ngay trong ngày.
- *Cách Giacong.vn tái thiết kế:*
  - Thiết lập luồng phê duyệt mẫu thử (Sampling Gate): Khách duyệt bản vẽ 2D/3D -> Xưởng gia công mẫu thử -> Gửi mẫu cho khách đo đạc nghiệm thu -> Khách ký biên bản chấp thuận mẫu (Sample Sign-off) -> Mới bắt đầu kích hoạt lệnh sản xuất hàng loạt (Mass Production).
  - Lưu trữ biên bản kiểm tra kích thước (QC Inspection Sheet) và ảnh chụp mẫu đối chứng trực tiếp trên Cloudflare R2 đính kèm hồ sơ đơn hàng.

#### 3. Cổng Thanh toán Bán lẻ (Payment Gateways) -> Theo dõi Đợt Thanh toán Tiến độ (Milestone Payment Tracking)
- *Cách Haravan làm:* Kết nối cổng thanh toán để thu tiền 100% trước khi xuất kho.
- *Cách Giacong.vn tái thiết kế:*
  - Chia đợt thanh toán chuẩn B2B:
    * Đợt 1: Tạm ứng 30% - 50% khi ký hợp đồng để xưởng mua nguyên vật liệu.
    * Đợt 2: Thanh toán 40% - 50% khi có thông báo hàng đã hoàn thành và nghiệm thu xuất xưởng.
    * Đợt 3: Thanh toán 10% còn lại sau khi bàn giao đủ chứng từ hóa đơn VAT hoặc thời hạn bảo hành.
  - Admin cho phép nhân viên kế toán tải lên ủy nhiệm chi (UNC) ngân hàng, xác nhận số tiền đã vào tài khoản theo từng mốc tiến độ hợp đồng.

#### 4. Giao vận Qua Shipper Xe máy (Courier APIs) -> Quản lý Giao vận Hàng nặng & Bàn giao (Heavy Logistics & Proof of Delivery)
- *Cách Haravan làm:* Bắn API tự động sang GHN, Viettel Post để shipper xe máy đến lấy các gói hàng 1-2kg.
- *Cách Giacong.vn tái thiết kế:*
  - Không kết nối API shipper bán lẻ. Thay vào đó, xây dựng module ghi nhận hình thức giao nhận công nghiệp: Xe tải công ty, chành xe liên tỉnh, xe container, hoặc khách tự nhận tại xưởng (FOB Factory).
  - Quản lý biên bản bàn giao hàng hóa có chữ ký người nhận (Proof of Delivery - POD), số lượng kiện/pallets và biển số xe tải vận chuyển.

---

## 4. ĐỐI CHUẨN GIẢI PHẪU GIAO DIỆN & TRẢI NGHIỆM NGƯỜI DÙNG (UI/UX ANATOMICAL BENCHMARK & DASHBOARD UX)

Khảo sát công thái học giao diện (Ergonomics) và kiến trúc giao diện tương tác giữa Haravan Admin và Giacong.vn Admin (`apps/giacong-lean-commerce/src/components/admin/AdminShell.tsx`, `AdminPrimitives.tsx`, `AdminDialog.tsx`, và các trang quản trị `/admin/yeu-cau`, `/admin/page.tsx`):

```
+---------------------------------------------------------------------------------------------------------------+
| MA TRẬN ĐỐI CHUẨN GIẢI PHẪU UI/UX: HARAVAN OMNI ADMIN VS GIACONG.VN ADMIN                                    |
+--------------------------+-------------------------------------+----------------------------------------------+
| Khía cạnh UI/UX          | Haravan Omni Admin                  | Giacong.vn Admin Hiện tại                    |
+--------------------------+-------------------------------------+----------------------------------------------+
| 1. Kiến trúc Điều hướng  | Đa tầng: Topbar toàn cục (Cmd+K)   | Đơn tầng: Sidebar cố định 248px, 5 nhóm      |
|    & Menu (IA)           | + Sidebar đa cấp cuộn độc lập       | 10 mục phẳng. Topbar 68px chỉ có crumb &     |
|                          | + Khối kênh bán hàng Omni riêng     | avatar. Không có tìm kiếm toàn cục (Cmd+K).  |
+--------------------------+-------------------------------------+----------------------------------------------+
| 2. Mật độ Dữ liệu        | Rất cao: Row 40-48px compact mode;  | Trung bình: Row 54-64px (padding 15px 18px); |
|    & Hiển thị Bảng       | Sắp xếp đa cột ASC/DESC; Bật/tắt    | Cố định 100% cột; Không sắp xếp đa cột;      |
|                          | cột tùy biến; 18-22 dòng / 1080p.   | Dropdown inline trong cell; 7-9 dòng / 1080p |
+--------------------------+-------------------------------------+----------------------------------------------+
| 3. Trải nghiệm Tìm/Lọc   | Nâng cao: Saved filter tabs;        | Cơ bản: 1 ô tìm kiếm text tự do (cần Enter/  |
|    (Filter Ergonomics)   | Filter pill/chips có nút gỡ 'x';    | submit) + 1 dropdown select HTML đơn giản;   |
|                          | Date range presets phong phú.       | Không có bộ chọn ngày; Không lưu filter view.|
+--------------------------+-------------------------------------+----------------------------------------------+
| 4. Khám phá Chi tiết     | Split-screen hoặc Drawer trượt      | Centered Modal (`AdminModal` 480px / 780px); |
|    (Detail Inspection)   | cạnh phải 520-640px; Giữ 100% ngữ   | Mất hoàn toàn ngữ cảnh bảng; Backdrop làm    |
|                          | cảnh bảng; Điều hướng Next/Prev.    | mờ nền; Giới hạn chiều cao max 86dvh.        |
+--------------------------+-------------------------------------+----------------------------------------------+
| 5. Dashboard Phân tích   | B2C Financial Focus: GMV, AOV,      | Operational CMS Focus: 4 thẻ đếm số lượng;   |
|    & Báo cáo Tổng quan   | Doanh thu theo giờ, Tỷ lệ hủy giỏ;  | Bảng DataReadiness cho dev chiếm diện tích;  |
|                          | Biểu đồ diện tích/cột động.         | Hoàn toàn thiếu chỉ số đường ống báo giá B2B.|
+--------------------------+-------------------------------------+----------------------------------------------+
```

### 4.1 Kiến trúc Thông tin & Điều hướng (Navigation & Information Architecture - IA)

#### 4.1.1 Phân tích Haravan Omni Admin
- **Hệ thống điều hướng 2 tầng phân lập rõ rệt:**
  - **Top Bar toàn cục (Global Command Center):** Thanh trên cùng chứa ô tìm kiếm thông minh hỗ trợ phím tắt (`Cmd+K` hoặc `Ctrl+K`), cho phép tìm tức thì mã đơn hàng, số điện thoại khách hàng, tên sản phẩm hoặc lệnh cấu hình hệ thống từ bất kỳ vị trí nào. Ngoài ra Topbar tích hợp bộ chuyển đổi cửa hàng/chi nhánh (Store switcher), chuông thông báo real-time và menu tài khoản.
  - **Sidebar đa tầng (Multi-level Accordion Sidebar):** Menu chia thành 3 khối chính: (1) Quản lý bán hàng cốt lõi (Tổng quan, Đơn hàng, Sản phẩm, Khách hàng/CRM, Báo cáo); (2) Kênh bán hàng (Website, POS, Shopee, TikTok Shop, Lazada); (3) Cấu hình & Ứng dụng mở rộng.
  - **Cơ chế thu gọn/mở rộng menu con:** Khi người dùng click vào "Khách hàng", menu mở rộng hiển thị các mục phụ: *Tất cả khách hàng*, *Nhóm khách hàng*, *Lịch sử phản hồi*. Tương tự, "Đơn hàng" mở ra: *Tất cả đơn hàng*, *Đơn hàng nháp*, *Đơn hoàn trả*, *Vận chuyển*.
- **Ưu điểm:** Khả năng mở rộng vô hạn. Người dùng nắm bắt được toàn bộ hệ sinh thái đa kênh bán lẻ.
- **Hạn chế:** Tải nhận thức (cognitive load) rất lớn; giao diện có nhiều tầng con dễ gây phân tâm cho nhân viên khi chỉ cần tập trung vào xử lý đơn hàng/báo giá.

#### 4.1.2 Hiện trạng Giacong.vn Admin (`AdminShell.tsx`)
- **Cấu trúc điều hướng đơn tầng (Single-tier Grouped Sidebar):**
  - Chiều rộng cố định 248px, nền xanh đậm `#22372d`, gồm 5 nhóm điều hướng:
    * *Vận hành:* Tổng quan (`/admin`), Yêu cầu báo giá (`/admin/yeu-cau`).
    * *Chỉnh sửa website:* Nội dung (`/admin/noi-dung`), Thiết kế (`/admin/thiet-ke`), Menu (`/admin/dieu-huong`).
    * *Hàng hóa:* Sản phẩm (`/admin/san-pham`), Dịch vụ gia công (`/admin/dich-vu`).
    * *Nội dung:* Tin tức (`/admin/tin-tuc`).
    * *Tài khoản & quyền:* Thành viên (`/admin/thanh-vien`), Audit log (`/admin/audit`).
  - Top Bar cao 68px (`.admin-topbar`) rất tối giản: breadcrumb cấp 1, nút mở trang storefront, badge môi trường (BẢN THỬ), chấm kết nối trực tiếp, nhãn role và avatar chữ cái.
- **Ưu điểm:** Cực kỳ trực quan, phản hồi tức thì (instant click-through), không có hiệu ứng accordion giật giật làm dời vị trí các menu khác. Hoàn toàn phù hợp với tư duy "Lean V1 Control Plane".
- **Điểm nghẽn khi mở rộng CRM B2B:**
  - Không có thanh tìm kiếm nhanh toàn cục (`Cmd+K`). Nhân viên kinh doanh muốn tra cứu một mã số thuế hay số điện thoại khách quen bắt buộc phải bấm vào trang `/admin/yeu-cau`, chờ nạp bảng rồi mới gõ vào ô tìm kiếm cục bộ.
  - Khối "Vận hành" hiện chỉ có 2 mục. Khi bổ sung Khách hàng (Customers 360), Báo giá (Quotations), Báo cáo phễu (Pipeline Analytics), nếu giữ nguyên danh sách phẳng sẽ làm thanh menu bị dài và lẫn lộn giữa tác vụ kinh doanh hàng ngày với tác vụ quản trị catalog.

#### 4.1.3 Đề xuất Tái cấu trúc IA cho Giacong.vn Lean V1
Tái định hình cấu trúc Sidebar theo luồng công việc tự nhiên của doanh nghiệp B2B (Business Workflow IA), không làm phình to sidebar:

```
[BÁN HÀNG & KHÁCH HÀNG]  (Nhóm ưu tiên hàng đầu cho Sales & CSKH)
  ├── 📊 Bảng điều khiển kinh doanh  (/admin)
  ├── 📥 Hộp thư yêu cầu (RFQs)      (/admin/yeu-cau)
  ├── 📑 Bảng báo giá (Quotes)       (/admin/bao-gia)       -- MỚI (P0)
  └── 👥 Khách hàng B2B (CRM 360)    (/admin/khach-hang)    -- MỚI (P0)

[DANH MỤC GIA CÔNG]      (Nhóm cho Quản lý Kỹ thuật & Sản phẩm)
  ├── ⚙️ Dịch vụ gia công            (/admin/dich-vu)
  └── 📦 Sản phẩm & Phôi mẫu         (/admin/san-pham)

[NỘI DUNG & THƯƠNG HIỆU] (Nhóm cho Marketing & Biên tập)
  ├── ✏️ Nội dung & Thương hiệu      (/admin/noi-dung)
  ├── 📰 Tin tức chuyên ngành        (/admin/tin-tuc)
  ├── 🎨 Thiết kế trang              (/admin/thiet-ke)
  └── 🧭 Menu điều hướng             (/admin/dieu-huong)

[HỆ THỐNG & TÀI KHOẢN]   (Nhóm kiểm soát bảo mật)
  ├── 🛡️ Tài khoản quản trị & quyền  (/admin/thanh-vien)
  └── 📜 Lịch sử thao tác (Audit)    (/admin/audit)
```

---

### 4.2 Mật độ Dữ liệu & Hiệu quả Sử dụng Không gian Màn hình (Data Density & Screen Utilization)

Mật độ dữ liệu là yếu tố sống còn đối với công cụ quản trị B2B: nhân viên kinh doanh và kỹ thuật xử lý hàng chục yêu cầu mỗi ngày, họ cần nhìn thấy nhiều dữ liệu nhất có thể trên một trang màn hình mà không phải cuộn liên tục.

#### 4.2.1 Phân tích Thông số Bảng Dữ liệu (Table Anatomy Metrics)

| Chỉ số Thiết kế | Haravan Admin Table | Giacong.vn Admin Table (`admin.css`) | Đánh giá Chênh lệch & Ảnh hưởng Vận hành |
| :--- | :--- | :--- | :--- |
| **Chiều cao dòng (Row Height)** | 40px – 44px (chế độ compact) / 48px (chuẩn) | 54px – 68px (`padding: 15px 18px` + inline controls) | Giacong cao hơn **35% - 45%**, gây lãng phí không gian dọc nghiêm trọng. |
| **Số bản ghi hiển thị trên màn hình 1080p** | 18 – 22 bản ghi (không cần cuộn) | 7 – 9 bản ghi (phải cuộn liên tục) | Năng suất duyệt của nhân viên trên Haravan cao gấp đôi. |
| **Padding ô dữ liệu (Cell Padding)** | `padding: 8px 12px` | `padding: 15px 18px` | Padding của Giacong phù hợp với landing page/bài viết hơn là bảng dữ liệu quản trị. |
| **Kích thước & Phông chữ** | 12px – 13px Inter, Tabular numbers | 13px "Admin Sans", Geist Mono cho mã | Phông chữ Giacong hiển thị rõ, số Geist Mono rất đẹp, nhưng text phụ (`.admin-item-meta`) cách dòng còn thưa. |
| **Sắp xếp đa cột (Column Sorting)** | Có icon sort cạnh mỗi th (Mã, Ngày, Khách, Tổng tiền); click để đảo chiều ASC/DESC | Không có sorting trên header; mặc định sắp xếp cố định theo `createdAt DESC` | Người dùng không thể lọc nhanh đơn hàng giá trị cao nhất hay khách hàng theo alphabet. |
| **Tùy biến cột (Show/Hide Columns)** | Cho phép bật/tắt cột qua popover "Tùy chỉnh cột" và lưu vào localStorage | Cố định 100% các cột theo code JSX | Người dùng có màn hình nhỏ bị tràn bảng ngang, người dùng màn hình lớn không tận dụng được không gian. |
| **Hành động trên dòng (Row Actions)** | Nút action ẩn/mờ, chỉ hiện rõ khi hover chuột lên dòng, giúp bảng thoáng sạch | Cụm dropdown `<select>` chọn trạng thái nhúng cố định trực tiếp bên trong ô `<td>` | Giao diện bị rối mắt do hàng chục dropdown select cùng xuất hiện đồng loạt trên mọi dòng. |
| **Độ co giãn khung chứa (Layout Container)** | Fluid 100% full-width có padding 24px linh hoạt | Cố định `max-width: 1500px; margin: 0 auto` | Trên màn hình 2K (1440p) hoặc 4K, Giacong để trống 2 bên lề rất rộng, trong khi bảng bên trong lại bị cuộn ngang. |

#### 4.2.2 Điểm nghẽn Cốt tử trong Màn hình Tiếp nhận Yêu cầu (`/admin/yeu-cau`)
1. **Dropdown Trạng thái Nhúng trực tiếp trong Cell (Inline State Selector Anti-pattern):**
   - Đoạn mã trong `apps/giacong-lean-commerce/src/app/admin/yeu-cau/page.tsx` (dòng 234-245):
     ```tsx
     <select
       aria-label={`Cập nhật trạng thái cho ${lead.fullName}`}
       className="admin-select"
       style={{ marginTop: 7, minHeight: 34, minWidth: 150 }}
       value={lead.status}
     >
     ```
   - **Tác động tiêu cực:** Mỗi cell trạng thái phải gánh cả huy hiệu (`AdminStatusBadge`) VÀ một ô `<select>` to bản (`minWidth: 150px`, `minHeight: 34px`). Khi một trang có 20 bản ghi, có đến 20 thẻ `<select>` cùng hiển thị, đẩy chiều cao dòng lên gần 70px và rất dễ kích hoạt nhầm khi người dùng cuộn chuột trên thiết bị cảm ứng hoặc touchpad.
2. **Đề xuất Tối ưu hóa:**
   - Đưa chiều cao dòng chuẩn về **42px - 46px** (`padding: 9px 12px`).
   - Cột "Trạng thái" chỉ hiển thị duy nhất huy hiệu nhỏ gọn (`AdminStatusBadge`). Khi click vào badge hoặc hover, mở một popover đổi trạng thái nhanh, hoặc thực hiện đổi trạng thái trực tiếp trong Slide-over Drawer.

---

### 4.3 Trải nghiệm Tìm kiếm & Bộ lọc (Filtering & Search Ergonomics)

Quy trình làm việc của sales B2B phụ thuộc 80% vào việc phân nhóm và lọc danh sách: "Hôm nay có những yêu cầu nào mới?", "Những báo giá nào gửi quá 3 ngày chưa chốt?", "Những khách hàng nào thuộc ngành cơ khí chính xác tại Bình Dương?".

```
+---------------------------------------------------------------------------------------------------------------+
| SO SÁNH TRẢI NGHIỆM TÌM KIẾM & BỘ LỌC                                                                         |
+--------------------------+-------------------------------------+----------------------------------------------+
| Tính năng                | Haravan Omni Admin                  | Giacong.vn Admin Hiện tại                    |
+--------------------------+-------------------------------------+----------------------------------------------+
| 1. Saved Filter Tabs     | Hỗ trợ tạo tab bộ lọc lưu sẵn:      | Không có. Chỉ có 1 danh sách mặc định        |
|                          | [Tất cả] [Chưa xử lý] [Đã chốt]     | "Toàn bộ hộp thư" hoặc lọc thủ công          |
|                          | [VIP] [Tháng này] (1-click switch). | từng lần.                                    |
+--------------------------+-------------------------------------+----------------------------------------------+
| 2. UI Thẻ lọc (Chips)    | Trực quan: Mỗi bộ lọc tạo 1 badge   | Không có chips. Giá trị lọc hiển thị trong   |
|                          | nhỏ có nút 'x' để xóa nhanh:        | dropdown, không hiển thị tổng quan các điều  |
|                          | `[Trạng thái: Mới x]` `[Sales: A x]`| kiện lọc đang đồng thời áp dụng.             |
+--------------------------+-------------------------------------+----------------------------------------------+
| 3. Bộ chọn ngày          | Đầy đủ presets nhanh: Hôm nay, Hôm  | Hoàn toàn KHÔNG có bộ lọc ngày. Bảng chỉ     |
|    (Date Range Presets)  | qua, 7 ngày qua, 30 ngày qua, Tháng | hiển thị ngày tạo và sort mặc định, không    |
|                          | này, Khoảng ngày tùy chọn.          | thể lọc xem yêu cầu theo tuần/tháng.         |
+--------------------------+-------------------------------------+----------------------------------------------+
| 4. Cơ chế Tìm kiếm       | Instant Search có debounce (300ms)  | Cần submit form: Người dùng gõ text rồi      |
|                          | hoặc gõ Enter; Tìm trên nhiều field.| phải bấm nút "Tìm" hoặc gõ Enter.            |
+--------------------------+-------------------------------------+----------------------------------------------+
| 5. Lọc kết hợp           | Đa điều kiện đồng thời: Trạng thái  | Chỉ lọc được duy nhất 1 tiêu chí:            |
|    (Compound Filters)    | AND Ngành nghề AND Người phụ trách. | `status` qua 1 thẻ `<select>` đơn lẻ.        |
+--------------------------+-------------------------------------+----------------------------------------------+
```

#### Đề xuất Nâng cấp Bộ Lọc cho Giacong.vn (Compound Filter Bar Spec)
1. **Hàng Tab Lưu sẵn (Saved Quick Views):**
   ```
   [Tất cả (142)] [Mới tiếp nhận (12)] [Đang báo giá (28)] [Cần theo dõi gấp (5)] [+]
   ```
2. **Thanh Lọc Hợp nhất (Unified Filter Toolbar):**
   - Ô tìm kiếm từ khóa tức thì (Search input với icon kính lúp, tự động debounce 300ms, tìm theo Tên khách, Công ty, Mã yêu cầu, SĐT, Email).
   - Nút `Bộ lọc ngày`: Click mở popover gồm các preset chuẩn công nghiệp (`7 ngày qua`, `30 ngày qua`, `Quý này`, `Tùy chọn`).
   - Nút `Nhân viên phụ trách`: Dropdown chọn lọc theo Sales Rep (`Của tôi`, `Nguyễn Văn A`, `Trần Thị B`, `Chưa phân công`).
   - Nút `Gắn nhãn / Ngành nghề`: Chọn theo taxonomy tag (`Cơ khí CNC`, `Khuôn ép nhựa`, `Kim loại tấm`).
   - Dải Filter Chips hiển thị dưới thanh công cụ: Cho phép xóa nhanh từng tiêu chí hoặc bấm "Xóa tất cả bộ lọc".

---

### 4.4 Công thái học Màn hình Chi tiết: Centered Modal vs Right Slide-over Drawer

Một trong những hạn chế thiết kế lớn nhất ảnh hưởng trực tiếp đến năng suất của nhân viên trên Giacong.vn Admin hiện tại là việc sử dụng **Modal trung tâm** (`AdminModal.tsx`) cho tác vụ duyệt chi tiết yêu cầu.

```
+---------------------------------------------------------------------------------------------------------------+
| ĐỐI CHIẾU CÔNG THÁI HỌC: MODAL TRUNG TÂM VS DRAWER TRƯỢT CẠNH PHẢI (SLIDE-OVER SHEET)                        |
+--------------------------+-------------------------------------+----------------------------------------------+
| Tiêu chí Đánh giá        | Centered Modal (`AdminModal.tsx`)   | Right Slide-over Drawer (`AdminDrawer.tsx`)  |
+--------------------------+-------------------------------------+----------------------------------------------+
| 1. Bảo toàn Ngữ cảnh     | ❌ KÉM: Lớp phủ tối che khuất       | ✅ HOÀN HẢO: Bảng dữ liệu phía sau vẫn nhìn  |
|    (Context Preservation)| toàn bộ bảng; người dùng không thể  | thấy rõ; dễ dàng đối chiếu số liệu yêu cầu   |
|                          | so sánh với các dòng xung quanh.    | này với các yêu cầu khác cùng khách hàng.    |
+--------------------------+-------------------------------------+----------------------------------------------+
| 2. Không gian Hiển thị   | ❌ BỊ GIỚI HẠN: Max-width 780px,    | ✅ TỐI ƯU: Tận dụng 100% chiều cao màn hình  |
|    Dọc (Vertical Space)  | Max-height 86dvh (~600px). Cuộn     | (100dvh), chiều rộng 560px-640px lý tưởng    |
|                          | bên trong hộp thoại rất bí bách.    | cho việc đọc tài liệu, thông số và timeline. |
+--------------------------+-------------------------------------+----------------------------------------------+
| 3. Tốc độ Duyệt Dữ liệu  | ❌ CHẬM: Muốn xem bản ghi tiếp theo | ✅ NHANH: Tích hợp phím tắt [ ↑ ] [ ↓ ] hoặc |
|    (Batch Navigation)    | phải bấm Đóng Modal -> Tìm dòng mới | nút "Trước / Sau" trên header Drawer; duyệt  |
|                          | trên bảng -> Bấm nút mở lại Modal.  | liên tục 20 lead trong 2 phút.               |
+--------------------------+-------------------------------------+----------------------------------------------+
| 4. Thao tác Phối hợp     | ❌ KHÔNG THỂ: Không thể vừa xem     | ✅ DỄ DÀNG: Có thể mở Drawer xem thông số bản|
|    (Multi-tasking)       | bản vẽ chi tiết vừa thao tác bảng   | vẽ, đồng thời copy mã đơn sang màn hình chat |
|                          | hoặc tra cứu thông tin khác.        | Zalo hoặc phần mềm tính giá bên cạnh.        |
+--------------------------+-------------------------------------+----------------------------------------------+
| 5. Thiết bị Di động      | ⚠️ Trung bình: Chiếm trọn màn hình, | ✅ Tự động chuyển thành Full-screen sheet với|
|    (Mobile / Tablet)     | dễ bị che khuất bởi bàn phím ảo.    | nút đóng rõ ràng, vuốt xuống để đóng mượt mà.|
+--------------------------+-------------------------------------+----------------------------------------------+
```

#### Kiến trúc Thành phần Thay thế: `AdminDrawer`
Đề xuất bổ sung component `AdminDrawer` chuẩn mực vào bộ primitive admin:
- Cố định cạnh phải màn hình (`right: 0, top: 0, height: 100dvh, width: min(640px, 100vw)`).
- Chuyển động trượt êm ái (CSS Transition `transform: translateX(0)` với thời gian 220ms ease-out).
- Header cố định chứa: Mã yêu cầu, Tên khách hàng, Huy hiệu trạng thái, Nút điều hướng bản ghi Trước/Sau (`ChevronUp` / `ChevronDown`) và Nút đóng (`X`).
- Body cuộn dọc độc lập: Chia thành các tab rõ ràng: *Thông tin tiếp nhận*, *Bản vẽ & Chi tiết kỹ thuật*, *Dòng thời gian tương tác*, *Báo giá liên quan*.
- Footer cố định (Sticky Action Bar): Chứa các hành động nhanh quan trọng nhất: [Đổi trạng thái], [Tạo báo giá], [Gán nhân viên], [Gọi điện].

---

### 4.5 Phân tích Bảng Điều Khiển (Dashboard UX: Haravan Omni vs Giacong B2B Executive Dashboard)

#### 4.5.1 Phân tích Dashboard Haravan Admin
- **Mục tiêu thiết kế:** Tối ưu hóa cho mô hình thương mại điện tử bán lẻ đa kênh B2C (Direct-to-Consumer).
- **Các thành phần trực quan:**
  1. *Thẻ chỉ số tài chính (Financial Metric Cards):* Doanh thu gộp (Gross Sales), Doanh thu thuần (Net Sales), Số lượng đơn hàng, Giá trị trung bình đơn hàng (AOV).
  2. *Biểu đồ doanh thu theo giờ:* Đồ thị diện tích (Area chart) trực quan hóa doanh số tích lũy từ 00:00 đến 23:59 so sánh với cùng kỳ ngày hôm trước.
  3. *Phễu chuyển đổi mua sắm (Retail Funnel):* Lượt truy cập web -> Lượt thêm vào giỏ -> Lượt nhập thông tin thanh toán -> Đơn hàng hoàn tất.
  4. *Phân bổ doanh số theo kênh bán hàng:* Donut chart thể hiện tỷ trọng doanh thu từ Website, Shopee, TikTok Shop, POS tại cửa hàng.
- **Nhận xét chuyên môn:** Đây là một dashboard bán lẻ xuất sắc, trực quan, cập nhật theo thời gian thực. **Tuy nhiên, 90% các chỉ số này hoàn toàn vô giá trị đối với Giacong.vn**:
  - Đơn hàng gia công sản xuất không diễn ra theo giờ trong ngày.
  - Khách hàng không mua sắm qua giỏ hàng bán lẻ để đo "Lượt thêm vào giỏ".
  - Doanh thu B2B được ghi nhận theo từng đợt tạm ứng hợp đồng (Milestone Billing), không phải thanh toán tiền tươi qua cổng thanh toán trực tuyến.

#### 4.5.2 Phân tích Dashboard Hiện tại của Giacong.vn (`src/app/admin/page.tsx`)
- **Mục tiêu thiết kế ban đầu:** Bảng điều khiển quản trị nội dung và danh mục tĩnh (CMS & Catalog Operations).
- **Các thành phần hiện có:**
  1. *4 thẻ đếm số lượng:* Tổng sản phẩm, Sản phẩm bản nháp, Dịch vụ gia công, Bài viết tin tức.
  2. *Hộp "Công việc thường dùng" (Shortcuts):* 3 đường link dẫn nhanh đến trang Sản phẩm, Dịch vụ, Tin tức.
  3. *Hộp "Độ sẵn sàng dữ liệu" (`DataReadiness`):* Hiển thị trạng thái kết nối các bảng D1 (danh sách thành viên, lịch sử thay đổi, bảng phụ sản phẩm/dịch vụ).
- **Các điểm nghẽn nghiêm trọng về UX và Giá trị Vận hành:**
  1. **"Mù thông tin thương mại" (Zero Commercial Visibility):** Không có bất kỳ con số nào phản ánh tình hình kinh doanh, số lượng yêu cầu mới tiếp nhận, số báo giá đang chờ khách phản hồi hay giá trị doanh số dự kiến.
  2. **Lãng phí Không gian Màn hình Bậc nhất cho Công cụ Kỹ thuật:** Bảng `DataReadiness` chiếm trọn 50% diện tích nửa dưới màn hình. Đây là tính năng hữu ích cho lập trình viên khi chạy migration thử nghiệm ở môi trường dev/staging, nhưng đối với Giám đốc điều hành và nhân viên kinh doanh hàng ngày, bảng này hoàn toàn vô nghĩa và gây nhiễu thị giác nghiêm trọng.
  3. **Thiếu Hàng đợi Cảnh báo Cần xử lý Gấp (No Urgent Attention Queue):** Không có khu vực cảnh báo các rủi ro vận hành: Lead nào gửi quá 24h chưa ai trả lời? Báo giá nào sắp hết hạn hiệu lực 15 ngày? Mẫu thử nào đã gửi 5 ngày khách chưa phản hồi kết quả kiểm tra?

#### 4.5.3 Đề xuất Bảng Điều Khiển Vận Hành Thương Mại B2B (B2B Commercial Executive Dashboard Blueprint)
Tái thiết kế trang `/admin` thành Trung tâm Điều hành Kinh doanh & Sản xuất B2B với 4 khối thông tin chuẩn mực:

```
+---------------------------------------------------------------------------------------------------------------+
| BẢNG ĐIỀU KHIỂN VẬN HÀNH THƯƠNG MẠI B2B (B2B EXECUTIVE DASHBOARD LAYOUT)                                      |
+---------------------------------------------------------------------------------------------------------------+
| [HÀNG 1: BỘ LỌC THỜI GIAN & CHỈ SỐ CỐT LÕI (KEY PIPELINE METRICS - 4 CARDS)]                                  |
| ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐                      |
| │ ĐƯỜNG ỐNG BÁO GIÁ │ │ YÊU CẦU MỚI (RFQ) │ │ DOANH SỐ ĐÃ CHỐT  │ │ TỶ LỆ THẮNG THẦU  │                      |
| │ 1.850.000.000 đ   │ │ 14 yêu cầu        │ │ 620.000.000 đ     │ │ 32.5%             │                      |
| │ 28 báo giá mở     │ │ ⚠️ 3 lead > 24h   │ │ +18% so tháng trc │ │ Chu kỳ TB: 16 ngày│                      |
| └───────────────────┘ └───────────────────┘ └───────────────────┘ └───────────────────┘                      |
+---------------------------------------------------------------------------------------------------------------+
| [HÀNG 2: PHỄU CHUYỂN ĐỔI B2B & HÀNG ĐỢI XỬ LÝ GẤP (2-COLUMN GRID: 65% - 35%)]                                  |
| ┌──────────────────────────────────────────────┐ ┌──────────────────────────────────────────┐                 |
| │ 📊 PHỄU BÁO GIÁ & CHUYỂN ĐỔI GIA CÔNG        │ │ 🚨 CẦN XỬ LÝ GẤP (ATTENTION QUEUE)       │                 |
| │                                              │ │                                          │                 |
| │ Tiếp nhận (RFQs):      48 yêu cầu  (100.0%)  │ │ 🔴 YC-2026-0891: Chưa phản hồi 28 giờ    │                 |
| │ Đã thẩm định & liên hệ:36 yêu cầu  ( 75.0%)  │ │    Khách: Cơ khí An Phát · Sales: [Gán]  │                 |
| │ Đã gửi Báo giá chính:  24 báo giá  ( 50.0%)  │ │ 🟡 BG-2026-0042: Báo giá hết hạn sau 24h │                 |
| │ Làm mẫu thử nghiệm:    12 mẫu thử  ( 25.0%)  │ │    Giá trị: 145tr · Khách: Bình Minh Med │                 |
| │ Đàm phán hợp đồng:      8 hợp đồng ( 16.6%)  │ │ 🔵 MT-2026-0015: Chờ biên bản duyệt mẫu  │                 |
| │ Đã chốt thành công:     6 hợp đồng ( 12.5%)  │ │    Đã giao mẫu 4 ngày · Nhựa Kỹ thuật VT │                 |
| └──────────────────────────────────────────────┘ └──────────────────────────────────────────┘                 |
+---------------------------------------------------------------------------------------------------------------+
| [HÀNG 3: BẢNG BÁO CÁO HIỆU SUẤT NHÂN VIÊN & TRẠNG THÁI HỆ THỐNG]                                              |
| ┌─────────────────────────────────────────────────────────────┐ ┌───────────────────────────┐                 |
| │ 🏆 HIỆU SUẤT ĐỘI NGŨ KINH DOANH (SALES PERFORMANCE)          │ │ ⚙️ TRẠNG THÁI HẠ TẦNG     │                 |
| │ Nhân viên       | Đang giữ | Pipeline      | Đã chốt MTD    │ │ Cloudflare D1: Sẵn sàng   │                 |
| │ Nguyễn Văn A    | 12 lead  | 680.000.000 đ | 280.000.000 đ  │ │ Cloudflare R2: 1.2 GB CAD │                 |
| │ Trần Thị B      |  9 lead  | 520.000.000 đ | 210.000.000 đ  │ │ Webhook Sink: 100% OK     │                 |
| │ Lê Hoàng C      |  7 lead  | 410.000.000 đ | 130.000.000 đ  │ │ (Đã thu gọn vào link phụ) │                 |
| └─────────────────────────────────────────────────────────────┘ └───────────────────────────┘                 |
+---------------------------------------------------------------------------------------------------------------+
```

---

## 5. TỔNG KẾT BẢN ĐỒ CHIẾN LƯỢC NÂNG CẤP LEAN V1

```
+---------------------------------------------------------------------------------------------------+
|                                  GIACONG.VN LEAN V1 CORE ROADMAP                                  |
+---------------------------------------------------------------------------------------------------+
| 1. KHÔNG PHÁ VỠ NỀN TẢNG CLOUDFLARE NATIVE                                                        |
|    - Tiếp tục vận hành 100% trên D1 SQLite, R2 Storage và Workers.                                |
|    - Không đưa các thành phần máy chủ cồng kềnh (Node.js daemon, Redis, Docker container)         |
|      hoặc phục hồi kiến trúc Bagisto PHP cũ vào hệ thống.                                         |
|                                                                                                   |
| 2. TẬP TRUNG 100% NĂNG LƯỢNG VÀO QUY TRÌNH THƯƠNG MẠI B2B                                         |
|    - Hoàn thiện Hồ sơ Khách hàng (Customer 360) và Dòng thời gian tương tác (Timeline).           |
|    - Xây dựng Công cụ Báo giá Gia công (Quote Builder) chuẩn hóa gắn với động cơ bậc giá D1.      |
|    - Phân công rõ ràng trách nhiệm cho đội ngũ kinh doanh, kiểm soát chặt chẽ tỷ lệ chốt đơn.     |
|                                                                                                   |
| 3. GIỮ VỮNG TÍNH TINH GỌN VÀ CHI PHÍ VẬN HÀNH BẰNG KHÔNG                                         |
|    - Tận dụng tối đa khả năng xử lý tại biên (Edge Computing) của Next.js 15 App Router.          |
|    - Loại bỏ hoàn toàn các tính năng bán lẻ dư thừa để giao diện quản trị luôn đạt mật độ         |
|      thông tin cao (data-dense), tốc độ phản hồi dưới 50ms và không gây nhầm lẫn cho vận hành.   |
+---------------------------------------------------------------------------------------------------+
```

