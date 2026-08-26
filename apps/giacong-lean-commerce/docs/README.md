# Chỉ mục tài liệu

## Tài liệu hiện hành

| Tài liệu | Vai trò |
| --- | --- |
| [COMMERCE_PLATFORM_MASTER_PLAN.md](./COMMERCE_PLATFORM_MASTER_PLAN.md) | Nguồn quyết định chính về phạm vi sản phẩm, kiến trúc ứng dụng và kế hoạch Lean V1 |
| [CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md) | Phụ lục triển khai bắt buộc: khóa Cloudflare Workers/OpenNext là production target; khi nội dung deployment cũ mâu thuẫn, phụ lục này thắng cho tới khi master plan được đồng bộ toàn văn |
| [UI_CURRENT_MAP.md](./UI_CURRENT_MAP.md) | Bản đồ route và giao diện đang có |
| [GOOGLE_SHEETS_CONTACT_WEBHOOK.md](./GOOGLE_SHEETS_CONTACT_WEBHOOK.md) | Hướng dẫn vận hành webhook và Google Sheet |
| [PRODUCTION_ACCEPTANCE_CHECKLIST.md](./PRODUCTION_ACCEPTANCE_CHECKLIST.md) | Checklist cổng production acceptance: staging, admin CRUD, Google Sheet live, dữ liệu thật, rollback/promotion |
| [google-apps-script-contact-webhook.gs](./google-apps-script-contact-webhook.gs) | Mã Apps Script được kiểm thử; chỉnh cùng hướng dẫn webhook |
| [HANDOVER.md](./HANDOVER.md) | Tài liệu bàn giao vận hành: bản đồ hệ thống, admin, Google Sheet, triển khai/rollback, giám sát |

## Tài liệu tham khảo lịch sử

- [ORIGINAL_GIACONG_VN_MAP.md](./ORIGINAL_GIACONG_VN_MAP.md): cấu trúc website gốc trước khi dựng lại.
- `research/`: số đo, hành vi và đặc tả dùng trong giai đoạn clone; không phải roadmap.
- `design-references/`: ảnh chụp website gốc và mockup kiểm chứng còn được tham chiếu.
- `handoff-references/references/approved/`: bộ ảnh sản phẩm đã chuẩn hóa tên; `preview-600/` dùng để đọc nhanh.
- `handoff-references/references/current/`: ảnh hiện trạng cũ để so sánh, không phải giao diện đích.

Không tạo thêm tài liệu quyết định ngoài master plan và phụ lục deployment Cloudflare đã khóa. Các quyết định sản phẩm mới vẫn phải cập nhật master plan; hướng dẫn thao tác chỉ tách file khi có người vận hành cần dùng độc lập.
