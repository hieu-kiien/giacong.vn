# Cloudflare current state — 2026-08-23

Hồ sơ này ghi bằng chứng runtime và implementation đã xác minh trong quá trình chuyển Lean V1 sang Cloudflare-native. Những mục mô tả runtime staging chỉ được đánh dấu đã đạt khi có bằng chứng workflow/runtime tương ứng; code đã merge nhưng chưa quan sát được runtime gate được ghi riêng.

## Hạ tầng đã xác minh

- Production domain: `kienhieu.id.vn`.
- Worker production: `giacong-vn`.
- Worker staging: `giacong-vn-staging`.
- Turnstile helper Worker: `turnstile-siteverify-kienhieu`.
- Staging D1 `GIACONG_VN_CATALOG` → `giacong-vn-catalog-staging` (`981b5d5e-bba9-4f7e-9e1e-a15e379cd095`).
- Staging R2 `GIACONG_VN_PRODUCT_MEDIA` → `giacong-vn-product-media-staging`.
- Staging R2 `NEXT_INC_CACHE_R2_BUCKET` → `giacong-vn-next-cache-staging`.
- Không có Cloudflare Tunnel và kiến trúc đích không cần Tunnel/VPS.
- Bagisto từng được thử nghiệm bằng Docker nhưng không phải production backend.

## Quyền Cloudflare API

Token GitHub Actions đã xác minh có thể đọc zone, DNS, Workers Routes, Cloudflare Access applications/policies và identity providers cần cho audit staging; đồng thời có quyền deploy Worker/triggers trong zone hiện hành. Khi Wrangler áp dụng staging route, token không có scope `All Zones`, nên Wrangler dùng zone-based endpoint cho zone được cấp quyền và deploy thành công.

## DNS, Access và routes hiện tại

- `kienhieu.id.vn` có A record proxied tới `13.67.69.121`; public traffic thực tế được Worker route `kienhieu.id.vn/*` đưa vào `giacong-vn`.
- `admin.kienhieu.id.vn/*` vẫn route vào `giacong-vn` theo trạng thái hạ tầng cũ; production admin chưa được coi là active/accepted surface.
- `admin-staging.kienhieu.id.vn` có DNS proxied.
- Cloudflare Access có một self-hosted application cho chính hostname `admin-staging.kienhieu.id.vn`, có allow policy và identity-provider state đã đọc/audit thành công qua API.
- `admin-staging.kienhieu.id.vn/*` hiện route vào `giacong-vn-staging`.
- Route staging-admin đã được khai báo bền vững trong `wrangler.jsonc` dưới `env.staging.routes`, không chỉ tồn tại như thay đổi thủ công trên Cloudflare.
- Sau khi apply staging route, Workers Routes API xác minh đồng thời:
  - `admin-staging.kienhieu.id.vn/*` → `giacong-vn-staging`;
  - `admin.kienhieu.id.vn/*` → `giacong-vn`.
- Một request không xác thực từ GitHub runner tới `admin-staging.kienhieu.id.vn` bị Cloudflare edge chặn với HTTP 403 challenge page, không nhận nội dung Worker trực tiếp. Đây là bằng chứng fail-closed ở edge cho request thử nghiệm đó; không diễn giải 403 này như bằng chứng riêng rằng Access luôn trả redirect 302.

IP/DNS cũ không được dùng làm commerce backend mới. Workflow thủ công `bagisto-origin-probe-once.yml`, vốn probe origin IP cũ và các API Bagisto-era, đã được xóa khỏi `master` để tránh trở thành đường vận hành nhầm. Một số module Bagisto-era còn nằm trong source/test tree để phục vụ regression hoặc hồ sơ chuyển đổi; sự tồn tại của chúng không biến Bagisto thành runtime canonical.

## D1 catalog audit

Audit read-only qua Wrangler đã thành công trên `giacong-vn-catalog-staging`.

Schema nghiệp vụ ban đầu được audit gồm:

