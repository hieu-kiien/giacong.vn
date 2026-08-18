# Cloudflare current state — 2026-08-18

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

Runtime active staging dùng:

- `/san-pham` → D1
- product detail → D1
- commerce mega-menu → D1
- `/api/catalog/products/[slug]` → D1
- cart revalidation/submit canonical resolver → D1
- managed service copy → D1 khi có row, fallback static khi table chưa có dữ liệu
- `/media/*` → R2

`next.config.ts` không còn Bagisto proxy rewrites. `.env.example` cũng không còn `BAGISTO_API_URL`, `BAGISTO_PROXY_ORIGIN` hay `BAGISTO_API_TIMEOUT_MS`.

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
- News article operations và News category operations.

Các PR triển khai Admin/News gần nhất đều qua Quality gate, GitNexus safety gate khi workflow áp dụng, và Cloudflare package gate trước merge. Đây là bằng chứng build/contract của source; không tự động đồng nghĩa mọi thao tác Admin mới đã được operator thực hiện end-to-end trên staging account thật.

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

Pipeline staging chuẩn đã có thứ tự: apply pending D1 migrations bằng Wrangler remote trước, sau đó mới deploy OpenNext Worker staging. Vì vậy source đọc `article_categories.revision` không được deploy trước migration `0008` trong pipeline chuẩn.

### News staging regression gate

Workflow `Cloudflare staging deep QA` đã được mở rộng để gọi `scripts/staging-news-qa.mjs` sau deployment staging thành công. Suite mới là read-only và kiểm tra:

- D1 schema có `article_categories.revision`, `article_categories.sort_order`, `articles.revision`, `articles.archived_at`;
- `/tin-tuc` render thành công hoặc hiển thị empty state hợp lệ;
- nếu có public article, detail và category filter phải render đúng canonical article;
- missing article phải 404;
- nếu staging có scheduled-future hoặc archived article, các slug đó phải 404;
- mobile `390×844` và desktop `1440×900` không horizontal overflow và không có browser page/console error.

**Trạng thái bằng chứng tại lần cập nhật hồ sơ này:** source regression gate và workflow wiring đã merge; PR Quality/GitNexus/package gates đã xanh. Chưa ghi “News deep staging QA đã đạt” trong hồ sơ này cho tới khi có bằng chứng quan sát được từ run `master` sau deployment.

## Media và phạm vi News image hiện tại

News article hiện lưu `thumbnail_url`, nhưng Admin editor vẫn nhận URL/path thay vì upload trực tiếp.

R2 `media_assets` hiện khóa schema vào namespace `product`, `variant`, `service`; CHECK constraint và lifecycle/reference contract không có `news/article`. Vì vậy không mở rộng upload News bằng cách chỉ đổi UI hoặc tái sử dụng endpoint product/service. Một implementation đúng cần quyết định schema/reference lifecycle cho News media trước, có migration + safe deletion contract riêng.

## Governance Cloudflare-native

Nguồn quyết định là `docs/CLOUDFLARE_NATIVE_V1_PLAN.md`. `COMMERCE_PLATFORM_MASTER_PLAN.md` được giữ làm hồ sơ lịch sử Bagisto-era, không còn quyết định runtime/admin đích.

Plan khóa các nguyên tắc:

- D1/R2 là canonical data/media;
- Bagisto không quay lại runtime;
- Cloudflare-native admin phải nằm sau auth/admission boundary và server write contract;
- request queue vẫn là Google Sheet + Apps Script cho đến quyết định riêng;
- staging là cổng bắt buộc;
- production không được dùng làm môi trường thử nghiệm.

Admin server contract chi tiết nằm tại `docs/CLOUDFLARE_ADMIN_WRITE_CONTRACT.md`: hostname/Access admission, exact write shapes, stale-write protection, MOQ/step/contact/tier invariants, media policy, request id/idempotency, auditability và required regression matrix.

**Production Worker `giacong-vn`, production data resources và production route `kienhieu.id.vn/*` chưa bị thay đổi bởi các bước Admin/News staging work được ghi trong hồ sơ này.**

## Cổng kế tiếp

Application/runtime migration, commerce deep QA, staging-admin boundary và phần lớn Admin CRUD source đã đi qua giai đoạn foundation. Các bước ưu tiên tiếp theo là:

1. Quan sát và lưu bằng chứng run `master` của staging deployment + News deep QA mới; chỉ sau đó mới đánh dấu News runtime acceptance xanh.
2. Xác minh Google Sheet/Apps Script request intake trên account thật: ownership, deployment/authorization, idempotency, schema, protection, workflow trạng thái và timeout/redirect allowlist; hoặc ra quyết định riêng nếu chuyển queue sang D1.
3. Chốt production taxonomy, SKU, variants, prices, MOQ, media, content, News content và contact/trust claims; loại toàn bộ demo/test content khỏi production dataset.
4. Quyết định media lifecycle cho News nếu cần upload thumbnail trực tiếp; không tái dùng `media_assets` product/service bằng cách phá CHECK/reference semantics hiện tại.
5. Tạo/audit production D1/R2 có chủ ý và chuẩn bị migration dataset đã duyệt; không copy demo staging ngầm định.
6. Ghi rõ backup/export, rollback procedure và production smoke checklist.
7. Chỉ sau acceptance admin + production data/content + request intake mới upload/promotion `giacong-vn` production.
