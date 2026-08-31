# Production acceptance checklist

Trạng thái chốt hạ trước promotion `giacong-vn` production. Nguồn yêu cầu gốc: [CLOUDFLARE_NATIVE_V1_PLAN.md](CLOUDFLARE_NATIVE_V1_PLAN.md) mục 7–8. Cập nhật 2026-08-26 sau production promotion.

> Lưu ý trạng thái: các checkbox dưới đây giữ evidence lịch sử của đợt nghiệm thu
> trước. Chúng không tự đóng các acceptance mới trong `ADMIN_VISUAL_ROADMAP.md`.
> Follow-up staging mới nhất được ghi ở mục 8 bên dưới.

## 1. Staging runtime acceptance — ĐÃ ĐÓNG

- [x] `npm run check` xanh toàn phần (tests + lint + typecheck + build)
- [x] OpenNext build/deploy staging thành công (`staging.kienhieu.id.vn`, version `56b28c53`+)
- [x] Smoke catalog/detail/cart/R2: 7 route chính trả 200; trailing slash chuẩn hóa đúng
- [x] Malformed catalog path `/san-pham/*` → 404 với fallback UI đúng
- [x] Deep QA responsive (mobile/tablet/desktop): không tràn ngang, search/sort/lọc hoạt động, cart flow localStorage đúng contract, keyboard reachable — `scripts/qa-deep-staging.mjs` PASS 34/34
- [x] Rate limit POST `/api/contact`: 429 + Retry-After xác nhận trên staging thật
- [x] Rate limit POST `/api/gui-yeu-cau/xac-thuc`: 429 + Retry-After 60 tại ngưỡng 30 req/phút/IP (2026-08-25)
- [x] Admin-staging fail-closed (401 khi chưa qua Access)
- [x] Catalog card hiển thị đủ mô tả + SKU + MOQ từ public feed/D1, có regression test (`catalog-listing.test.mts`)
- [x] Loading skeleton khớp breakpoint grid thật (commit `d52442b`)

## 2. Admin staging CRUD acceptance — ĐÃ ĐÓNG (2026-08-25)

- [x] Login qua Access public-demo mode trên `admin-staging.kienhieu.id.vn`
- [x] CRUD category/product/variant/service qua API thật: tạo 201, PATCH thiếu revision → 409 STALE_WRITE, archive 200
- [x] Media upload R2 + xóa an toàn: xóa asset đang là ảnh chính → 409 MEDIA_IN_USE; xóa sạch → object R2 404
- [x] "Dùng làm ảnh chính" cho product và service (re-read + PATCH chỉ imageUrl)
- [x] CMS nội dung: draft/publish tách biệt, stale-write protection (revision)
- [x] Ảnh chính dịch vụ: cột `services.image_url` (migration 0008), render có icon/band fallback

## 3. Google Sheet live verification — ĐÃ ĐÓNG (2026-08-26)

- [x] Ownership/quyền kiểm soát sheet: sheet `1TvtaJczm_YVVT1EhNgLeD8-8lK-KqvaJs_xkjYS_tf8` của chủ sở hữu
- [x] Apps Script deployment + authorization còn hiệu lực: Web App chạy dưới quyền chủ sheet, access "Bất kỳ ai"
- [x] Idempotency/request ID chống ghi trùng: cache `request:<uuid>` trong doPost
- [x] Schema 15 cột của tab `Yêu cầu` và tab `Chi tiết giỏ hàng`: `setupRequestWorkbook` tạo đủ, có validation dropdown
- [x] Workflow trạng thái + protection range: `onEdit` transitions + protectSheet giữ L:N editable
- [x] Timeout/redirect allowlist: Worker follow 302 về `script.googleusercontent.com` (allowlist), budget 15s
- [x] E2E thật: lead từ `kienhieu.id.vn/api/contact` → `delivery_status: delivered`, reference `YC-*` ghi vào Sheet
- Lưu ý vận hành: template đã vá 3 lỗi trên tài khoản Google cá nhân — `getProtections(ProtectionType.SHEET)`, thứ tự removeEditors/addEditor giữ chủ sheet, bọc `setDomainEdit` trong try/catch.

## 4. Dữ liệu production thật — KHÁCH TỰ NHẬP (không chặn bàn giao kỹ thuật)

