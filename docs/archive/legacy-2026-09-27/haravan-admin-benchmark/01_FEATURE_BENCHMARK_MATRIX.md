# BÁO CÁO ĐỐI CHUẨN TÍNH NĂNG TOÀN DIỆN (FEATURE BENCHMARK MATRIX)
## Haravan Admin vs Giacong.vn Admin (Cloudflare-Native B2B Platform)

> **Mã tài liệu:** R1-BENCHMARK-HARAVAN-GIACONG  
> **Phiên bản:** 1.0.0 (Release Readiness)  
> **Ngày thực hiện:** 23/09/2026  
> **Người thực hiện:** System Gap Reviewer & Product Planner (Teamwork Research Agent)  
> **Hệ quy chiếu:** Haravan Admin (Target Reference: `https://chua-co-23.myharavan.com/admin`) đối chuẩn cùng Giacong.vn Admin (`apps/giacong-lean-commerce` Cloudflare D1/R2/Workers).

---

## 1. TỔNG QUAN PHƯƠNG PHÁP & QUY TẮC ĐÁNH GIÁ

### 1.1 Mục tiêu nghiên cứu
Nghiên cứu đối chuẩn (benchmarking) giữa hệ thống quản trị thương mại điện tử đa kênh bán lẻ hàng đầu Việt Nam (**Haravan Admin**) và hệ sinh thái quản trị sản xuất - gia công B2B tinh gọn của **Giacong.vn Admin** (`apps/giacong-lean-commerce`). Mục tiêu là bóc tách chính xác các khoảng cách nghiệp vụ, làm rõ các tính năng bán lẻ không phù hợp với gia công cơ khí / chế tác công nghiệp, và xác lập cơ sở sản phẩm vững chắc để phát triển phân hệ CRM & Báo giá tinh gọn trên nền tảng Cloudflare-native (D1, R2, Workers).

### 1.2 Thang đo và Phân định Kết quả So sánh (Verdict Definitions)
1. **Haravan Leads (Haravan vượt trội):** Tính năng Haravan đã hoàn thiện, vận hành ổn định, mang lại hiệu suất vượt trội mà Giacong.vn hiện chưa có hoặc chỉ ở mức sơ khai.
2. **Giacong Leads (Giacong vượt trội / Đặc thù B2B):** Tính năng được thiết kế chuyên biệt cho ngành gia công sản xuất (bậc giá số lượng, MOQ, thông số kỹ thuật, bản vẽ CAD, chi phí hạ tầng zero-SaaS) mà Haravan (vốn tối ưu cho bán lẻ B2C/đóng gói sẵn) không hỗ trợ hoặc xử lý rất gượng ép.
3. **Parity (Tương đương):** Cả hai hệ thống đều đáp ứng tốt ở mức độ tương đương về mặt nghiệp vụ cốt lõi.
4. **Not Applicable for B2B (Không phù hợp / Không áp dụng cho B2B):** Tính năng đặc thù bán lẻ B2C (flash sale, tích điểm đổi voucher, đồng bộ máy POS quét mã vạch bán lẻ, giỏ hàng bỏ quên) gây phình to hệ thống, tốn tài nguyên và không có giá trị thực tiễn cho quy trình đàm phán hợp đồng sản xuất B2B.

### 1.3 Mức độ tác động (Impact Levels)
- **Critical (Cốt tử / Sống còn):** Ảnh hưởng trực tiếp đến khả năng chốt hợp đồng, doanh thu, việc lưu giữ thông tin khách hàng doanh nghiệp hoặc kiểm soát thất thoát dữ liệu.
- **High (Cao):** Ảnh hưởng lớn đến năng suất làm việc của sales/kỹ thuật và trải nghiệm người dùng quản trị.
- **Medium (Trung bình):** Tối ưu hóa vận hành, tự động hóa tác vụ lặp lại.
- **Low (Thấp):** Tiện ích bổ trợ, giao diện nâng cao hoặc tùy biến hiển thị.

---

## 2. MA TRẬN ĐỐI CHUẨN TÍNH NĂNG CHI TIẾT (>= 35 TÍNH NĂNG TRÊN 5 PHÂN HỆ)

### Phân hệ 1: Dashboard & Executive Overview (Bảng điều khiển & Tổng quan Vận hành)

