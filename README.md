# Giacong Lean Commerce

Storefront B2B dùng Next.js, Bagisto admin cho catalog/nội dung, và Google Sheet + Apps Script cho hàng đợi yêu cầu.

## Lean V1

Khách xem catalog, chọn biến thể/số lượng hoặc gửi yêu cầu dịch vụ. Mỗi submit được chấp nhận tạo một dòng Google Sheet riêng. V1 không có customer account, cart, checkout, payment, Bagisto order, vận chuyển hay quote engine.

Chỉ có một tài khoản `administrator` dùng chung. Bagisto admin là đích quản trị dài hạn; `/quan-tri` chỉ là bề mặt chuyển tiếp frozen. Không ghi trực tiếp bảng core Bagisto.

Trạng thái hiện tại và mọi quyết định phạm vi nằm trong [master plan](docs/COMMERCE_PLATFORM_MASTER_PLAN.md). Hướng dẫn webhook hiện tại nằm tại [Google Sheets webhook guide](docs/GOOGLE_SHEETS_CONTACT_WEBHOOK.md). `docs/research/` và `docs/design-references/` là bằng chứng lịch sử của bản clone, không phải roadmap sản phẩm.

## Cấu trúc chính

```text
src/       Storefront, BFF và thành phần giao diện
docs/      Master plan, webhook guide và bằng chứng nghiên cứu
scripts/   Kiểm thử và công cụ kiểm tra cục bộ
public/    Tài sản storefront
```

## Lệnh

```bash
npm run test:contact
npm run lint
npm run typecheck
npm run build
npm run check
```

`npm run dev` dùng cấu hình Next hiện có; không chạy hoặc đổi cấu hình cổng `3000`, `8000`, `8001` trong công việc Lean V1. Theo `.env.example`, Bagisto nội bộ dùng `127.0.0.1:18001`; Docker development hiện ánh xạ `${DEV_PORT:-3001}` vào cổng nội bộ `3000`. Không suy diễn hay tự đổi cổng khác.

## Bước kế tiếp

Viết test RED cho workflow vận hành Google Sheet: protection A:K/O, dropdown/data validation, chuyển trạng thái bằng `onEdit`, tab `Tổng quan` và checklist bàn giao quyền kiểm soát Google cho khách. Việc nối ngữ cảnh product/service từ storefront/UI vào contract backend cũng vẫn chưa làm.
