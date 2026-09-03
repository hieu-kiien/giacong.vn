# Production acceptance checklist

Trạng thái chốt hạ trước promotion `giacong-vn` production. Nguồn yêu cầu gốc: [CLOUDFLARE_NATIVE_V1_PLAN.md](CLOUDFLARE_NATIVE_V1_PLAN.md) mục 7–8. Cập nhật 2026-09-02 sau owner/RBAC hardening, staging revalidation và publish-renderer verification.

> Lưu ý trạng thái: các checkbox dưới đây giữ evidence lịch sử của đợt nghiệm thu
> trước. Chúng không tự đóng các acceptance mới trong `ADMIN_VISUAL_ROADMAP.md`.
> Follow-up staging mới nhất được ghi ở mục 9 bên dưới; các mốc cũ trong mục 8
> không được dùng để suy ra trạng thái runtime hiện tại.

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
> và đợt seed đã được ghi nhận. Read-only audit ngày 2026-08-31 (bằng chứng
> lịch sử) cho thấy production khi đó còn `0009–0016` chưa apply; không tự thay đổi production khi
> các gate dữ liệu thật, Access role matrix và restore/rollback drill còn mở.

> Revalidation hiện tại: artifact `.runtime/production-d1-backup-20260825.sql` đã
> được kiểm tra checksum và restore-drill cục bộ đạt `integrity_check=ok`. Export
> mới ngày 2026-09-02 được ghi ở mục 10; cả hai chỉ là bằng chứng chuẩn bị và
> phải re-export lại ngay trước cửa sổ migration nếu dữ liệu production thay đổi.

- [x] Export production D1 mới ngày 2026-09-02 tại
  `.runtime/production-d1-backup-20260902-pre-release.sql`, SHA-256
  `583BE2FBFFC2C6D8F0C77E7D97C3786E838EDBFD228E024AD7A8F078A147ABFD`; local
  restore-drill đạt `integrity_check=ok` (19 bảng, 13 migration, 9 product,
  17 variant, 0 lead).
- [ ] Apply và verify production migrations `0009–0019` sau khi có production
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

## 8. Staging admin follow-up — BẰNG CHỨNG LỊCH SỬ QUA 2026-08-31

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
- [x] Production read-only audit ngày 2026-08-31 (lịch sử): `d1 migrations list giacong-vn-catalog --remote` xác nhận pending `0009–0016`; không apply migration, không ghi D1/R2 và không deploy production trong đợt đó.
- [x] Production schema read-only audit ngày 2026-08-31 (lịch sử): `sqlite_master`/`d1_migrations` xác nhận thiếu các bảng control-plane/audit cần cho migration `0009–0016`; query có `changed_db=false`, `rows_written=0`.
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
- [x] Admin plain-language states 2026-09-01: commit `bbcbfba` đổi các trạng thái lỗi/sẵn sàng/footer dùng chung sang câu chữ cho người không chuyên; `admin-ui-system` đạt `162/162`, logic API/quyền/schema không đổi; staging version `ecda5cee-8791-4290-8505-56acbd5f4d5f` build/deploy thành công.
- [x] Public staging revalidation sau admin plain-language states: `qa:ux` 5/5 route pass, 0 console error, 0 HTTP 4xx/5xx, 0 overflow, axe `5/5` không serious/critical; evidence `C:\Users\hieuk\Desktop\staging-ux-audit-2026-09-01-admin-copy`; còn 1 warning Google Maps iframe bên thứ ba.
- [x] Access boundary revalidation 2026-09-01: probe không identity trên `22/22` admin page/API paths của staging đều trả HTTP `302`; production public trả `200`, production admin trả `302`; không có payload admin hoặc mutation. D1 production read-only probe tạm thời trả Cloudflare API errors `7500` (query) và `10000` (database info/auth), chưa dùng làm bằng chứng migration state.
- [ ] Admin session/audit read-back bằng Access identity thật trên hostname staging.
- [ ] Browser admin desktop/mobile/keyboard/focus/reduced-motion với Access identity thật.
- [ ] Role × route/action read-back trên staging cho owner/content_manager/catalog_manager/sales_manager/viewer.
- [ ] Production data/content thật được chủ dự án duyệt và nhập chủ ý.
- [ ] Restore/rollback drill, observability 24h và quyết định redirect `giacong.vn` được xác nhận.