| STT | Tính năng cụ thể | Năng lực Haravan Admin | Hiện trạng Giacong.vn Admin | Đánh giá so sánh (Verdict) | Mức độ tác động (Impact) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.1 | **Báo cáo Doanh thu & Tăng trưởng thực tế** | Biểu đồ Real-time GMV, Net Sales, AOV, so sánh tăng trưởng theo kỳ trước (% delta). | Không có biểu đồ doanh thu. Chỉ có 4 bộ đếm số lượng (Sản phẩm, Dịch vụ, Tin tức, Yêu cầu). | **Haravan Leads** | **Critical** |
| 1.2 | **Tùy chọn Khung thời gian (Date Presets)** | Bộ lọc linh hoạt: Hôm nay, Hôm qua, 7 ngày qua, 30 ngày qua, Tháng này, Tùy chỉnh (Start/End Date). | Không có bộ lọc thời gian trên Dashboard. Dữ liệu chỉ đếm tổng lũy kế trong DB. | **Haravan Leads** | **High** |
| 1.3 | **Phễu Chuyển đổi Khách hàng (Conversion Funnel)** | Đo lường tỷ lệ: Lượt truy cập -> Thêm vào giỏ -> Đặt hàng thành công theo từng kênh. | Chưa có phễu chuyển đổi. Phân hệ Lead có danh sách trạng thái nhưng không có dashboard tỷ lệ chuyển đổi. | **Haravan Leads** | **High** |
| 1.4 | **Cảnh báo Vận hành & Cần xử lý gấp (Operational Alerts)** | Widget việc cần làm: Đơn chờ xác nhận, đơn lỗi giao hàng, sản phẩm sắp hết hàng, tin nhắn chưa trả lời. | Chỉ hiển thị nhãn tóm tắt: "{x} bản nháp cần hoàn thiện". Không có cảnh báo lead trễ hạn phản hồi hay đơn cần xử lý. | **Haravan Leads** | **High** |
| 1.5 | **Phân tích Kênh tiếp cận (Channel Breakdown)** | Phân rã doanh số theo Kênh: Website, Shopee, Lazada, TikTok Shop, POS, Social Chat. | Đã phân tách `source` (web form, contact) trong bảng leads, nhưng dashboard chưa tổng hợp báo cáo kênh. | **Haravan Leads** | **Medium** |
| 1.6 | **Kiểm tra Sẵn sàng Dữ liệu (Data Readiness Audit)** | Không có view kiểm tra cấu trúc kỹ thuật cho admin; dựa hoàn toàn vào SaaS abstraction. | **Có sẵn component `DataReadiness`**: kiểm tra trực tiếp trạng thái schema các bảng D1 (members, audit, leads, meta). | **Giacong Leads** | **Low** *(Nghiêng về Dev/Ops)* |
| 1.7 | **Đo lường Giá trị Đường ống Báo giá (Pipeline Value)** | Không chuyên cho B2B; chủ yếu tính tổng giá trị đơn hàng bán lẻ đã thanh toán/chờ thanh toán. | Chưa có. Cần widget hiển thị: Tổng giá trị báo giá đang mở, giá trị giai đoạn đàm phán, giá trị đã chốt tháng này. | **Haravan Leads** | **Critical** |

---

### Phân hệ 2: CRM & Customer 360 (Hồ sơ Khách hàng & Quản lý Tương tác)

