# Production acceptance checklist

Trạng thái chốt hạ trước promotion `giacong-vn` production. Nguồn yêu cầu gốc: [CLOUDFLARE_NATIVE_V1_PLAN.md](CLOUDFLARE_NATIVE_V1_PLAN.md) mục 7–8. Cập nhật 2026-09-01 sau dependency hardening và staging revalidation.

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

## 2. Admin staging CRUD acceptance — LỊCH SỬ DEMO, CẦN XÁC NHẬN LẠI BẰNG ACCESS THẬT

- [x] Đợt public-demo trước đây đã đọc được admin staging (bằng chứng lịch sử, không thay thế Access identity thật)
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

## 5. Production D1/R2 mutation + rollback plan — LỊCH SỬ ĐÃ THỰC HIỆN, GATE HIỆN TẠI CÒN MỞ

- [x] Apply migrations production: 0004_admin_foundation, 0007_news_posts, 0008_service_images — ✅ audit trước/sau, dữ liệu nguyên vẹn
- [x] Đợt 2026-08-25 đã ghi nhận export backup D1 production trước khi seed
- [x] Rollback point Worker xác định trước mỗi lần promote (version `88df8e93` → `07b57eb7` → hiện tại)
- [x] R2 bucket production trạng thái đã biết trước khi upload media
- [x] Sửa 3 lệch dữ liệu seed phát hiện bởi strict read path: contact threshold SME-02/NMC-10, thiếu cột variant_count, option_id = 0

> Phạm vi lịch sử của các mục `[x]` trên chỉ gồm migrations `0004/0007/0008`
> và đợt seed đã được ghi nhận. Read-only audit ngày 2026-08-31 cho thấy
> production vẫn còn `0009–0016` chưa apply; không tự thay đổi production khi
> các gate dữ liệu thật, Access role matrix và restore/rollback drill còn mở.

> Revalidation 2026-08-31: artifact `.runtime/production-d1-backup-20260825.sql`
> không có trong workspace hiện tại. Mục export ở trên chỉ là bằng chứng lịch sử;
> phải re-export, lưu checksum và thử restore cục bộ ngay trước khi apply
> `0009–0016`. Không coi production đã có backup restore-ready cho đến lúc đó.

- [ ] Apply và verify production migrations `0009–0016` sau khi có production
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

