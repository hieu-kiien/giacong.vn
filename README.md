# Giacong.vn workspace

Workspace này tách các nguồn theo vai trò để tránh nhầm lẫn giữa ứng dụng đang phát triển, tài liệu thiết kế, bản tham khảo và công cụ thu thập dữ liệu.

## Bắt đầu tại đây

- Ứng dụng đang phát triển: [`apps/giacong-lean-commerce`](apps/giacong-lean-commerce/)
- Phạm vi và quyết định hiện hành: [`apps/giacong-lean-commerce/docs/CLOUDFLARE_NATIVE_V1_PLAN.md`](apps/giacong-lean-commerce/docs/CLOUDFLARE_NATIVE_V1_PLAN.md)
- Lộ trình admin visual: [`apps/giacong-lean-commerce/docs/ADMIN_VISUAL_ROADMAP.md`](apps/giacong-lean-commerce/docs/ADMIN_VISUAL_ROADMAP.md)
- Bản đồ file và ownership: [`apps/giacong-lean-commerce/docs/ADMIN_VISUAL_FILE_MAP.md`](apps/giacong-lean-commerce/docs/ADMIN_VISUAL_FILE_MAP.md)

## 📋 Tài liệu Bàn giao & Hướng dẫn Khách hàng

Dành cho khách hàng, chủ doanh nghiệp và nhân sự vận hành hệ thống:

| Tài liệu | Đối tượng | Mô tả |
| :--- | :--- | :--- |
| 📖 [**HƯỚNG DẪN SỬ DỤNG DÀNH CHO KHÁCH HÀNG**](apps/giacong-lean-commerce/docs/HUONG_DAN_SU_DUNG_KHACH_HANG.md) | Khách hàng / Chủ shop / Sales | Cẩm nang hướng dẫn đăng nhập Admin, quản lý sản phẩm B2B, quản trị nội dung CMS, xử lý đơn/RFQ trên Google Sheets |
| 📑 [**Tài liệu Bàn giao Vận hành (HANDOVER)**](apps/giacong-lean-commerce/docs/HANDOVER.md) | Chủ dự án & Quản trị hệ thống | Bản đồ hệ thống, Cloudflare Access, D1/R2, quy trình deploy và giám sát |
| ✅ [**Checklist Nghiệm thu (PRODUCTION_ACCEPTANCE)**](apps/giacong-lean-commerce/docs/PRODUCTION_ACCEPTANCE_CHECKLIST.md) | Nghiệm thu dự án | Danh mục kiểm thử nghiệm thu storefront, admin, responsive và bảo mật |
| 📊 [**Hướng dẫn Vận hành Google Sheets**](apps/giacong-lean-commerce/docs/GOOGLE_SHEETS_CONTACT_WEBHOOK.md) | Nhân sự vận hành đơn | Hướng dẫn quản lý dữ liệu đơn hàng và báo giá trên Google Sheets |
| 🌐 [**Trạng thái Cloudflare Production**](apps/giacong-lean-commerce/docs/CLOUDFLARE_CURRENT_STATE.md) | Đội kỹ thuật | Trạng thái phát hành, version Worker trên domain kienhieu.id.vn |

## Cấu trúc

| Vị trí | Vai trò | Cách dùng |
| --- | --- | --- |
| `apps/giacong-lean-commerce/` | Storefront B2B Lean V1 bằng Next.js trên Cloudflare-native (D1/R2/Workers), với Google Sheet/App Script làm request queue. | Đây là repo triển khai chính; `CLOUDFLARE_NATIVE_V1_PLAN.md` là nguồn quyết định hiện hành. |
| `design/ai-handoff/` | Gói bàn giao yêu cầu sản phẩm, IA, thiết kế, ảnh tham chiếu và đặc tả component. | Dùng làm đầu vào thiết kế; không ghi đè quyết định Lean V1. |
| `design/stitch-design-system/` | Các màn hình và biến thể thiết kế sinh từ Stitch. | Dùng để tham khảo giao diện và đối chiếu hình ảnh. |

## Quy ước

- Không phát triển tính năng mới trong `design/` nếu mục tiêu là storefront Lean V1.
- Không xem dữ liệu crawl, ảnh tham chiếu hoặc gói handoff là nội dung production đã xác nhận.
- Các thư mục `node_modules`, `.next`, báo cáo test và cache là dữ liệu có thể tái tạo; không cần sao chép giữa các repo.
- Workspace root không phải npm workspace; chạy lệnh ứng dụng từ `apps/giacong-lean-commerce/` bằng `npm` theo [SETUP.md](apps/giacong-lean-commerce/SETUP.md).