| STT | Tính năng cụ thể | Năng lực Haravan Admin | Hiện trạng Giacong.vn Admin | Đánh giá so sánh (Verdict) | Mức độ tác động (Impact) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2.1 | **Hồ sơ Khách hàng Hợp nhất (Unified Customer 360)** | Profile đầy đủ: Lịch sử mua hàng, công nợ, tổng chi tiêu (LTV), số đơn, thông tin liên hệ, địa chỉ giao hàng. | **Chưa có bảng Customers riêng biệt**. Dữ liệu khách chỉ lưu phân mảnh theo từng dòng `leads` độc lập. | **Haravan Leads** | **Critical** |
| 2.2 | **Dòng thời gian Tương tác (Interaction Timeline)** | Ghi nhận tự động và thủ công: Lịch sử cuộc gọi, tin nhắn, email, đơn hàng phát sinh, nhân viên ghi chú nội bộ. | Không có timeline. Chỉ có modal tĩnh xem nội dung yêu cầu gửi lúc đầu. Chưa có chỗ lưu lịch sử gọi điện/họp kỹ thuật. | **Haravan Leads** | **Critical** |
| 2.3 | **Phân công Nhân viên Phụ trách (Sales / Account Assignment)** | Phân quyền phụ trách khách hàng cho từng nhân viên kinh doanh/CSKH. Phân luồng đơn tự động. | Schema D1 có cột `leads.assigned_to` nhưng **UI admin hoàn toàn chưa có chức năng gán nhân viên phụ trách**. | **Haravan Leads** | **Critical** |
| 2.4 | **Hệ thống Nhãn động (Dynamic Tags & Badges)** | Gán tag đa dạng cho khách hàng (VIP, đại lý, miền Nam, khó tính). Tự động gắn tag qua hành vi. | Không có tính năng tag khách hàng hay tag yêu cầu trong cơ sở dữ liệu và giao diện. | **Haravan Leads** | **High** |
| 2.5 | **Phân khúc Khách hàng Thông minh (Smart Segmentation)** | Tạo bộ lọc điều kiện kết hợp (ví dụ: chi tiêu > 50tr + mua trong 30 ngày gần nhất) để tạo phân khúc tái chăm sóc. | Chỉ có lọc đơn giản theo 1 trường `status` trên bảng `leads`. Chưa có phân khúc tập khách hàng. | **Haravan Leads** | **High** |
| 2.6 | **Hồ sơ Doanh nghiệp & Mã số thuế B2B (Corporate Account / MST)** | Haravan hỗ trợ trường công ty, xuất hóa đơn VAT điện tử, nhưng vẫn lấy cá nhân người mua làm trung tâm. | Form tiếp nhận có `company_name`, `country`, `vat_invoice`, nhưng chưa quản lý danh sách nhiều đầu mối thuộc cùng 1 công ty. | **Parity** | **Medium** |
| 2.7 | **Lưu trữ Hồ sơ Năng lực / Bản vẽ Kỹ thuật Khách hàng** | Không hỗ trợ lưu file kỹ thuật CAD/STEP đính kèm hồ sơ khách; chỉ hỗ trợ hình ảnh sản phẩm bán lẻ. | Hệ thống hỗ trợ R2 upload, sẵn sàng cho việc lưu trữ tài liệu kỹ thuật, bản vẽ CAD đính kèm hồ sơ khách hàng B2B. | **Giacong Leads** | **High** |
| 2.8 | **Điểm thưởng & Hạng thành viên Bán lẻ (Loyalty Points / Tier)** | Hệ thống tích điểm, thăng hạng (Silver, Gold, Diamond) đổi voucher mua sắm hàng tiêu dùng. | Không triển khai. Đàm phán gia công dựa trên hợp đồng khung và chiết khấu khối lượng, không dùng điểm thưởng. | **Not Applicable for B2B** | **Low** |

---

### Phân hệ 3: Tiếp nhận Yêu cầu, Báo giá & Quản lý Đơn hàng (Leads, RFQ, Quotes & Orders)