- [x] Version staging `8eb11c5e-f7bc-4a2f-a37f-2949a3d03541` upload và promotion 100%, có rollback point `c2d91d94-6737-447d-88b7-991f9808ba3f`.
- [x] Active public staging route matrix sau promotion trả 200; browser console không có error/warning trong lượt kiểm tra.
- [x] Product API và cart revalidation staging trả canonical data/money đúng; cart test quantity `25` có subtotal `1.950.000 ₫`.
- [x] Local release gate trên đúng source pass: admin `136/136`, các suite còn lại `103/103`, `5/5`, `1/1`, `3/3`, `33/33`, `4/4`, `29/29`, lint/typecheck/build exit code `0`.
- [x] Toàn bộ admin JSON writes dùng bounded parser; admin collection reads chính có hard bound `LIMIT 100`; không còn `request.json()` trực tiếp trong `src/app/api/admin`.
- [x] Regression cho giới hạn SQLite/D1 compound SELECT đã pass; migration staging không còn pending.
- [x] Category bulk archive contract đã có test atomic/revision/idempotency và route đã nằm trong staging artifact; không có hard-delete category.
- [x] Product/variant single-row create/update/soft-archive dùng exact envelope, optimistic revision, idempotent replay/conflict và atomic D1 coupling cho tier/meta/audit; focused test và SQLite migration verification pass.
- [x] Deep staging QA sau catalog promotion pass mobile/tablet/desktop: no-overflow, catalog search/sort, cart localStorage và keyboard reachability.
- [x] Preview `/admin/*` bị Access chặn đúng boundary; preview `workers.dev` không được tính là public smoke vì Access bảo vệ cả preview origin.
- [x] Local current-source gate sau operations hardening: admin `158/158`, các suite còn lại giữ xanh, lint/typecheck/build exit code `0`; SQLite migrations `0013–0016` apply thành công.
- [x] Apply migrations `0013–0016`, upload và promote artifact chứa member/lead/media write contract lên staging: version `0d1e14c1-ec4d-47db-b0e2-4275f246f919` ở 100%, rollback point `8eb11c5e-f7bc-4a2f-a37f-2949a3d03541`; post-condition `d1 migrations list` không còn pending.
- [x] Public staging smoke/deep QA sau promotion pass: `/`, `/san-pham`, `/tin-tuc`, `/gui-yeu-cau`, `/thue-gia-cong`; responsive mobile/tablet/desktop, no-overflow, search/sort, cart localStorage và keyboard reachability.
- [x] Version staging hiện tại `a22e9ecb-e1f6-4966-b96b-e2883d138fb1` chứa fix mobile admin import overflow, đã promotion 100%; rollback point là `0d1e14c1-ec4d-47db-b0e2-4275f246f919`.
- [x] Browser read-only với actor staging `public-demo` owner đã kiểm tra 10/10 màn hình admin, audit read-back `20/93` event, product media read-back và console không có error/warning.
- [x] Browser mobile `390×844`: 10/10 route không có page-level horizontal overflow; menu admin mở đúng `aria-expanded=true`.
- [x] Follow-up storefront staging version `ec0522c7-2840-4118-a7fb-0740c5d7c91e` promotion 100%; rollback point `a5534149-5af4-415b-8e2d-947a0a995016`; slider dots visible và click `Nội dung 2` chuyển `sliderIndex=1`, console không có error/warning.
- [x] Follow-up footer settings staging version `cd4a973e-6fde-4538-b66b-04d3fadbb02d` promotion 100%; rollback point `ec0522c7-2840-4118-a7fb-0740c5d7c91e`; footer description/address/copyright đọc đúng từ DOM, không có script và console không có error/warning.
- [x] Public staging smoke sau footer follow-up: `/`, `/san-pham/`, `/tin-tuc/`, `/gui-yeu-cau/`, `/thue-gia-cong/` đều có `main`/`footer`, public không có admin control và console không có error/warning.
- [x] Production read-only audit: `d1 migrations list giacong-vn-catalog --remote` xác nhận pending `0009–0016`; không apply migration, không ghi D1/R2 và không deploy production trong đợt này.
- [x] Production schema read-only audit: `sqlite_master`/`d1_migrations` xác nhận thiếu các bảng control-plane/audit cần cho migration `0009–0016`; query có `changed_db=false`, `rows_written=0`.
- [x] Khóa staging admin bằng Cloudflare Access: commit `41f65eb`, version `11eb20a9-69c8-4dbd-884e-b65aa31d2d93` promote 100%; request không có identity bị chặn, storefront staging vẫn public và 5 route smoke pass.
- [x] Blocked admin screen có nút `Đăng nhập Cloudflare Access`: commit `d6bfb43`, version `a772e2d3-06b6-4046-bf0f-36f6ed5b2329` promote 100%; browser snapshot xác nhận href login chuẩn.
- [x] Login handoff được sửa để reload `/admin` và dùng edge redirect chuẩn (không dùng endpoint 404): commit `4d090b4`, version `0d73b4ce-ef7f-4f52-a3b0-63ecb7e3e90d` promote 100%; probe không identity nhận 302 tới Access.
- [x] Public staging deep QA revalidation 2026-09-01 trên đúng host `staging.kienhieu.id.vn`: 3 viewport × 4 route, catalog search/sort, mobile detail, cart localStorage/read-back và keyboard đều pass; commit `b45dede` loại race condition do chờ cứng 800 ms trong harness.
- [x] Staging admin login UX fallback commit `3c15f0f` đã deploy ở version `8bf8de20-ed58-4637-aac7-ec9b81aeef37`; khi API session bị Access redirect, browser vẫn có nút mở Access và reload tới form đăng nhập; public smoke `/` và `/san-pham` pass.
- [x] Staging Access/owner bootstrap audit read-only 2026-09-01: Access attempt trả `unauthorized`; D1 staging có `0` `admin_members`/`active_owners`, query ghi nhận `changed_db=false`, `rows_written=0`. Chưa tự cấp policy hoặc seed owner.
- [ ] Staging runtime read-back cho member/lead/media audit, R2 compensation/reference guard và retry cùng `requestId`.
- [x] Staging storefront motion/UX runtime revalidation 2026-09-01 sau version `43e186bc-8dff-4812-b9e1-68e10336a4f1`: 5 route public, toàn bộ action pass, 0 console error, 0 HTTP 4xx/5xx, 0 overflow, axe 5/5 không có serious/critical; còn 1 warning Google Maps iframe bên thứ ba.
- [x] Dependency hardening 2026-09-01: commit `8c509c5` nâng Next.js `16.3.4`, OpenNext `1.20.5`, Wrangler `4.125.0`, loại `shadcn` CLI khỏi runtime graph; `npm audit` và `npm audit --omit=dev` đều `0 vulnerabilities`; `npm run check` pass.
- [x] Staging revalidation sau dependency hardening: version `cc144df5-0cd6-4dfa-992a-35ceafbc9778` build/deploy thành công; live `qa:ux` 5/5 route pass, 0 console error, 0 HTTP 4xx/5xx, 0 overflow, axe `5/5` không serious/critical; còn 1 warning Google Maps iframe bên thứ ba.
- [x] Admin Access handoff UX 2026-09-01: commit `650d10f` bỏ hướng dẫn “mở console”, thay bằng hướng dẫn chọn đăng nhập, xác minh và quay lại; regression test và full gate admin `161/161` pass; staging version `be634bc2-569c-41de-8995-db66767fb0e0` deploy thành công.
- [x] Public staging revalidation sau admin UX: `qa:ux` 5/5 route pass, 0 console error, 0 HTTP 4xx/5xx, 0 overflow, axe `5/5` không serious/critical; còn 1 warning Google Maps iframe bên thứ ba. Đây không thay thế admin Access identity.
- [ ] Admin session/audit read-back bằng Access identity thật trên hostname staging.
- [ ] Browser admin desktop/mobile/keyboard/focus/reduced-motion với Access identity thật.
- [ ] Role × route/action read-back trên staging cho owner/content_manager/catalog_manager/sales_manager/viewer.
- [ ] Production data/content thật được chủ dự án duyệt và nhập chủ ý.
- [ ] Restore/rollback drill, observability 24h và quyết định redirect `giacong.vn` được xác nhận.