- [ ] Taxonomy danh mục cuối cùng được duyệt — hiện có 4 categories + 9 sản phẩm seed `B2B-SEED-*` chờ khách sửa/thay qua admin
- [ ] SKU/variants/MOQ/quantity step/contact threshold từng sản phẩm được duyệt
- [ ] Tier price VND được duyệt (không dùng dữ liệu demo staging)
- [ ] Media sản phẩm thật upload R2 production (không copy ngầm từ staging)
- [ ] CMS nội dung production (logo, hero, hotline, footer) soạn và publish

Lưu ý: demo staging KHÔNG được seed sang production. Khách tự thao tác trên `admin.kienhieu.id.vn` qua Cloudflare Access.

## 5. Production D1/R2 mutation + rollback plan — ĐÃ ĐÓNG (2026-08-25)

- [x] Apply migrations production: 0004_admin_foundation, 0007_news_posts, 0008_service_images — ✅ audit trước/sau, dữ liệu nguyên vẹn
- [x] Export backup D1 production trước khi seed: `.runtime/production-d1-backup-20260825.sql`
- [x] Rollback point Worker xác định trước mỗi lần promote (version `88df8e93` → `07b57eb7` → hiện tại)
- [x] R2 bucket production trạng thái đã biết trước khi upload media
- [x] Sửa 3 lệch dữ liệu seed phát hiện bởi strict read path: contact threshold SME-02/NMC-10, thiếu cột variant_count, option_id = 0

> Phạm vi lịch sử của các mục `[x]` trên chỉ gồm migrations `0004/0007/0008`
> và đợt seed đã được ghi nhận. Read-only audit ngày 2026-08-31 cho thấy
> production vẫn còn `0009–0012` chưa apply; không tự thay đổi production khi
> các gate dữ liệu thật, Access role matrix và restore/rollback drill còn mở.

- [ ] Apply và verify production migrations `0009–0012` sau khi có production
  acceptance/backup/rollback window được phê duyệt.

## 6. Promotion production — ĐÃ ĐÓNG (2026-08-25)

- [x] Upload version chưa nhận traffic → smoke → promote có kiểm soát (`wrangler versions deploy <id>`)
- [x] Smoke production: 8/8 route 200 (home, listing, detail ×2, product API, giỏ yêu cầu, thuê gia công, tin tức)
- [x] Admin production fail-closed sau Access
- [ ] Giám sát observability 24h đầu (Workers logs, queue DLQ `giacong-vn-leads-dlq` — DLQ sạch tại 2026-08-25)
- [ ] `https://giacong.vn` domain cũ: quyết định redirect về `kienhieu.id.vn` — chủ dự án xử lý riêng tại registrar Tenten

## 7. Dọn dẹp trước bàn giao — ĐÃ ĐÓNG (2026-08-26)

- [x] Xóa ảnh QA cũ track trong git (`.qa-*.png`), `out2.txt`, `temp-clean-install-check/`
- [x] `.gitignore` bổ sung: `.agents/`, `.playwright-cli/`, `skills-lock.json` (tooling cục bộ)
- [x] Lead QA-STAGING trong D1 production: giữ nguyên làm vết kiểm toán, khách có thể xóa qua admin

## 8. Staging admin follow-up — ĐÃ XÁC MINH KỸ THUẬT, CHƯA ĐÓNG PRODUCTION GATE (2026-08-31)

- [x] Version staging `d9caf3ef-e212-45ee-bd26-f37450ed2928` upload và promotion 100%, có rollback point `91f79c65-a116-4865-b906-6467929c0f9b`.
- [x] Preview public route matrix trả 200; preview `/admin/*` bị chặn đúng boundary.
- [x] Admin session và `/api/admin/audit` trên hostname staging trả 200; audit hiển thị 93 sự kiện.
- [x] Regression cho giới hạn SQLite/D1 compound SELECT đã pass; migration staging không còn pending.
- [x] Product API và cart revalidation staging trả canonical data/money đúng sau promotion mới; cart test quantity `25` có subtotal `1.950.000 ₫`.
- [x] Category bulk archive contract đã có test atomic/revision/idempotency và route đã nằm trong staging artifact; không có hard-delete category.
- [x] Public route matrix sau promotion mới trả 200; browser console không có error/warning trong lượt kiểm tra.
- [ ] Browser admin desktop/mobile/keyboard/focus/reduced-motion với Access identity thật.
- [ ] Role × route/action read-back trên staging cho owner/content_manager/catalog_manager/sales_manager/viewer.
- [ ] Production data/content thật được chủ dự án duyệt và nhập chủ ý.
- [ ] Restore/rollback drill, observability 24h và quyết định redirect `giacong.vn` được xác nhận.