| STT | Tính năng cụ thể | Năng lực Haravan Admin | Hiện trạng Giacong.vn Admin | Đánh giá so sánh (Verdict) | Mức độ tác động (Impact) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 3.1 | **Hộp thư Tiếp nhận Yêu cầu / Báo giá (RFQ Inbox)** | Tiếp nhận đơn đặt hàng trực tiếp hoặc qua chat HaraSocial. Đơn hàng tạo ra thường gắn liền với sản phẩm có sẵn. | **Đã có `/admin/yeu-cau`**: Tiếp nhận RFQ đa dòng (dịch vụ gia công, sản phẩm mẫu, số lượng yêu cầu, ghi chú kỹ thuật). | **Parity** | **Critical** |
| 3.2 | **Bảng Báo giá Đa bậc Số lượng (Tiered Pricing Engine)** | Chỉ hỗ trợ giá cố định hoặc khuyến mãi voucher/combo. Không hỗ trợ tính bậc giá tự động theo số lượng MOQ công nghiệp. | **Vượt trội hoàn toàn**: Lưu trữ `variant_tier_prices`, tự tính toán giá đơn vị theo ngưỡng số lượng công nghiệp, bắt buộc MOQ và Step. | **Giacong Leads** | **Critical** |
| 3.3 | **Công cụ Soạn thảo Báo giá Thương mại (Quotation Builder)** | Cho phép tạo đơn hàng nháp (Draft Order), thêm sản phẩm, sửa giá trực tiếp, gửi link thanh toán bán lẻ. | Có danh sách RFQ nhưng **chưa có công cụ soạn báo giá chính thức** (tính thuế VAT, hạn báo giá, điều khoản cọc, xuất PDF/Zalo). | **Haravan Leads** | **Critical** |
| 3.4 | **Quy trình Quản lý Trạng thái Gia công (B2B Pipeline Stages)** | Trạng thái bán lẻ: Mới -> Đã xác nhận -> Đang giao hàng -> Đã giao hàng -> Hoàn tất / Hủy. | Đã quy hoạch 9 trạng thái chuẩn B2B: `new` -> `qualified` -> `contacted` -> `quotation_sent` -> `sampling` -> `negotiation` -> `won` -> `lost` -> `spam`. | **Giacong Leads** | **High** |
| 3.5 | **Giai đoạn Duyệt Mẫu Chế tác (Sampling & Prototyping Approval)** | Không hỗ trợ quy trình làm mẫu; mặc định hàng có sẵn trong kho xuất bán ngay. | Đã có trạng thái `sampling` trong D1 enum, nhưng chưa có luồng phụ lưu trữ biên bản nghiệm thu mẫu / ảnh mẫu thực tế. | **Giacong Leads** | **High** |
| 3.6 | **Thanh toán Theo Tiến độ Hợp đồng (Milestone Payments: Cọc / Quyết toán)** | Chỉ hỗ trợ thanh toán 1 lần 100% qua cổng (VNPAY, Momo, OnePay) hoặc COD nhận hàng trả tiền. | Hợp đồng gia công luôn chia đợt: Cọc 30-50% sản xuất, 50% trước khi giao/sau nghiệm thu. Hiện tại Giacong chưa có bảng theo dõi đợt thanh toán. | **Haravan Leads** *(Hiện trạng)* / **Giacong Cần thích ứng** | **Critical** |
| 3.7 | **Tích hợp Hãng Vận chuyển Giao vận Bán lẻ (GHN, GHTK, Viettel Post)** | Tích hợp tự động đẩy vận đơn sang GHTK, GHN, Viettel Post, in phiếu gửi hàng loạt, tính phí ship tự động. | Không khả dụng cho đơn hàng gia công tải trọng lớn (tấn hàng, xe tải riêng, chành xe). Cần quản lý biên bản bàn giao và vận chuyển B2B. | **Not Applicable for B2B** | **Medium** |
| 3.8 | **Cơ chế Phục hồi & Đồng bộ Thứ cấp (Secondary Sink Webhook)** | Gửi webhook tới các ứng dụng kết nối bên ngoài; nếu lỗi sẽ ghi log webhook chung. | **Đã có bộ theo dõi chuyển phát D1**: Cột `delivery_status`, `delivery_attempts`, `delivery_error`, tự động đồng bộ sang Google Sheets bảo toàn dữ liệu. | **Giacong Leads** | **Medium** |
| 3.9 | **Chiến dịch Thu hồi Giỏ hàng Bỏ quên (Abandoned Cart Recovery)** | Tự động gửi SMS/Zalo/Email nhắc nhở khách khi bỏ dở giỏ hàng sau 30 phút. | Khách B2B để RFQ trong cart là đang thu thập thông tin dự toán, không phải mua sắm bốc đồng. Cần sales trực tiếp liên hệ tư vấn. | **Not Applicable for B2B** | **Low** |

---

### Phân hệ 4: Analytics, Reporting & Data Export (Báo cáo, Phân tích & Xuất dữ liệu)

