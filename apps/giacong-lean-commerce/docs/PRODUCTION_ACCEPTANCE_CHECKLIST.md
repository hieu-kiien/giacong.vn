# Production acceptance checklist

Trạng thái chốt hạ trước promotion `giacong-vn` production. Nguồn yêu cầu gốc: [CLOUDFLARE_NATIVE_V1_PLAN.md](CLOUDFLARE_NATIVE_V1_PLAN.md) mục 7–8. Cập nhật 2026-08-23 sau staging gate.

## 1. Staging runtime acceptance — ĐÃ ĐÓNG

- [x] `npm run check` xanh toàn phần (tests + lint + typecheck + build)
- [x] OpenNext build/deploy staging thành công (`staging.kienhieu.id.vn`, version `0462b1cc`+)
- [x] Smoke catalog/detail/cart/R2: 7 route chính trả 200; trailing slash chuẩn hóa đúng
- [x] Malformed catalog path `/san-pham/*` → 404 với fallback UI đúng
- [x] Deep QA responsive (mobile/tablet/desktop): không tràn ngang, search/sort/lọc hoạt động, cart flow localStorage đúng contract, keyboard reachable — `scripts/qa-deep-staging.mjs` PASS 34/34
- [x] Rate limit POST `/api/contact`: 429 + Retry-After xác nhận trên staging thật
- [x] Admin-staging fail-closed (401 khi chưa qua Access)
- [ ] Deep QA bổ sung (nếu muốn): form validation UI, drift snapshot UX trên trình duyệt thật

## 2. Admin staging CRUD acceptance — CẦN NGƯỜI VẬN HÀNH

- [ ] Login qua Access public-demo mode trên `admin-staging.kienhieu.id.vn`
- [ ] CRUD products/variants/tier prices theo [CLOUDFLARE_ADMIN_WRITE_CONTRACT.md](CLOUDFLARE_ADMIN_WRITE_CONTRACT.md)
- [ ] Media upload R2 + xóa an toàn (không orphan reference)
- [ ] CMS nội dung: draft/publish tách biệt, stale-write protection

## 3. Google Sheet live verification — CẦN TÀI KHOẢN GOOGLE THẬT

Theo [GOOGLE_SHEETS_CONTACT_WEBHOOK.md](GOOGLE_SHEETS_CONTACT_WEBHOOK.md):

- [ ] Ownership/quyền kiểm soát sheet đích
- [ ] Apps Script deployment + authorization còn hiệu lực
- [ ] Idempotency/request ID chống ghi trùng
- [ ] Schema 15 cột của tab `Yêu cầu` và tab `Chi tiết giỏ hàng`
- [ ] Workflow trạng thái + protection range
- [ ] Timeout/redirect allowlist

## 4. Dữ liệu production thật — QUYẾT ĐỊNH KINH DOANH (owner)

- [ ] Taxonomy danh mục cuối cùng được duyệt
- [ ] SKU/variants/MOQ/quantity step/contact threshold từng sản phẩm được duyệt
- [ ] Tier price VND được duyệt (không dùng dữ liệu demo staging)
- [ ] Media sản phẩm thật upload R2 production (không copy ngầm từ staging)
- [ ] CMS nội dung production (logo, hero, hotline, footer) soạn và publish

Lưu ý: demo staging KHÔNG được seed sang production.

## 5. Production D1/R2 mutation + rollback plan

- [ ] Apply migrations production: `wrangler d1 migrations apply giacong-vn-catalog --remote` (có kiểm soát, audit sau khi chạy)
- [ ] Export backup D1 production trước khi seed dữ liệu thật: `wrangler d1 export giacong-vn-catalog --remote --output=backup.sql`
- [ ] Xác định rollback point Worker (version ID) trước mỗi lần promote traffic
- [ ] R2 bucket production rỗng/trạng thái đã biết trước khi upload media

## 6. Promotion production — chỉ làm sau khi đủ mục 1–5

- [ ] `npm run cf:upload:production` (upload, chưa shift traffic nếu có chính sách traffic splitting)
- [ ] Smoke production: cùng bộ check mục 1
- [ ] Giám sát observability 24h đầu (Workers logs, queue DLQ `giacong-vn-leads-dlq`)
- [ ] `https://giacong.vn` domain cũ: quyết định redirect về `kienhieu.id.vn` hoặc giữ song song (cần quyết định riêng)
