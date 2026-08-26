# Chỉ mục tài liệu

## Tài liệu hiện hành

| Tài liệu | Vai trò |
| --- | --- |
| [CLOUDFLARE_NATIVE_V1_PLAN.md](./CLOUDFLARE_NATIVE_V1_PLAN.md) | Nguồn quyết định hiện hành về runtime Cloudflare-native, D1/R2, admin, RBAC và phạm vi Lean V1 |
| [CLOUDFLARE_ADMIN_WRITE_CONTRACT.md](./CLOUDFLARE_ADMIN_WRITE_CONTRACT.md) | Hợp đồng bảo mật và toàn vẹn dữ liệu cho các API ghi admin |
| [CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md) | Phụ lục triển khai bắt buộc: Cloudflare Workers/OpenNext là production target |
| [UI_CURRENT_MAP.md](./UI_CURRENT_MAP.md) | Bản đồ route và giao diện đang có |
| [GOOGLE_SHEETS_CONTACT_WEBHOOK.md](./GOOGLE_SHEETS_CONTACT_WEBHOOK.md) | Hướng dẫn vận hành webhook và Google Sheet |
| [PRODUCTION_ACCEPTANCE_CHECKLIST.md](./PRODUCTION_ACCEPTANCE_CHECKLIST.md) | Checklist cổng production acceptance: staging, admin CRUD, Google Sheet live, dữ liệu thật, rollback/promotion |
| [google-apps-script-contact-webhook.gs](./google-apps-script-contact-webhook.gs) | Mã Apps Script được kiểm thử; chỉnh cùng hướng dẫn webhook |
| [HANDOVER.md](./HANDOVER.md) | Tài liệu bàn giao vận hành: bản đồ hệ thống, admin, Google Sheet, triển khai/rollback, giám sát |

## Tài liệu tham khảo lịch sử

- [COMMERCE_PLATFORM_MASTER_PLAN.md](./COMMERCE_PLATFORM_MASTER_PLAN.md): master plan thời kỳ Bagisto; chỉ dùng để truy nguyên quyết định/migration cũ, không dùng làm nguồn kiến trúc hiện tại.
- [ORIGINAL_GIACONG_VN_MAP.md](./ORIGINAL_GIACONG_VN_MAP.md): cấu trúc website gốc trước khi dựng lại.
- `research/`: số đo, hành vi và đặc tả dùng trong giai đoạn clone; không phải roadmap.
- `design-references/`: ảnh chụp website gốc và mockup kiểm chứng còn được tham chiếu.
- `handoff-references/references/approved/`: bộ ảnh sản phẩm đã chuẩn hóa tên; `preview-600/` dùng để đọc nhanh.
- `handoff-references/references/current/`: ảnh hiện trạng cũ để so sánh, không phải giao diện đích.

Các quyết định sản phẩm/kiến trúc mới phải cập nhật `CLOUDFLARE_NATIVE_V1_PLAN.md`; hướng dẫn thao tác chỉ tách file khi có người vận hành cần dùng độc lập. Không dùng master plan Bagisto lịch sử để suy ra trạng thái runtime hiện tại.