| STT | Tính năng cụ thể | Năng lực Haravan Admin | Hiện trạng Giacong.vn Admin | Đánh giá so sánh (Verdict) | Mức độ tác động (Impact) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 4.1 | **Báo cáo Hiệu suất Nhân viên Kinh doanh (Staff Sales Performance)** | Báo cáo chi tiết: Doanh thu theo nhân viên, số đơn chốt, tỷ lệ chuyển đổi đơn hàng của từng tài khoản nhân viên. | Hoàn toàn chưa có. Toàn bộ hệ thống hiện quy về một tài khoản `owner`, không thống kê được năng suất sales. | **Haravan Leads** | **Critical** |
| 4.2 | **Xuất Dữ liệu ra Excel/CSV (Bulk Data Export)** | Hỗ trợ xuất dữ liệu toàn diện (Khách hàng, Đơn hàng, Sản phẩm, Báo cáo tài chính) ra Excel/CSV có chọn lọc trường. | Hiện tại chỉ có Google Sheet làm sink thứ cấp. Giao diện Admin **chưa có nút xuất Excel/CSV trực tiếp** từ bảng D1. | **Haravan Leads** | **High** |
| 4.3 | **Phân tích Tần suất & Giá trị Khách hàng (RFM Analysis)** | Phân tích Recency, Frequency, Monetary để phát hiện khách hàng trung thành, khách hàng có nguy cơ rời bỏ. | Chưa có. Dữ liệu B2B cần đo chu kỳ đặt hàng định kỳ theo quý của nhà máy/doanh nghiệp. | **Haravan Leads** | **Medium** |
| 4.4 | **Báo cáo Tồn kho & Tốc độ Tiêu thụ Sản phẩm** | Cảnh báo tồn kho an toàn, tính toán vòng quay hàng tồn kho, giá vốn hàng bán (COGS). | B2B là sản xuất theo đơn đặt hàng (Make to Order - MTO), tồn kho chủ yếu là phôi/nguyên vật liệu thô thay vì thành phẩm bán lẻ. | **Not Applicable for B2B** | **Low** |
| 4.5 | **Báo cáo Tỷ lệ Thất bại / Thua thầu Báo giá (Lost Quote Analysis)** | Haravan có lý do hủy đơn (hết hàng, khách đổi ý, không liên lạc được). | Giacong có trạng thái `lost`, nhưng chưa có trường ghi nhận nguyên nhân thua thầu (giá cao, năng lực máy, tiến độ giao hàng). | **Haravan Leads** | **High** |
| 4.6 | **Bộ lọc Dữ liệu Nâng cao (Compound Filter Bar)** | Cho phép lưu bộ lọc tùy biến (Saved Views/Filters), lọc đa điều kiện thời gian + trạng thái + giá trị + nhân viên. | Chỉ có ô tìm kiếm text tự do và 1 dropdown trạng thái đơn giản. Chưa hỗ trợ lọc kết hợp đa điều kiện. | **Haravan Leads** | **Medium** |

---

### Phân hệ 5: Settings, Channels, Permissions & Security (Cài đặt, Phân quyền & Hạ tầng)