## 9. Staging owner/RBAC revalidation — ĐÃ XÁC MINH KỸ THUẬT, CHƯA ĐÓNG PRODUCTION GATE (2026-09-02)

- [x] Commit `d14d4e4` đã chốt `qtu1053@gmail.com` là `owner` cấp cao nhất trên
  staging; owner có toàn bộ capability, được tạo tài khoản admin, cấp/sửa
  role và active state. Server-side guard vẫn là nguồn quyết định; owner không
  thể tự hạ quyền/vô hiệu hóa, role khác không thể sửa control plane.
- [x] Browser Chrome với Access identity thật: `/admin/thanh-vien` hiển thị
  đúng tài khoản hiện tại, nhãn `Chủ sở hữu (toàn quyền)`, năm role options và
  nút `Thêm tài khoản quản trị`; form tạo mở thành công. Không ghi thêm member
  trong lượt này vì chưa có chủ ý về identity/role cụ thể.
- [x] Owner navigation/audit read-only acceptance: `/admin/dieu-huong` hiển
  thị quyền chỉnh sửa, tạo mục và publish hàng loạt sau khi session tải xong;
  `/admin/audit` hiển thị trang owner-only với 93 sự kiện.
- [x] Version staging `379d20d7-44d2-40ee-a603-2890ba7515fb` đã upload và
  promote 100%; rollback point là `278030a5-c21b-423f-b443-7f2ad4834b76`;
  public smoke 5 route đạt HTTP `200`.
- [x] `qa:ux` sau deploy pass 5/5 route, action pass, 0 console error, 0 HTTP
  4xx/5xx, 0 overflow, axe không có serious/critical violation; warning còn lại
  là `postMessage` từ Google Maps iframe bên thứ ba.
- [x] Local release gate đạt focused admin UI `12/12`, full admin `179/179`,
  các suite khác, lint, typecheck và build đều exit `0`.
- [x] UI đang tải quyền được hiển thị `Đang kiểm tra quyền…`, không kết luận
  nhầm owner là `Chỉ xem`; sau khi tải xong Chrome xác nhận lại `Có quyền chỉnh
  sửa`, `Thêm mục` và `Phát hành tất cả`.
- [x] Commit `d63c7ec` giữ request ID và payload item/revision qua retry network/5xx
  cho News/Services/CMS bulk actions, khóa nhấn đúp và reset marker an toàn ở
  success/4xx; focused contract `18/18`. Public UX audit đúng host staging pass
  5/5 route, 0 console error, 0 HTTP 4xx/5xx, axe 5/5 không có serious/critical.
- [ ] Role × route/action read-back với nhiều Access identity thật.
- [ ] Write/read-back từng domain và audit consistency trên staging.
- [ ] Production data/content approval, backup/restore drill, observability
  24h và quyết định promotion production.

## 10. Latest staging revalidation — 2026-09-02

- [x] Migration `0019_admin_site_page_write_contract.sql` đã apply/verify trên
  D1 staging; schema có `site_pages.last_request_id` và
  `admin_site_page_audit`; production không bị thay đổi.
- [x] Version staging `14a6e3c9-7a4f-46a2-b8a0-c6eaf827647c` đang ở 100%;
  `379d20d7-44d2-40ee-a603-2890ba7515fb` là rollback point ngay trước đó.
- [x] Active smoke 7/7 public route HTTP 200; product/cart/R2 invariants pass:
  variant khả dụng `3`, SKU `B2B-DEMO-BGL-05`, giá `78000`, cart subtotal
  `1950000` với quantity `25`, media HTTP 200.