- `categories`
- `products`
- `product_variants`
- `variant_tier_prices`
- `services`

Cộng thêm `d1_migrations`.

Counts tại thời điểm audit:

- categories: 4
- products: 10
- product_variants: 18
- variant_tier_prices: 54
- services: 0

9 sản phẩm đầu là dữ liệu `B2B-DEMO-*`; sản phẩm thứ 10 là dữ liệu test thủ công. Một variant của `nuoc-mam-cot-pha-loang` đang unavailable. Tier price, MOQ, quantity step và contact threshold có đủ dữ liệu để Worker tính canonical request cart.

### Staging data repair đã hoàn thành

Deep QA đầu tiên phát hiện hai contact threshold demo không nằm trên quantity hợp lệ theo MOQ/step, khiến read path nghiêm ngặt trả 503 cho hai product API liên quan:

- `B2B-DEMO-NMC-10`: MOQ 6, step 3, threshold 140;
- `B2B-DEMO-SME-02`: MOQ 12, step 6, threshold 260.

Workflow sửa dữ liệu có guard đã audit chính xác hai row trước khi ghi, sau đó chỉ đổi:

- `B2B-DEMO-NMC-10`: `140 → 141`;
- `B2B-DEMO-SME-02`: `260 → 264`.

Post-condition audit xác minh không còn contact threshold lệch quantity rule trong staging dataset và cả hai product API bị ảnh hưởng đều trở lại HTTP 200 với giá trị mới.

## Migration Cloudflare-native đã merge

Runtime/source boundary hiện hành dùng:

- `/san-pham` → D1
- product detail → D1
- commerce mega-menu → D1
- `/api/catalog/products/[slug]` → D1
- cart revalidation/submit canonical resolver → D1
- `/api/contact` product resolution → cùng Cloudflare D1 catalog reader, không còn Bagisto catalog HTTP hop sau PR #51
- managed service copy → D1 khi có row, fallback static khi table chưa có dữ liệu
- `/media/*` → R2

`next.config.ts` không còn Bagisto proxy rewrites. `.env.example` cũng không còn `BAGISTO_API_URL`, `BAGISTO_PROXY_ORIGIN` hay `BAGISTO_API_TIMEOUT_MS`. PR #51 thêm source regression để contact route và shared cart resolver không được import Bagisto trở lại; Quality, GitNexus và Cloudflare package gates đều xanh trước merge.

## Staging preview đã đạt

OpenNext version `173773bb-ed45-412f-aef4-d9ec78f3a8cd` được upload trước mà không nhận traffic, sau đó smoke test qua versioned preview URL đạt:

- `/` → HTTP 200
- `/san-pham` → HTTP 200 và render dữ liệu D1
- `/san-pham/bot-gao-lut-xay-min` → HTTP 200
- `/gui-yeu-cau` → HTTP 200
- `/thue-gia-cong` → HTTP 200
- `/thue-gia-cong/say-thuc-pham-say` → HTTP 200
- `/api/catalog/products/bot-gao-lut-xay-min` trả đúng 3 variants, VND và starting price `78.000`
- cart revalidation cho `B2B-DEMO-BGL-05`, quantity `25` trả submittable, unit price `78.000` và subtotal `1.950.000`
- R2 media `/media/products/c5be4fe1-3daa-40ad-b9df-54717ec5c863.jpg` → HTTP 200, object size `1.979.346` bytes