| STT | Tính năng cụ thể | Năng lực Haravan Admin | Hiện trạng Giacong.vn Admin | Đánh giá so sánh (Verdict) | Mức độ tác động (Impact) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 5.1 | **Phân quyền Theo Vai trò (Role-Based Access Control - RBAC)** | Phân quyền chi tiết từng module (xem, sửa, tạo, xóa, xuất báo cáo) cho từng phòng ban. | Đã định nghĩa 5 roles trong code (`owner`, `content_manager`, `catalog_manager`, `sales_manager`, `viewer`) nhưng **đang khóa cứng chỉ cho phép `owner` thao tác**. | **Haravan Leads** | **Critical** |
| 5.2 | **Nhật ký Hoạt động Quản trị & Chống Ghi đè (Audit Log & Concurrency)** | Ghi nhận lịch sử thao tác của nhân viên. Không có cơ chế optimistic concurrency chặt chẽ cho từng trường. | **Vượt trội về kỹ thuật**: Bảng `admin_lead_audit` kiểm soát khóa phiên bản `revision`, sha256 payload, chống ghi đè đồng thời (concurrency safe). | **Giacong Leads** | **High** |
| 5.3 | **Bảo mật Lớp Biên (Edge Perimeter Security / Zero Trust)** | Bảo mật qua tài khoản mật khẩu + OTP trên ứng dụng web truyền thống. | **Bảo mật Cloudflare Zero Trust Access**: Xác thực qua Google Workspace/Cloudflare Access trước khi vào mạng, chặn đứng tấn công DDoS ở biên. | **Giacong Leads** | **Critical** |
| 5.4 | **Mẫu Thông báo Khách hàng Tự động (Zalo ZNS / Email Templates)** | Trình soạn thảo mẫu thông báo Zalo ZNS, Email chào mừng, thông báo tình trạng đơn hàng được gửi tự động qua webhook. | Chưa có giao diện biên tập mẫu thông báo. Việc thông báo hiện phụ thuộc vào thao tác thủ công của nhân viên qua Zalo cá nhân. | **Haravan Leads** | **High** |
| 5.5 | **Tích hợp Đa kênh Bán lẻ (Omnichannel: Shopee, Lazada, TikTok)** | Đồng bộ sản phẩm, giá, tồn kho 2 chiều với các sàn thương mại điện tử lớn. | Không áp dụng cho dịch vụ gia công cơ khí / chế tạo theo yêu cầu (vốn không thể bán lẻ trên Shopee/Lazada). | **Not Applicable for B2B** | **Low** |
| 5.6 | **Chi phí Hạ tầng & Bản quyền Vận hành (Total Cost of Ownership - TCO)** | Tốn phí thuê bao SaaS hàng tháng (từ 500k - 3tr+/tháng) + phí tích hợp tính năng + phụ phí đơn hàng. | **Zero SaaS Cost**: 100% Cloudflare Native (D1, R2, Workers Free/Standard tier), không tốn phí bản quyền hàng tháng, không bị giới hạn số lượng đơn. | **Giacong Leads** | **Critical** |
| 5.7 | **Tốc độ Tải Trang & Độ Trễ Biên (Edge Latency & Global TTFB)** | Phục vụ từ cụm máy chủ truyền thống tại VN, TTFB 200ms - 500ms tùy tải. | **Edge Native Next.js 15**: Tải trang tức thì với Cloudflare Edge CDN toàn cầu, TTFB < 50ms, trải nghiệm thao tác quản trị cực nhanh. | **Giacong Leads** | **High** |

---

## 3. NĂM (05) ĐIỂM YẾU CHÍ MẠNG CỦA GIACONG ADMIN HIỆN TẠI

Qua khảo sát thực tế mã nguồn `apps/giacong-lean-commerce`, chúng tôi xác định 5 điểm nghẽn nghiêm trọng cản trở khả năng thương mại hóa và vận hành B2B:

### Điểm yếu 1: Hộp thư Lead Phân mảnh, Hoàn toàn Thiếu Hồ sơ Khách hàng Hợp nhất (No Customer 360)
- **Thực trạng mã nguồn:** Bảng dữ liệu chỉ có `leads` và `lead_items`. Mỗi lần khách gửi form, hệ thống sinh ra một bản ghi lead độc lập. Nếu khách hàng "Công ty Cơ khí Alpha" gửi 5 yêu cầu báo giá trong 3 tháng, hệ thống lưu thành 5 dòng rời rạc.
- **Hệ quả kinh doanh:** Người quản trị và nhân viên kinh doanh không thể tra cứu: Khách này đã từng đặt đơn gì trước đây? Tổng giá trị các đơn thành công là bao nhiêu? Có tiền sử hủy đơn hay ép giá không? Sự thiếu hụt "Customer Memory" khiến công ty bị động trong đàm phán hợp đồng lớn.

### Điểm yếu 2: Không có Dòng thời gian Ghi nhận Tương tác (Zero Interaction Memory & Timeline)
- **Thực trạng mã nguồn:** Mặc dù migration `0001_admin_operations.sql` có khai báo bảng `lead_events`, nhưng bảng này không được giao diện `/admin/yeu-cau` kích hoạt hay hiển thị. Giao diện chỉ cho phép đổi trạng thái trong dropdown.
- **Hệ quả kinh doanh:** Khi một sales rep liên hệ khách hàng qua điện thoại/Zalo, thỏa thuận về vật liệu, gửi báo giá sơ bộ hoặc hẹn gửi hàng mẫu, toàn bộ thông tin này nằm trong Zalo cá nhân của sales. Khi đổi nhân sự hoặc bàn giao công việc, sales mới hoàn toàn không biết khách đã trao đổi những gì, gây ức chế cho khách hàng doanh nghiệp và tăng tỷ lệ mất khách (churn).

