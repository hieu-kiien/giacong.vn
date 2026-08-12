# Giacong.vn workspace

Workspace này tách các nguồn theo vai trò để tránh nhầm lẫn giữa ứng dụng đang phát triển, tài liệu thiết kế, bản tham khảo và công cụ thu thập dữ liệu.

## Bắt đầu tại đây

- Ứng dụng đang phát triển: [`apps/giacong-lean-commerce`](apps/giacong-lean-commerce/)
- Phạm vi và quyết định hiện hành: [`apps/giacong-lean-commerce/docs/COMMERCE_PLATFORM_MASTER_PLAN.md`](apps/giacong-lean-commerce/docs/COMMERCE_PLATFORM_MASTER_PLAN.md)

## Cấu trúc

| Vị trí | Vai trò | Cách dùng |
| --- | --- | --- |
| `apps/giacong-lean-commerce/` | Storefront B2B Lean V1 bằng Next.js; tích hợp Bagisto và Google Sheet/App Script. | Đây là repo triển khai chính. Master plan trong repo này là nguồn quyết định cuối. |
| `design/ai-handoff/` | Gói bàn giao yêu cầu sản phẩm, IA, thiết kế, ảnh tham chiếu và đặc tả component. | Dùng làm đầu vào thiết kế; không ghi đè quyết định Lean V1. |
| `design/stitch-design-system/` | Các màn hình và biến thể thiết kế sinh từ Stitch. | Dùng để tham khảo giao diện và đối chiếu hình ảnh. |
| `reference/legacy-site-replica/` | Bản replica cũ của site: frontend, backend, dữ liệu và ảnh đã crawl. | Chỉ dùng để nghiên cứu/đối chiếu hành vi và nội dung cũ, không phải ứng dụng đích. |
| `tools/original-site-crawler/` | Crawler Python và dữ liệu JSON/CSV thu thập từ giacong.vn. | Dùng khi cần tái thu thập hoặc kiểm chứng dữ liệu site gốc. |

## Quy ước

- Không phát triển tính năng mới trong `design/`, `reference/` hay `tools/` nếu mục tiêu là storefront Lean V1.
- Không xem dữ liệu crawl, ảnh tham chiếu hoặc gói handoff là nội dung production đã xác nhận.
- Các thư mục `node_modules`, `.next`, báo cáo test và cache là dữ liệu có thể tái tạo; không cần sao chép giữa các repo.