Preview cũng xác minh version mới giữ các bindings cũ cần thiết: `ADMIN_HOSTNAME`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SITEVERIFY_URL`, D1 catalog và hai R2 buckets.

## Staging promotion đã hoàn thành

Version `173773bb-ed45-412f-aef4-d9ec78f3a8cd` đã được promotion có kiểm soát lên **100% traffic của `giacong-vn-staging`**.

Promotion workflow có rollback tự động về version cũ `b4693784-d4c4-4659-83ca-1e13b02a6177` nếu active smoke test thất bại. Rollback không bị kích hoạt vì active staging smoke test đạt:

- homepage/catalog/detail/request-cart/service pages đều HTTP 200;
- D1 product API trả canonical data;
- D1 cart revalidation tính canonical money đúng;
- R2 product media trả HTTP 200 và dữ liệu thực;
- deployment status cuối xác minh version mới phục vụ 100% staging traffic.

## Deep staging QA đã đạt cho commerce baseline

Sau data repair, workflow `Cloudflare staging deep QA` chạy lại trên active staging và **toàn bộ step commerce baseline đều xanh**.

Đã xác minh:

- active deployment vẫn đúng version `173773bb-ed45-412f-aef4-d9ec78f3a8cd` ở 100%;
- catalog search hoạt động với truy vấn tiếng Việt;
- category filter không leak sản phẩm danh mục khác;
- sort `starting_price desc` trả thứ tự render phù hợp dữ liệu D1;
- product API `nuoc-mam-cot-pha-loang` và `sot-me-chua-ngot` đọc được threshold đã sửa;
- missing product API trả 404;
- cart matrix đạt: valid tier, below MOQ, off-step, unavailable variant, missing product, missing variant và price-on-request;
- contact cart drift guard trả 409 với canonical cart mới và không submit upstream; malformed JSON trả 400;
- R2 media trả ảnh thật, content type hợp lệ và object không rỗng;
- Chromium responsive QA đạt trên mobile `390×844`, tablet `768×1024`, desktop `1440×900` cho homepage, catalog, product detail, request cart và service detail;
- không phát hiện horizontal overflow hoặc browser page/console error trong bộ route QA.

Sau khi staging-admin route được thêm vào Wrangler và merge, deep QA trên `master` lại chạy **success toàn bộ** cho bộ check lúc đó, gồm responsive browser check. Quality gate và Cloudflare staging build/package gate của cùng master commit cũng xanh; staging Worker version phục vụ storefront không bị thay đổi bởi bước khai báo trigger.

Deep QA workflow tự chạy sau staging deployment thành công trên `master`; vẫn có `workflow_dispatch` để chạy lại sau data-only mutation.

## Cloudflare-native Admin đã triển khai trong source `master`

Phần admin không còn ở trạng thái “chuẩn bị implement”. Source `master` hiện đã có các lớp bảo vệ và bề mặt vận hành chính:

- Cloudflare Access/admission + shared `requireAdmin` guard;
- membership/role checks và same-origin mutation boundary theo contract hiện hành;
- D1 audit logs cho business mutations;
- optimistic concurrency/revision guards cho các write path đã chuyển đổi;
- Admin UI cho sản phẩm và dữ liệu catalog liên quan;
- Admin UI cho dịch vụ gia công;
- Admin request/lead operations theo implementation hiện hành;
- site settings/content operations;
- R2 media lifecycle cho product/service/site media theo contract riêng;
- News article/category operations và article-owned News media upload/select/delete lifecycle.

Các PR triển khai Admin/News gần nhất đều qua Quality gate, GitNexus safety gate khi workflow áp dụng, và Cloudflare package gate trước merge. Đây là bằng chứng build/contract của source; không tự động đồng nghĩa mọi thao tác Admin mới đã được operator thực hiện end-to-end trên staging account thật.

## Durable request intake hiện là D1-first

Source hiện hành không còn mô hình “chỉ gửi Google Sheet rồi mới coi là tiếp nhận”. Luồng contact đã có durable persistence trước secondary delivery:

- request/cart được server validate và canonicalize trước;
- `lead`, `lead_items` và initial `lead_event` được ghi D1 bằng batch transactional semantics;
- `request_id` có uniqueness/idempotent replay guard, kể cả concurrent winner race;
- khi `GIACONG_VN_LEAD_QUEUE` có binding, Worker enqueue payload sau khi durable lead đã tồn tại và ghi delivery state `queued`;
- queue consumer giao payload tới Google Apps Script/Sheet rồi cập nhật `delivered` hoặc `failed`;
- khi queue không sẵn sàng, code còn synchronous delivery fallback nhưng vẫn chỉ chạy sau D1 persistence;
- lỗi enqueue hoặc secondary sink không xóa lead; response vẫn có public D1 reference và Admin có thể nhìn thấy delivery failure để xử lý;
- `/admin/yeu-cau` là operational inbox trên durable D1 lead data.

Vì vậy Google Sheet/Apps Script hiện được xem là **secondary operational sink**, không phải canonical request database duy nhất. Production acceptance vẫn phải xác minh account/deployment Google thật nếu sink này tiếp tục được vận hành, đồng thời cần xác minh Cloudflare Queue binding/consumer trên production trước khi dựa vào async delivery.

## News CMS đã merge

News hiện là D1-backed CMS thay vì captured/static fallback.

### Public read contract

- `/tin-tuc` đọc canonical `articles` + `article_categories` từ D1;
- `/tin-tuc/[slug]` chỉ trả bài không archived, `status = 'published'`, có `published_at` và `published_at <= CURRENT_TIMESTAMP`;
- archive hỗ trợ tìm kiếm, category filter và pagination;
- article detail render body V1 dưới dạng plain text an toàn;
- related articles dùng cùng public visibility rule;
- bài scheduled tương lai và bài archived không được public detail leak;
- Admin chỉ hiện link `Xem` khi bài thực sự đã đến giờ public.

### Admin article contract

- `/admin/tin-tuc` dùng `/api/admin/news` và `/api/admin/news/[id]`;
- article create đi qua draft-first flow;
- editor quản lý title, slug, category, excerpt, body plain text, thumbnail URL, featured, SEO metadata và publish schedule;
- PATCH/DELETE yêu cầu revision hiện tại;
- stale write trả `STALE_WRITE` và UI có action tải bản mới nhất;
- delete article là soft archive, không hard-delete lịch sử;
- owner/content_manager được mutate; viewer vẫn read-only ở UI và server guard là boundary quyết định.

### Admin category contract

- `/admin/chuyen-muc-tin-tuc` dùng `/api/admin/news/categories` và `/api/admin/news/categories/[id]`;
- category có name, slug, description, sort order, active và revision;
- migration `0008_news_category_revision.sql` thêm optimistic revision cho taxonomy;
- category create/update/delete được audit trong D1 batch;
- category delete bị chặn nếu còn article tham chiếu; operator được hướng dẫn tạm ẩn thay vì xóa khi cần giữ taxonomy history;
- race giữa pre-check và delete batch vẫn fail closed và được phân loại lại thành in-use khi article vừa được gắn vào category.

Pipeline staging chuẩn đã có thứ tự: apply pending D1 migrations bằng Wrangler remote trước, sau đó mới deploy OpenNext Worker staging. Vì vậy source đọc schema mới không được deploy trước migration tương ứng trong pipeline chuẩn.

### News article media contract đã merge trong source

News media không còn là URL-only placeholder. Source `master` hiện có lifecycle riêng, không phá CHECK/reference semantics của `media_assets` product/service:

- migration `0009_news_media_assets.sql` tạo `news_media_assets` article-owned;
- storage key News dùng namespace `news/articles/{articleId}/...` trong R2 hiện hành;
- `/api/admin/news/[id]/media` list/upload asset thuộc đúng article; upload ghi R2 rồi metadata/audit theo contract và có compensation nếu D1 batch fail;
- Admin editor list/upload/select asset và chỉ ghi `thumbnail_url` khi operator bấm lưu article, không tự PATCH article từ media component;
- migration `0010_news_media_reference_guard.sql` thêm trigger chặn internal News thumbnail URL nếu asset không active, đã deleted hoặc thuộc article khác; article mới không được trỏ internal News media trước khi có stable article ID;
- `DELETE /api/admin/news/[id]/media/[assetId]` chỉ cho owner/content_manager, chặn asset còn là thumbnail bằng `MEDIA_IN_USE`, ghi audit + D1 tombstone và phải xác nhận tombstone trước khi R2 bị xóa;
- stale/deleted/wrong-article internal thumbnail write được phân loại `MEDIA_REFERENCE_CONFLICT` thay vì ghi state không hợp lệ;
- nếu R2 cleanup fail sau tombstone, D1 vẫn giữ logical delete và response cho phép xử lý cleanup sau; không resurrect asset;
- Admin media library có nút xóa dùng đúng server contract, disable asset đang được chọn trong form và vẫn để server persisted state là boundary quyết định.

PR #55, #56 và #57 cho các lớp UI/upload, reference-safe delete và delete UI đều qua Quality, GitNexus và Cloudflare package gate trước merge. Đây là bằng chứng source/build, chưa tự động là bằng chứng operator đã thực hiện upload/select/delete end-to-end trên staging account thật.

### News staging regression gate

Workflow `Cloudflare staging deep QA` gọi `scripts/staging-news-qa.mjs` sau deployment staging thành công. Suite read-only hiện kiểm tra:

- D1 schema có `article_categories.revision`, `article_categories.sort_order`, `articles.revision`, `articles.archived_at`;
- D1 có `news_media_assets.article_id` và `news_media_assets.storage_key`;
- `sqlite_master` có hai trigger `trg_articles_news_media_thumbnail_insert` và `trg_articles_news_media_thumbnail_update`;
- audit hiện trạng yêu cầu số internal `/media/news/articles/...` thumbnail reference không có active asset tương ứng bằng 0;
- `/tin-tuc` render thành công hoặc hiển thị empty state hợp lệ;
- nếu có public article, detail và category filter phải render đúng canonical article;
- missing article phải 404;
- nếu staging có scheduled-future hoặc archived article, các slug đó phải 404;
- mobile `390×844` và desktop `1440×900` không horizontal overflow và không có browser page/console error.

**Trạng thái bằng chứng tại lần cập nhật hồ sơ này:** source regression gate, migrations, media server contract và Admin UI đã merge; PR gates đã xanh. Chưa ghi “News deep staging QA/media operator acceptance đã đạt” cho các thay đổi mới này cho tới khi có bằng chứng quan sát được từ run/deployed staging và thao tác account thật tương ứng.

## Acceptance, security và recovery source gates đã merge

Sau khi News lifecycle được đưa vào `master`, các lớp production-readiness sau đã được bổ sung ở source/CI:

- PR #65 thêm baseline response headers và staging security-header acceptance; CSP chưa được coi là đã chốt trong slice này.
- PR #66 thêm staging semantic/keyboard accessibility acceptance trên Playwright.
- PR #67 thêm production dependency SCA gate fail-closed. Bốn finding runtime hiện chưa thể remediated an toàn được bind chính xác theo advisory/package/node/version và có expiry `2026-09-15`; workflow cuối của PR đã qua production audit, full Quality, GitNexus, OpenNext staging build và Wrangler dry-run/package gate.
- PR #68 đã thay thế hướng dẫn recovery cũ bằng Cloudflare recovery/production runbook hiện hành, gồm Worker rollback, D1 export/Time Travel restore, R2 reconciliation, Queue/DLQ/idempotency và production NO-GO/rollback triggers. Đây là tài liệu/quy trình đã merge, **không phải bằng chứng staging restore drill đã được thực hiện**.
- PR #69 thêm staging synthetic performance anti-regression gate bằng Playwright với LCP/CLS/TTFB/DOMContentLoaded budgets trong điều kiện mobile-like CPU/network throttling. Gate này dùng để bắt severe regression; **không phải field p75 Core Web Vitals certification**.
- PR #71 thêm `docs/PRODUCTION_READINESS_MAP.md` và issue #70 làm execution map G0–G8 cho phần việc còn lại. Source/build evidence và runtime/operator acceptance vẫn được giữ tách biệt.

## Latest accepted staging chain — 2026-08-22

The latest authoritative master chain is accepted through G3:

- source master SHA: `4651e94d88a36dff700df832a3bcde73c5770576`;
- G1 deployment run `32573099984` promoted Worker version `200b9734-6bef-4161-b189-84aa5f738724` to 100% staging traffic;
- matching G1 deep-QA run `32573384328` passed edge protection, baseline security headers, accessibility, performance, commerce, responsive browser and News regression checks;
- G2 News media operator acceptance run `32573791603` passed protected upload/select/save/render/reference-safe delete and D1/R2 post-conditions;
- G3 durable request-delivery acceptance run `32573995446` passed real Queue enqueue/consumer delivery, D1 inbox visibility, invalid-input rejection and idempotent replay.

Issue #70 retains the detailed run breadcrumbs, identifiers and timestamps. These are staging-only acceptance runs; no production resource was mutated.

Vì vậy các việc “viết recovery/rollback procedure” và “thêm performance lab guard” không còn là future implementation work. Việc còn lại là quan sát master staging evidence, thực hiện operator/runtime acceptance, recovery drill thật và chuẩn bị production data/resources có chủ ý.

## Governance Cloudflare-native

Nguồn quyết định là `docs/CLOUDFLARE_NATIVE_V1_PLAN.md`. `COMMERCE_PLATFORM_MASTER_PLAN.md` được giữ làm hồ sơ lịch sử Bagisto-era, không còn quyết định runtime/admin đích.

Plan khóa các nguyên tắc:

- D1/R2 là canonical data/media;
- Bagisto không quay lại runtime;
- Cloudflare-native admin phải nằm sau auth/admission boundary và server write contract;
- durable request intake là D1-first; Cloudflare Queue/Google Sheet là delivery/secondary-sink layer theo cấu hình hiện hành;
- staging là cổng bắt buộc;
- production không được dùng làm môi trường thử nghiệm.

Admin server contract chi tiết nằm tại `docs/CLOUDFLARE_ADMIN_WRITE_CONTRACT.md`: hostname/Access admission, exact write shapes, stale-write protection, MOQ/step/contact/tier invariants, media policy, request id/idempotency, auditability và required regression matrix.

**Production Worker `giacong-vn`, production data resources và production route `kienhieu.id.vn/*` chưa bị thay đổi bởi các bước Admin/News/contact staging work được ghi trong hồ sơ này.**

## Cổng kế tiếp

Execution map hiện hành nằm tại `docs/PRODUCTION_READINESS_MAP.md` và được theo dõi ở issue #70. Application/runtime migration, commerce deep QA, staging-admin boundary và phần lớn Admin CRUD source đã đi qua giai đoạn foundation. Các bước còn lại được thực hiện theo thứ tự evidence-first sau:

1. Hoàn tất security acceptance còn thiếu bằng cách audit source/script/style/Turnstile thực tế và chốt CSP hoặc một deferment hẹp, có bằng chứng và review trigger; sau đó chạy lại security acceptance.
2. Thực hiện staging recovery drill theo runbook đã merge: tách Worker rollback khỏi D1 restore semantics, kiểm tra R2 reconciliation và Queue/DLQ/idempotency, rồi lưu operator evidence/timing.
3. Chốt production taxonomy, SKU, variants, prices, MOQ/step/thresholds, media, site/News content và contact/trust claims; loại toàn bộ demo/test content khỏi production migration dataset và tạo manifest đã duyệt.
4. Tạo/audit production D1/R2/Queue cần thiết có chủ ý, rehearsal migration trên dataset đã duyệt, xác minh backup/export, rollback triggers và production smoke checklist.
5. Chỉ khi các gate trước đều xanh bằng evidence mới upload/version và promotion `giacong-vn` production; production không được dùng làm môi trường thử nghiệm.