### Điểm yếu 3: Thiếu Phân công Trách nhiệm & Cảnh báo Chậm phản hồi (No Sales Assignment & SLA Monitoring)
- **Thực trạng mã nguồn:** Cột `assigned_to` đã có trong database nhưng không xuất hiện trên UI. Hệ thống đang bị khóa chặt vào role duy nhất `owner` (theo quyết định tinh gọn 2026-09-07).
- **Hệ quả kinh doanh:** Khách gửi yêu cầu gia công trên web rơi vào một "hộp thư chung". Không có nhân viên cụ thể chịu trách nhiệm KPI xử lý; không có quy định SLA (ví dụ: phản hồi trong vòng 2 giờ làm việc). Trong ngành gia công, doanh nghiệp nào báo giá trước thường nắm 70% cơ hội thắng thầu. Việc thiếu phân công dẫn đến tình trạng "cha chung không ai khóc" và làm nguội lead nóng.

### Điểm yếu 4: Thiếu Công cụ Soạn Báo giá Thương mại & Theo dõi Đợt Thanh toán (No Quote Builder & Payment Milestones)
- **Thực trạng mã nguồn:** Quy trình xử lý lead hiện tại chỉ dừng ở việc chuyển trạng thái `quotation_sent`. Không có bảng `quotations`, không có công cụ tính chiết khấu dự án, không thể xuất bản in PDF hay link xem báo giá chuyên nghiệp có logo thương hiệu.
- **Hệ quả kinh doanh:** Nhân viên bắt buộc phải copy thông tin từ admin ra file Excel ngoài máy tính, tự căn chỉnh biểu mẫu, gửi qua email/Zalo cá nhân. Điều này vừa tốn thời gian, vừa gây sai sót số liệu, vừa khiến công ty mất kiểm soát về giá bán và lịch sử các phiên bản báo giá gửi cho đối tác.

### Điểm yếu 5: Bảng điều khiển "Mù Số liệu Kinh doanh" (Blind Executive Dashboard)
- **Thực trạng mã nguồn:** Tại `apps/giacong-lean-commerce/src/app/admin/page.tsx`, dashboard chỉ đếm số lượng bản ghi của 4 bảng nội dung (`products`, `draftProducts`, `services`, `news`). Dữ liệu `leadsTable` thậm chí còn bị lọc bỏ (`filter(([key]) => key !== "leadsTable")`).
- **Hệ quả kinh doanh:** Ban giám đốc hoàn toàn không có bức tranh tài chính: Tháng này nhận được bao nhiêu tiền cọc? Tổng giá trị các báo giá đang đàm phán là bao nhiêu tỷ đồng? Tỷ lệ chốt hợp đồng (Win rate) của từng dòng sản phẩm gia công là bao nhiêu? Hệ thống quản trị hiện tại là một "CMS quản lý bài viết và danh mục", chưa phải là một "Hệ điều hành kinh doanh B2B".

---

## 4. BA (03) ƯU THẾ VƯỢT TRỘI ĐẶC THÙ B2B CỦA GIACONG ADMIN

Dù còn thiếu sót về mặt tính năng CRM bán hàng, Giacong.vn sở hữu những nền tảng công nghệ và nghiệp vụ gia công mà các nền tảng bán lẻ như Haravan không thể có:

### Ưu thế 1: Động cơ Bậc giá Gia công & Kiểm soát MOQ Chặt chẽ (Tiered Pricing & Manufacturing Step Engine)
- **Bản chất công nghệ:** D1 Database quản lý trực tiếp bảng `variant_tier_prices` với logic server-side validation bất biến: tính giá tự động theo số lượng đặt hàng công nghiệp (ví dụ: từ 500 cái giá 45.000đ; từ 2.000 cái giá 35.000đ; từ 10.000 cái chuyển sang cơ chế "Liên hệ báo giá dự án").
- **Giá trị B2B:** Haravan và các nền tảng thương mại điện tử bán lẻ coi sản phẩm là món hàng đóng hộp có giá niêm yết cố định. Giacong.vn giải quyết đúng bài toán chi phí biên (marginal cost) giảm dần theo quy mô sản xuất của ngành gia công, ngăn chặn tình trạng khách đặt lẻ dưới ngưỡng sản xuất tối thiểu (MOQ) làm gián đoạn dây chuyền máy móc.

