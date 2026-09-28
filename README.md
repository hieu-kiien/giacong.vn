# Giacong.vn workspace

Workspace này tách các nguồn theo vai trò để tránh nhầm lẫn giữa ứng dụng đang phát triển, tài liệu thiết kế, bản tham khảo và công cụ thu thập dữ liệu.

## Bắt đầu tại đây

- Ứng dụng đang phát triển: [`apps/giacong-lean-commerce`](apps/giacong-lean-commerce/)
- Phạm vi khách hàng hiện hành: [`apps/giacong-lean-commerce/docs/PROJECT_SCOPE_2026-09-27.md`](apps/giacong-lean-commerce/docs/PROJECT_SCOPE_2026-09-27.md)
- Kiến trúc kỹ thuật: [`apps/giacong-lean-commerce/docs/CLOUDFLARE_NATIVE_V1_PLAN.md`](apps/giacong-lean-commerce/docs/CLOUDFLARE_NATIVE_V1_PLAN.md)
- Chỉ mục tài liệu ứng dụng: [`apps/giacong-lean-commerce/docs/README.md`](apps/giacong-lean-commerce/docs/README.md)

## 📋 Tài liệu Bàn giao & Hướng dẫn Khách hàng

Dành cho khách hàng, chủ doanh nghiệp và nhân sự vận hành hệ thống:

| Tài liệu | Đối tượng | Mô tả |
| :--- | :--- | :--- |
| ✅ [**Checklist Nghiệm thu (PRODUCTION_ACCEPTANCE)**](apps/giacong-lean-commerce/docs/PRODUCTION_ACCEPTANCE_CHECKLIST.md) | Nghiệm thu dự án | Danh mục kiểm thử nghiệm thu storefront, admin, responsive và bảo mật |
| 📊 [**Hướng dẫn Vận hành Google Sheets**](apps/giacong-lean-commerce/docs/GOOGLE_SHEETS_CONTACT_WEBHOOK.md) | Nhân sự vận hành đơn | Hướng dẫn quản lý dữ liệu đơn hàng và báo giá trên Google Sheets |
| 🌐 [**Trạng thái Cloudflare Production**](apps/giacong-lean-commerce/docs/CLOUDFLARE_CURRENT_STATE.md) | Đội kỹ thuật | Trạng thái phát hành, version Worker trên domain kienhieu.id.vn |

## Cấu trúc

| Vị trí | Vai trò | Cách dùng |
| --- | --- | --- |
| `apps/giacong-lean-commerce/` | Website hiện có chạy Next.js trên Cloudflare-native (D1/R2/Workers). | Repo triển khai chính; brief khách hàng mới quyết định phạm vi sản phẩm. |
| `design/archive/legacy-2026-09-27/ai-handoff/` | Bộ đặc tả thiết kế và sản phẩm trước đây. | Chỉ để tra cứu lịch sử; không dùng làm yêu cầu hiện hành. |
| `docs/archive/legacy-2026-09-27/haravan-admin-benchmark/` | Benchmark Haravan và mô hình CRM mở rộng trước đây. | Lưu trữ lịch sử; không phải backlog hay phạm vi khách đã xác nhận. |
| `design/stitch-design-system/` | Các màn hình và biến thể thiết kế sinh từ Stitch. | Dùng để tham khảo giao diện và đối chiếu hình ảnh. |

## Quy ước

- Không phát triển tính năng mới trong `design/` nếu mục tiêu là storefront Lean V1.
- Không xem dữ liệu crawl, ảnh tham chiếu hoặc gói handoff là nội dung production đã xác nhận.
- Các thư mục `node_modules`, `.next`, báo cáo test và cache là dữ liệu có thể tái tạo; không cần sao chép giữa các repo.
- Workspace root không phải npm workspace; chạy lệnh ứng dụng từ `apps/giacong-lean-commerce/` bằng `npm` theo [SETUP.md](apps/giacong-lean-commerce/SETUP.md).