- [x] Owner Chrome revalidation: `qtu1053@gmail.com` hiển thị là
  `Chủ sở hữu (toàn quyền)`, mở được form thêm admin; trang sản phẩm hiển thị
  xử lý hàng loạt `Ẩn đã chọn`. Không tạo admin mới hoặc mutation dữ liệu trong
  lượt này.
- [x] Release smoke workflows được sửa ở commit `fa3bdc6` để khóa invariant
  nghiệp vụ thay vì tổng variant cứng; `git diff --check` và GitNexus
  `detect_changes` pass, risk thấp.
- [x] Read-only production migration re-audit ngày 2026-09-02 xác nhận pending
  chính xác `0009–0019`; không apply migration, không ghi D1/R2 và không deploy.
- [x] Snapshot `.runtime/production-d1-backup-20260825.sql` đã được checksum
  SHA-256 `E2D56E4CCD7DBDA38FFA25CC22471AE786FE4A0A47E78EAD82A5108F7CC974E8`
  và restore-drill cục bộ đạt `PRAGMA integrity_check = ok` (16 bảng, 10
  migration, 9 product, 17 variant). Snapshot này chưa thay thế export mới
  ngay trước migration production.
- [x] Export/restore-drill mới 2026-09-02 đã hoàn tất: `.runtime/production-d1-backup-20260902-pre-release.sql`, SHA-256
  `583BE2FBFFC2C6D8F0C77E7D97C3786E838EDBFD228E024AD7A8F078A147ABFD`,
  `integrity_check=ok` (19 bảng, 13 migration, 9 product, 17 variant, 0 lead).
- [x] Staging release `d1d270a8-52d5-4a8b-a988-daa21e8fdfa3` đã promote 100%
  sau commit `8652130`; owner dashboard đọc đúng draft metric (`0`) và lead QA
  đã có status write/read-back cùng audit revision `1 → 2`, `2 → 3`.
- [x] Owner Chrome đã đi qua đủ 10 route admin canonical; `qa-deep-staging.mjs`
  pass public mobile/tablet/desktop, catalog/detail/cart và keyboard checks.
- [x] Owner staging kiểm tra CMS draft isolation trên `brand_tagline`: draft QA
  không rò ra public, giá trị ban đầu được khôi phục và UI trở lại
  `Published/Đã đồng bộ`; publish-renderer proof hiện được ghi ngay bên dưới.
- [x] Owner staging kiểm tra navigation draft isolation trên item `Home`: nhãn
  QA không rò ra public, nhãn ban đầu được khôi phục và item trở lại
  `Published`; chưa coi đây là publish-all đầy đủ.
- [x] Owner staging kiểm tra news create/read/delete: bài nháp QA không rò ra
  `/tin-tuc` public, sau đó được xóa qua confirm dialog và danh sách trở lại
  `0 bài viết`; chưa coi đây là publish/media acceptance đầy đủ.
- [x] `/admin/audit` đọc lại `139 sự kiện` sau các round-trip CMS/navigation/news;
  event có actor, action, revision và request ID; chưa coi đây là full-domain
  consistency audit.
- [x] Navigation single-item publish runtime proof 2026-09-02: owner staging đổi
  `Home → Home [QA]`, lưu draft, phát hành đúng mục, public hard reload đọc đúng
  nhãn QA; sau đó khôi phục `Home`, phát hành lại và public đọc đúng nhãn gốc.
  D1 cuối cùng có `draft_label = published_label = Home`, `dirty = 0`, version `7`;
  audit ghi đủ các cặp draft/publish với request ID. Staging version chứa fix
  homepage fallback là `26884d0b-0092-43cd-bad2-df077de605eb`, rollback point là
  `1ff986f1-49ba-4a33-97d0-a6dfeb9e9d09`.
- [x] Owner staging media runtime proof 2026-09-02 trên asset QA đang tham chiếu
  tới sản phẩm `#12`: sửa alt text → đọc lại đúng → khôi phục đúng giá trị gốc;
  thử xóa qua confirm dialog bị server chặn với `MEDIA_IN_USE`, asset vẫn còn.
  Chưa coi đây là fresh upload R2 hoặc full-domain media acceptance.