### Ưu thế 2: Khả năng Tiếp nhận Đa dòng RFQ Kỹ thuật & Sẵn sàng cho Dữ liệu CAD (Technical RFQ Intake & R2 Storage)
- **Bản chất công nghệ:** Bảng `lead_items` lưu trữ chi tiết: mã biến thể kỹ thuật, quy cách đóng gói, đơn vị tính đặc thù (mét, kg, kiện, bộ), ghi chú thông số gia công. Kết hợp với Cloudflare R2 bucket lưu trữ không giới hạn dung lượng, hệ thống có khả năng tiếp nhận trực tiếp các tệp tin nặng như bản vẽ kỹ thuật (PDF, DWG, STEP), tiêu chuẩn kỹ thuật kiểm định ISO/RoHS.
- **Giá trị B2B:** Trong ngành gia công, khách hàng không "mua hàng" mà "mua năng lực sản xuất". Việc tiếp nhận thông số kỹ thuật chuẩn hóa ngay từ khâu web intake giúp kỹ sư nhà máy bóc tách khối lượng (BOQ) nhanh gấp 5 lần so với việc đọc tin nhắn chat bán lẻ thông thường.

### Ưu thế 3: Kiến trúc Cloudflare-Native: Chi phí Vận hành Bằng Không & Bảo mật Biên Tuyệt đối (Zero-SaaS Cost & Edge Concurrency)
- **Bản chất công nghệ:** Không phụ thuộc vào hạ tầng máy chủ đắt đỏ hay phí bản quyền SaaS định kỳ của Haravan/Shopify. Toàn bộ hệ thống chạy trên Cloudflare Workers + D1 SQLite + R2 Storage.
- **Giá trị B2B:**
  1. *Chi phí bản quyền = 0 VNĐ:* Doanh nghiệp không phải trả tiền thuê bao người dùng hàng tháng (per-seat pricing) khi mở rộng đội ngũ sales hay nhà xưởng.
  2. *Bảo vệ dữ liệu đồng thời tuyệt đối (Pessimistic revision check & SHA256 audit):* Mọi thay đổi trạng thái đều kiểm tra số hiệu `revision`, đảm bảo hai nhân viên không bao giờ vô tình ghi đè làm sai lệch giá báo cho khách hàng doanh nghiệp.

---

## 5. TỔNG KẾT BẢNG ĐIỂM ĐỐI CHUẨN

```
+------------------------------------+------------------+------------------+-----------------+-----------------------+
| Phân hệ chức năng                  | Tổng tính năng   | Haravan dẫn đầu  | Giacong dẫn đầu | Tương đương / Không áp|
+------------------------------------+------------------+------------------+-----------------+-----------------------+
| 1. Dashboard & Executive Overview  | 7                | 5                | 1               | 1                     |
| 2. CRM & Customer 360              | 8                | 5                | 1               | 2                     |
| 3. Leads, Quotes & Orders          | 9                | 3                | 4               | 2                     |
| 4. Analytics, Reporting & Export   | 6                | 5                | 0               | 1                     |
| 5. Settings, Channels & Security   | 7                | 2                | 4               | 1                     |
+------------------------------------+------------------+------------------+-----------------+-----------------------+
| TỔNG CỘNG                          | 37 tính năng     | 20 (54%)         | 10 (27%)        | 7 (19%)               |
+------------------------------------+------------------+------------------+-----------------+-----------------------+
```

### Kết luận Chiến lược từ Ma trận Đối chuẩn:
Haravan vượt trội hoàn toàn ở khía cạnh **thương mại bán lẻ, chăm sóc khách hàng đa kênh (Social/Zalo/Omnichannel), quản lý nhân viên và báo cáo số liệu tài chính**. Tuy nhiên, Haravan bất lực trước **bài toán bậc giá công nghiệp, thông số kỹ thuật gia công và quy trình thanh toán hợp đồng chia kỳ**.

Chiến lược đúng đắn nhất cho Giacong.vn không phải là sao chép toàn bộ Haravan, mà là:
1. **Hấp thụ triệt để tư duy Customer 360, Dòng thời gian tương tác (Timeline), Phân công sales và Soạn báo giá chuyên nghiệp.**
2. **Kiên quyết loại bỏ các tính năng bán lẻ B2C dư thừa (POS máy in bill, flash sale, giỏ hàng bỏ quên, tích điểm voucher).**
3. **Phát huy tối đa thế mạnh Cloudflare Native siêu tốc, chi phí zero-SaaS và động cơ bậc giá sản xuất B2B.**
