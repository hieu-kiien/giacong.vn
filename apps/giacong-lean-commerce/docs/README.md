# Chỉ mục tài liệu — Cloudflare-native Lean V1

## Nguồn quyết định hiện hành

| Tài liệu | Vai trò |
| --- | --- |
| [CLOUDFLARE_NATIVE_V1_PLAN.md](./CLOUDFLARE_NATIVE_V1_PLAN.md) | **Nguồn quyết định duy nhất** về scope, kiến trúc đích và roadmap Lean V1 |
| [CLOUDFLARE_ADMIN_WRITE_CONTRACT.md](./CLOUDFLARE_ADMIN_WRITE_CONTRACT.md) | Contract server bắt buộc trước Admin UI: admission, validation, concurrency, D1/R2 integrity, audit và idempotency |
| [CLOUDFLARE_CURRENT_STATE.md](./CLOUDFLARE_CURRENT_STATE.md) | Bằng chứng runtime/staging/Cloudflare đã xác minh; không tự mở rộng product scope |
| [CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md) | Quy trình và safety gate triển khai Cloudflare staging → production |
| [UI_CURRENT_MAP.md](./UI_CURRENT_MAP.md) | Bản đồ storefront hiện tại và kế hoạch Admin UI sau khi server contract đạt gate |
| [GOOGLE_SHEETS_CONTACT_WEBHOOK.md](./GOOGLE_SHEETS_CONTACT_WEBHOOK.md) | Hướng dẫn vận hành request intake Google Sheet + Apps Script hiện hành |
| [google-apps-script-contact-webhook.gs](./google-apps-script-contact-webhook.gs) | Mã Apps Script đi cùng tài liệu webhook |

## Tài liệu lịch sử / tham khảo

- [COMMERCE_PLATFORM_MASTER_PLAN.md](./COMMERCE_PLATFORM_MASTER_PLAN.md): **legacy Bagisto-era**. Chỉ dùng để truy vết quyết định cũ; không dùng làm nguồn quyết định runtime, admin hoặc deployment hiện tại.
- [ORIGINAL_GIACONG_VN_MAP.md](./ORIGINAL_GIACONG_VN_MAP.md): bản đồ website gốc, chỉ phục vụ migration/research.
- `research/`: dữ liệu nghiên cứu/capture, không phải roadmap.
- `design-references/`: ảnh tham chiếu, không phải UI contract.
- `handoff-references/`: tài liệu bàn giao/capture cũ, không phải runtime source of truth.

## Nguyên tắc cập nhật tài liệu

1. Quyết định kiến trúc/scope mới phải cập nhật `CLOUDFLARE_NATIVE_V1_PLAN.md` trước khi code.
2. Thay đổi server write contract phải cập nhật `CLOUDFLARE_ADMIN_WRITE_CONTRACT.md` trước implementation.
3. Bằng chứng Cloudflare runtime, deployment và QA phải cập nhật `CLOUDFLARE_CURRENT_STATE.md` sau khi được xác minh.
4. Quy trình deploy/safety thay đổi phải cập nhật `CLOUDFLARE_DEPLOYMENT.md`.
5. Không tạo thêm MD quyết định trùng vai trò với các file trên.
6. Không phục hồi Bagisto/Vercel làm runtime chỉ vì tài liệu lịch sử còn chứa hướng dẫn cũ.

## Quyết định delivery hiện tại

**Cloudflare là platform triển khai duy nhất của Lean V1.** Next.js chạy qua OpenNext trên Cloudflare Workers; D1/R2 là canonical data/media; Cloudflare Access bảo vệ Admin; Google Sheet + Apps Script vẫn là request queue trong V1.

**Vercel không phải runtime/deployment target.** GitHub Actions là pipeline chính cho Cloudflare. Vercel preview integration `giacong-vn-demo` được coi là legacy integration cần được disable/remove sau khi xác minh không còn phụ thuộc; không sửa code chỉ để làm Vercel preview pass.

**Admin UI chưa được xây.** Thứ tự bắt buộc hiện tại là Tier-price atomic contract → R2 media contract → service contract → staging verification → Admin UI.

**Production vẫn khóa.** Không thay đổi Worker production, production D1/R2 hoặc `kienhieu.id.vn/*` trước production acceptance gate.
