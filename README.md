# Giacong.vn workspace

Workspace này tách rõ ứng dụng đang phát triển, tài liệu thiết kế, dữ liệu tham khảo và công cụ thu thập để tránh nhầm nguồn quyết định với tài sản legacy.

## Bắt đầu tại đây

- Ứng dụng Lean V1 đang phát triển: [`apps/giacong-lean-commerce`](apps/giacong-lean-commerce/)
- Quyết định kiến trúc hiện hành: [`apps/giacong-lean-commerce/docs/CLOUDFLARE_NATIVE_V1_PLAN.md`](apps/giacong-lean-commerce/docs/CLOUDFLARE_NATIVE_V1_PLAN.md)
- Trạng thái đã xác minh: [`apps/giacong-lean-commerce/docs/CLOUDFLARE_CURRENT_STATE.md`](apps/giacong-lean-commerce/docs/CLOUDFLARE_CURRENT_STATE.md)
- Contract write/admin: [`apps/giacong-lean-commerce/docs/CLOUDFLARE_ADMIN_WRITE_CONTRACT.md`](apps/giacong-lean-commerce/docs/CLOUDFLARE_ADMIN_WRITE_CONTRACT.md)
- Hướng dẫn local: [`apps/giacong-lean-commerce/SETUP.md`](apps/giacong-lean-commerce/SETUP.md)

## Kiến trúc hiện hành

Lean V1 là ứng dụng **Cloudflare-native**:

- Next.js 16 + React 19 chạy trên Cloudflare Workers qua OpenNext;
- Cloudflare D1 là source of truth cho catalog, CMS, lead và audit;
- Cloudflare R2 lưu media;
- Cloudflare Queues xử lý delivery bất đồng bộ khi binding được provision;
- Google Apps Script/Sheet là secondary operational sink, không phải canonical database;
- Cloudflare Access kết hợp authorization trong D1 bảo vệ admin.

**Bagisto/PHP/VPS không còn là commerce runtime đích.** Những tài liệu, source hoặc dữ liệu Bagisto/legacy còn tồn tại chỉ để tham khảo, regression hoặc hồ sơ chuyển đổi và không được dùng để quyết định kiến trúc mới.

## Cấu trúc

| Vị trí | Vai trò | Cách dùng |
| --- | --- | --- |
| `apps/giacong-lean-commerce/` | Ứng dụng B2B Lean V1 Cloudflare-native. | Đây là runtime và codebase triển khai chính. |
| `design/ai-handoff/` | Gói bàn giao yêu cầu sản phẩm, IA, thiết kế, ảnh tham chiếu và đặc tả component. | Dùng làm đầu vào thiết kế, không ghi đè plan hiện hành. |
| `design/stitch-design-system/` | Các màn hình và biến thể thiết kế sinh từ Stitch. | Dùng để tham khảo giao diện và đối chiếu hình ảnh. |
| `reference/legacy-site-replica/` | Bản replica cũ của site, backend/dữ liệu/ảnh legacy. | Chỉ nghiên cứu hoặc đối chiếu hành vi/nội dung cũ. |
| `tools/original-site-crawler/` | Crawler Python và dữ liệu JSON/CSV thu thập từ site gốc. | Dùng khi cần tái thu thập hoặc kiểm chứng nguồn tham khảo. |

## Quy ước

- Không phát triển runtime Lean V1 trong `design/`, `reference/` hay `tools/`.
- Không tái đưa Bagisto API/env/proxy vào runtime nếu không có quyết định kiến trúc mới được ghi rõ trong plan.
- Không xem dữ liệu crawl, ảnh tham chiếu, demo data hoặc gói handoff là nội dung production đã được phê duyệt.
- Không commit `.env`, `.env.local`, `.dev.vars`, secrets Cloudflare/Google hoặc credential khác.
- Các thư mục `node_modules`, `.next`, báo cáo test và cache là dữ liệu có thể tái tạo.
