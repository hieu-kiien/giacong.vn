# Chỉ mục tài liệu

**Điểm vào của đợt nghiệm thu hiện tại là
[RELEASE_READINESS_AUDIT.md](./RELEASE_READINESS_AUDIT.md)**. Source B2B catalogue +
RFQ đã được sửa và commit tại `6059cca7cb4fa1ffa7a426d63adf76fdefcb16d3`, deploy trên staging Worker
`4c85039f-183c-4ba5-aed6-3e1fd82dea93` để kiểm tra đúng bản cuối. Production chưa
được deploy, migrate, đổi DNS hoặc đổi quyền.

Các tài liệu dưới đây phân biệt rõ bằng chứng staging hiện tại với checkpoint lịch
sử. Không dùng test xanh, URL `200` hoặc dữ liệu QA staging để kết luận đã bàn giao
production.

## Tài liệu hiện hành

| Tài liệu | Vai trò |
| --- | --- |
| [CLOUDFLARE_NATIVE_V1_PLAN.md](./CLOUDFLARE_NATIVE_V1_PLAN.md) | Nguồn quyết định hiện hành về runtime Cloudflare-native, admin control plane, RBAC và phạm vi Lean V1 |
| [CLOUDFLARE_ADMIN_WRITE_CONTRACT.md](./CLOUDFLARE_ADMIN_WRITE_CONTRACT.md) | Hợp đồng guard, validation, optimistic concurrency, error mapping và audit cho API admin |
| [CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md) | Phụ lục triển khai bắt buộc: khóa Cloudflare Workers/OpenNext là production target; khi nội dung deployment cũ mâu thuẫn, phụ lục này thắng cho tới khi master plan được đồng bộ toàn văn |
| [UI_CURRENT_MAP.md](./UI_CURRENT_MAP.md) | Bản đồ route và giao diện đang có |
| [GOOGLE_SHEETS_CONTACT_WEBHOOK.md](./GOOGLE_SHEETS_CONTACT_WEBHOOK.md) | Hướng dẫn vận hành webhook và Google Sheet |
| [PRODUCTION_ACCEPTANCE_CHECKLIST.md](./PRODUCTION_ACCEPTANCE_CHECKLIST.md) | Checklist cổng production acceptance: staging, admin CRUD, Google Sheet live, dữ liệu thật, rollback/promotion |
| [RELEASE_READINESS_AUDIT.md](./RELEASE_READINESS_AUDIT.md) | Kết luận audit release, skills.sh, bằng chứng hiện có và các gate còn mở |
| [AI_ADMIN_SKILL_GUIDE.md](./AI_ADMIN_SKILL_GUIDE.md) | Hợp đồng sử dụng skill repo-scoped `giacong-admin` để xây dựng và kiểm duyệt admin |
| [ADMIN_QUALITY_REVIEW.md](./ADMIN_QUALITY_REVIEW.md) | Đợt sửa trải nghiệm admin, bảo vệ bản nháp, bằng chứng browser cục bộ và các gate còn lại trước phát hành |
| [ADMIN_VISUAL_ROADMAP.md](./ADMIN_VISUAL_ROADMAP.md) | Roadmap visual trước đây; thứ tự ưu tiên đã được thay bằng brief recovery ngày 2026-09-07 |
| [ADMIN_VISUAL_FILE_MAP.md](./ADMIN_VISUAL_FILE_MAP.md) | Bản đồ file, route, data source, quyền, test ownership và vùng editable của admin visual |
| [SUBAGENT_TEAM_OPERATING_MODEL.md](./SUBAGENT_TEAM_OPERATING_MODEL.md) | Quy trình tham khảo cũ; phân đội và phạm vi đợt tiếp theo theo brief recovery |
| [ASTRA_AUDIT_HANDOFF.md](./ASTRA_AUDIT_HANDOFF.md) | Hồ sơ audit/snapshot lịch sử để tra cứu; không phải cửa vào thực thi hoặc thứ tự ưu tiên mới |
| `npm run qa:astra-preflight` (`scripts/astra-audit-preflight.mjs`) | Preflight read-only: kiểm tra repo dirty/staged, engine/dependency, tài liệu/lệnh bắt buộc, generated artifacts và dấu hiệu `.env` trước khi review |
| [google-apps-script-contact-webhook.gs](./google-apps-script-contact-webhook.gs) | Mã Apps Script được kiểm thử; chỉnh cùng hướng dẫn webhook |
| [HANDOVER.md](./HANDOVER.md) | Tài liệu bàn giao vận hành: bản đồ hệ thống, admin, Google Sheet, triển khai/rollback, giám sát |

## Tài liệu tham khảo lịch sử

- [COMMERCE_PLATFORM_MASTER_PLAN.md](./COMMERCE_PLATFORM_MASTER_PLAN.md): hồ sơ Bagisto-era đã được thay thế; chỉ dùng để truy nguyên lịch sử.
- [ORIGINAL_GIACONG_VN_MAP.md](./ORIGINAL_GIACONG_VN_MAP.md): cấu trúc website gốc trước khi dựng lại.
- `research/`: số đo, hành vi và đặc tả dùng trong giai đoạn clone; không phải roadmap.
- `design-references/`: ảnh chụp website gốc và mockup kiểm chứng còn được tham chiếu.
- `handoff-references/references/approved/`: bộ ảnh sản phẩm đã chuẩn hóa tên; `preview-600/` dùng để đọc nhanh.
- `handoff-references/references/current/`: ảnh hiện trạng cũ để so sánh, không phải giao diện đích.

Các quyết định sản phẩm/kiến trúc mới phải cập nhật `CLOUDFLARE_NATIVE_V1_PLAN.md`; hướng dẫn thao tác chỉ tách file khi có người vận hành cần dùng độc lập. Không dùng master plan Bagisto lịch sử để suy ra trạng thái runtime hiện tại.
