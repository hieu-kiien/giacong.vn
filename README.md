# Giacong.vn workspace

Workspace này tách các nguồn theo vai trò để tránh nhầm lẫn giữa ứng dụng đang phát triển, tài liệu thiết kế, bản tham khảo và công cụ thu thập dữ liệu.

## Bắt đầu tại đây

- Ứng dụng đang phát triển: [`apps/giacong-lean-commerce`](apps/giacong-lean-commerce/)
- Mục lục tài liệu dự án: [`apps/giacong-lean-commerce/docs/README.md`](apps/giacong-lean-commerce/docs/README.md)
- Phạm vi sản phẩm hiện hành: [`apps/giacong-lean-commerce/docs/PROJECT_SCOPE_2026-09-27.md`](apps/giacong-lean-commerce/docs/PROJECT_SCOPE_2026-09-27.md)
- Kế hoạch kiến trúc Cloudflare-native V1: [`apps/giacong-lean-commerce/docs/CLOUDFLARE_NATIVE_V1_PLAN.md`](apps/giacong-lean-commerce/docs/CLOUDFLARE_NATIVE_V1_PLAN.md)

## 📋 Tài liệu Bàn giao & Hướng dẫn Khách hàng

Dành cho khách hàng, chủ doanh nghiệp và nhân sự vận hành hệ thống:

| Tài liệu | Đối tượng | Mô tả |
| :--- | :--- | :--- |
| 📑 [**Bàn giao Production (`handover-production.md`)**](docs/handover-production.md) | Chủ dự án & Quản trị hệ thống | Tổng quan hạ tầng `kienhieu.id.vn`, quy trình build/deploy canary, secrets, giới hạn CPU Free và giám sát |
| 🚀 [**Hoàn thiện & Nghiệm thu Production**](apps/giacong-lean-commerce/docs/PRODUCTION_COMPLETION_2026-10-12.md) | Đội kỹ thuật & Nghiệm thu | Checkpoint phát hành mới nhất: bản vá bảo mật, Apps Script v5, cache R2 và bằng chứng runtime |
| 🛠️ [**Bàn giao Admin Tinh gọn & Tài khoản**](apps/giacong-lean-commerce/docs/ADMIN_SIMPLE_HANDOFF_2026-10-05.md) | Khách hàng / Chủ shop / Sales | Cẩm nang hệ thống Admin tinh gọn, phiên đăng nhập dùng chung, ghi nhận giao dịch Zalo và xuất Excel |
| 📊 [**Hướng dẫn Vận hành Google Sheets**](apps/giacong-lean-commerce/docs/GOOGLE_SHEETS_CONTACT_WEBHOOK.md) | Nhân sự vận hành đơn | Hợp đồng đồng bộ yêu cầu mua hàng và giao dịch đã chốt sang Google Sheets |
| ✅ [**Checklist Nghiệm thu Production**](apps/giacong-lean-commerce/docs/PRODUCTION_ACCEPTANCE_CHECKLIST.md) | Nghiệm thu dự án | Danh mục kiểm thử nghiệm thu storefront, admin, responsive và bảo mật |
| 🌐 [**Nhật ký Trạng thái Cloudflare**](apps/giacong-lean-commerce/docs/CLOUDFLARE_CURRENT_STATE.md) | Đội kỹ thuật | Lịch sử các đợt kiểm tra, migration và snapshot version Worker |
| 📖 [**Hướng dẫn Sử dụng (Bản lưu trữ)**](apps/giacong-lean-commerce/docs/archive/legacy-2026-09-27/HUONG_DAN_SU_DUNG_KHACH_HANG.md) | Tham khảo lịch sử | Tài liệu hướng dẫn thao tác các màn hình CMS/Admin ban đầu |

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