- [x] Owner staging service write/read-back proof 2026-09-02 trên service QA: sửa
  summary → đọc lại đúng ở bảng → khôi phục `QA`; không đổi trạng thái archived,
  slug hoặc nội dung production.
- [x] Owner staging CMS publish-renderer proof 2026-09-02: `brand_tagline` được
  lưu draft QA → phát hành → public storefront đọc đúng text qua
  `data-site-setting="brand_tagline"` và hiển thị thực; sau đó restore/publish
  giá trị gốc. Commit `ca14e5f`, staging version
  `c860a002-afcc-4c41-a329-b0390799d9bc`, rollback point
  `26884d0b-0092-43cd-bad2-df077de605eb`; audit cuối `123` sự kiện, revision
  tagline `7 → 8 → 9 → 10 → 11` (audit tại thời điểm đó `123` sự kiện).
- [x] Owner staging Hero CTA publish-renderer proof 2026-09-02: bốn trường
  `hero_primary/secondary_cta_label/url` đều được lưu draft → phát hành → public
  storefront đọc đúng text, href và visibility; sau đó restore/publish về giá
  trị gốc. Commit `173239e`, staging version
  `0d4d66f9-2b6e-42d1-a8e2-58bda74f98f0`, rollback point
  `c860a002-afcc-4c41-a329-b0390799d9bc`; audit cuối `139` sự kiện.
- [x] Homepage content renderer proof 2026-09-02: commit `732eba5` nối
  `hero_description`, `about_title`, `about_description` qua adapter homepage-
  only; Chrome public staging sau deploy đọc đúng hero/about published, CTA,
  navigation và gallery. Version `81b2e573-dea9-4e6a-b7ce-9cddb9b5fc70` ở
  100%, rollback point `0d4d66f9-2b6e-42d1-a8e2-58bda74f98f0`; không có D1/R2
  mutation trong probe.
- [x] Full local release gate sau thay đổi renderer: admin `190/190`, contact
  `104/104`, catalog `5/5`, purchase UI `1/1`, service `3/3`, commerce `67/67`,
  listing `4/4`, detail `29/29`, lint, typecheck và build đều exit `0`; deep QA
  staging sau deploy pass mobile/tablet/desktop.
- [ ] Role × route/action với nhiều Access identity, write/read-back từng domain,
  production data approval, backup/restore, observability 24h và production
  promotion vẫn chưa đạt.

## 11. Revalidation sau hardening — 2026-09-02

- [x] Commit `e1936cfb` khóa race publish news đơn/bulk, guard color picker
  read-only, confirm xóa section, dashboard query budget và mobile visual
  editor/focus behavior.
- [x] Staging `eff0d7fa-c5e2-4641-911b-b3b324ac0284` deploy 100%, rollback point
  `a709e5a4-c457-43ab-9d77-2d5d20ac0b7b`; không có production mutation.
- [x] `npm run check` exit `0`: admin `198/198`, contact `104/104`, catalog
  `5/5`, purchase UI `1/1`, service `3/3`, commerce `68/68`, listing `4/4`,
  detail `29/29`, lint, typecheck và build.
- [x] Deep QA responsive và Chrome owner smoke test direct editor → Escape →
  focus restore pass; không có console error/warning.
- [x] Fresh production D1 export và restore-drill đã pass: artifact
  `.runtime/production-d1-backup-20260902-pre-release.sql`, SHA-256
  `583BE2FBFFC2C6D8F0C77E7D97C3786E838EDBFD228E024AD7A8F078A147ABFD`,
  SQLite `integrity_check=ok`, foreign-key violations `0`.
- [ ] Production gate còn mở: 11 migration `0009–0019`, role × route/action với
  nhiều Access identity, full write/read-back/audit, data approval,
  migration/rollback window và observability 24 giờ.
