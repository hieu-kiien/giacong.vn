# Cloudflare current state — 2026-08-14

Hồ sơ này ghi bằng chứng runtime đã xác minh trong quá trình chuyển Lean V1 sang Cloudflare-native.

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

IP/DNS cũ không được dùng làm commerce backend mới. Cloudflare-native Worker/D1/R2 là đường đích.

## D1 catalog audit

Audit read-only qua Wrangler đã thành công trên `giacong-vn-catalog-staging`.

Schema nghiệp vụ:

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

## Deep staging QA đã đạt

Sau data repair, workflow `Cloudflare staging deep QA` chạy lại trên active staging và **toàn bộ step đều xanh**.

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

Sau khi staging-admin route được thêm vào Wrangler và merge, deep QA trên `master` lại chạy **success toàn bộ**, gồm responsive browser check. Quality gate và Cloudflare staging build/package gate của cùng master commit cũng xanh; staging Worker version phục vụ storefront không bị thay đổi bởi bước khai báo trigger.

Deep QA workflow tự chạy khi storefront/runtime source, Wrangler config hoặc package contract liên quan thay đổi trên `master`; vẫn có `workflow_dispatch` để chạy lại sau data-only mutation.

## Governance Cloudflare-native

Nguồn quyết định là `docs/CLOUDFLARE_NATIVE_V1_PLAN.md`. `COMMERCE_PLATFORM_MASTER_PLAN.md` được giữ làm hồ sơ lịch sử Bagisto-era, không còn quyết định runtime/admin đích.

Plan khóa các nguyên tắc:

- D1/R2 là canonical data/media;
- Bagisto không quay lại runtime;
- Cloudflare-native admin nằm trong scope nhưng phải có auth boundary riêng và server write contract trước UI;
- request queue vẫn là Google Sheet + Apps Script cho đến quyết định riêng;
- staging là cổng bắt buộc;
- production không được dùng làm môi trường thử nghiệm.

Admin server contract chi tiết đã được khóa trong `docs/CLOUDFLARE_ADMIN_WRITE_CONTRACT.md`: hostname/Access admission, exact write shapes, stale-write protection, MOQ/step/contact/tier invariants, media policy, request id/idempotency, auditability và required regression matrix.

**Production Worker `giacong-vn`, production data resources và production route `kienhieu.id.vn/*` chưa bị thay đổi bởi các bước staging/admin-prep trên.**

## Control plane admin đã có trong mã nguồn

Nhánh hiện tại đã bổ sung bề mặt Next.js/D1/R2 để xử lý khoảng trống mà kế hoạch Bagisto-era từng để lại:

- `/admin/noi-dung`: site settings, brand, SEO, liên hệ và media R2;
- `/admin/thiet-ke`: page builder schema an toàn, draft/preview/publish cho page;
- `/admin/dieu-huong`: nhãn, href, thứ tự, active state và publish cho primary menu desktop/mobile;
- `/admin/thanh-vien`: owner quản lý `accessSubject`, vai trò và trạng thái thành viên;
- `admin-permissions.ts`: capability matrix server-side cho owner, content manager, catalog manager, sales manager và viewer;
- migration `0009_admin_control_plane.sql`: `site_pages`, `site_navigation_items` và revision cho `admin_members`.

Các màn hình mới là code đã kiểm thử, chưa có nghĩa migration đã được apply vào D1 staging/production. Không truy cập admin production hoặc ghi dữ liệu production cho tới khi có kế hoạch migration và acceptance riêng.

## Cổng kế tiếp

Application/runtime migration, deep QA và staging-admin edge/route audit đã đạt. Control plane mới đã có trong code; các bước tiếp theo là:

1. Apply `0009_admin_control_plane.sql` vào local/staging theo kế hoạch có backup; verify tables, seed menu và owner `accessSubject`.
2. Chạy admin acceptance trên staging: Access admission, role matrix, CRUD draft/publish, stale-write, media/page/navigation và audit log.
3. Dùng browser smoke test để kiểm tra responsive admin và published page/menu trên staging; không dùng production làm môi trường thử.
4. Xác minh Google Sheet/Apps Script trên account thật hoặc ra quyết định riêng nếu chuyển request inbox sang D1.
5. Chốt production taxonomy, SKU, variants, prices, MOQ, media, content và contact/trust claims.
6. Tạo/audit production D1/R2 có chủ ý và migration dataset đã duyệt; không copy demo staging ngầm định.
7. Chỉ sau acceptance admin + production data + request intake mới upload/promotion `giacong-vn` production.

## Trạng thái production + Google Sheet intake — 2026-08-26

Bằng chứng đã xác minh trong đợt staging QA + production promotion:

- Production Worker `giacong-vn` chạy version mới nhất @100% (`wrangler versions deploy` có kiểm soát, rollback point `88df8e93`).
- Production D1 đã áp dụng migrations 0004/0007/0008; backup export tại `.runtime/production-d1-backup-20260825.sql`.
- Ba lệch dữ liệu seed đã sửa có guard: contact threshold `B2B-SEED-SME-02` 260→264, `B2B-SEED-NMC-10` 140→141; bổ sung cột `variant_count`/`available_variant_count`; `option_id` 0→id cho 34 variants.
- Rate limit POST `/api/gui-yeu-cau/xac-thuc` hoạt động trên staging thật: 429 + Retry-After 60 tại ngưỡng 30 req/phút/IP (biên ±1 do eventual consistency của simple ratelimit).
- Google Sheet intake live: Web App Apps Script (consumer Google account) nhận lead từ `/api/contact` → queue → `doPost` → Sheet, `delivery_status: delivered` với reference `YC-*`. Idempotency theo `request_id`, chống công thức, protection giữ L:N editable.
- Template Apps Script đã vá cho tài khoản consumer: `getProtections(ProtectionType.SHEET)`, thứ tự removeEditors/addEditor giữ chủ sheet, bọc `setDomainEdit` trong try/catch. Đồng bộ tại `docs/google-apps-script-contact-webhook.gs` + regression test.
- Media chính dịch vụ: cột `services.image_url` (migration 0008), admin "Dùng làm ảnh chính", xóa media có guard 409 `MEDIA_IN_USE` khi đang tham chiếu.
- Admin UI: typography 6 bước cỡ, focus-visible đầy đủ, skeleton listing khớp grid thật.
- Việc còn mở: khách tự nhập dữ liệu thật qua `admin.kienhieu.id.vn`; chủ dự án chuyển DNS `giacong.vn` tại Tenten; giám sát 24h đầu.

## Staging admin release follow-up — 2026-08-30

Đây là evidence mới hơn các version được ghi ở các mục lịch sử phía trên:

- Worker staging version `91f79c65-a116-4865-b906-6467929c0f9b` đã được upload và promotion có kiểm soát lên 100% traffic; version `487b9b47-74b8-43c8-a0aa-9f6b708eb0a8` là rollback point.
- Preview version mới trả HTTP 200 cho homepage, catalog listing/detail, request form và service detail; preview `/admin/*` bị chặn với thông báo cần Cloudflare Access.
- Phiên admin staging trên `admin-staging.kienhieu.id.vn` trả `/api/admin/session` HTTP 200 và `/api/admin/audit?page=1&pageSize=20` HTTP 200; trang audit hiển thị `93 sự kiện`.
- Đã sửa lỗi runtime thật trong audit reader: truy vấn `UNION ALL` phẳng sáu nhánh vượt giới hạn compound SELECT của SQLite/D1. Reader hiện nhóm các nhánh con tối đa năm term, vẫn giữ filter/count/order/pagination ở SQL; regression test và staging read-back đều pass.
- Public smoke sau promotion: năm route storefront chính HTTP 200; product API trả product `bot-gao-lut-xay-min`, `variantCount=4`, starting price `78.000`; cart revalidation quantity `25` trả `isSubmittable=true`, unit price `78.000`, subtotal `1.950.000`.
- `d1 migrations list` trên staging báo không còn migration phải apply. Production không bị mutation trong follow-up này.

Các evidence trên đóng lát audit/runtime của staging, nhưng không đóng P5/P6: role matrix bằng Access thật, browser admin desktop/mobile/keyboard/focus, dữ liệu production được duyệt, restore/rollback drill, observability 24h và quyết định redirect domain cũ vẫn còn mở.

## Staging admin release follow-up — 2026-08-31

Đây là evidence mới nhất sau khi tích hợp category bulk archive, accessibility
hardening và bounded admin request/collection contracts:

- Version staging `c2d91d94-6737-447d-88b7-991f9808ba3f` đã được promotion có
  kiểm soát lên 100% traffic; version `d9caf3ef-e212-45ee-bd26-f37450ed2928`
  được giữ làm rollback point. Production Worker/data không bị mutation.
- Public staging route matrix `/`, `/san-pham/`,
  `/san-pham/bot-gao-lut-xay-min`, `/gui-yeu-cau/`, `/thue-gia-cong/` đều trả
  HTTP 200; console browser không ghi error/warning trong lượt kiểm tra.
- Catalog API trả HTTP 200, 4 variants, SKU `B2B-DEMO-BGL-05` và giá khởi
  điểm `78.000 ₫`; cart revalidation trả HTTP 200, quantity `25`, unit price
  `78.000 ₫`, subtotal `1.950.000 ₫`.
- `npm run check` trên source staging hiện tại pass với admin `128/128`, các
  suite còn lại `103/103`, `5/5`, `1/1`, `3/3`, `33/33`, `4/4`, `29/29`, cùng
  lint, typecheck và build exit code `0`.
- `request.json()` trực tiếp không còn trong `src/app/api/admin`; các JSON write
  route dùng bounded parser và collection read model chính có hard `LIMIT 100`.
- Category admin đã có snapshot route GET và archive batch POST: tối đa 100
  item, snapshot revision, stale/not-found/already-archived theo từng item,
  D1 atomicity, audit và idempotency; hard-delete category đã bị loại bỏ.
- Preview `workers.dev` bị Cloudflare Access redirect, nên chỉ active public
  staging được dùng làm public runtime evidence. Browser/CLI mới không có Access
  identity nên `admin-staging.kienhieu.id.vn` redirect đúng về Cloudflare Access
  login; chưa ghi nhận pass admin role matrix/focus/reduced-motion read-back.
- Production read-only audit cùng ngày: Worker `giacong-vn` vẫn ở version
  `1d8a2b41-6154-46d5-935b-8cb7fbc35688` @100%; D1 production còn migrations
  `0009_admin_control_plane.sql`, `0010_site_settings_write_contract.sql`,
  `0011_site_settings_bulk_publish.sql` và
  `0012_news_draft_publish_contract.sql` chưa apply. Không tự apply các
  migration này trong follow-up vì production data/content, Access role matrix
  và rollback/restore drill chưa được chốt.

Các gate còn mở: Access identity thật cho browser admin desktop/mobile/keyboard,
role × route/action read-back, production taxonomy/SKU/media/CMS được duyệt,
restore/rollback drill, observability 24h và quyết định redirect
`giacong.vn`.

## Staging admin release follow-up — 2026-08-31 (catalog contract)

Checkpoint mới nhất sau commit `853e9f3`:

- Worker staging version `8eb11c5e-f7bc-4a2f-a37f-2949a3d03541` đã được upload
  và promotion có kiểm soát lên 100%; version `c2d91d94-6737-447d-88b7-991f9808ba3f`
  là rollback point. Production Worker/data không bị mutation.
- Staging D1 `giacong-vn-catalog-staging` báo không còn migration pending và
  read-only schema check thấy `products`, `product_variants`,
  `product_admin_meta`, `admin_audit_log`.
- `npm run check` pass với admin `136/136`, các suite còn lại
  `103/103`, `5/5`, `1/1`, `3/3`, `33/33`, `4/4`, `29/29`, cùng lint,
  typecheck và build exit code `0`.
- Runtime smoke pass cho captured/catalog/service/cart; deep QA staging pass
  trên mobile/tablet/desktop, gồm no-overflow, search/sort, cart localStorage
  và keyboard reachability. Catalog API và cart revalidation vẫn trả canonical
  product/variant/price/subtotal.
- Request chưa có Access identity tới admin staging nhận 302 về Cloudflare
  Access. Chưa tự nhập credential/OTP; vì vậy role matrix, admin browser
  responsive/focus/reduced-motion và write/read-back bằng identity thật vẫn là
  release gate.

Các gate production vẫn giữ nguyên: production migrations chưa apply, dữ liệu
taxonomy/SKU/media/CMS chưa được duyệt, chưa có restore/rollback drill,
observability 24h và quyết định redirect `giacong.vn`.

## Staging admin release follow-up — 2026-08-31 (member/lead/media contract)

Checkpoint sau commit `b28515d`:

- Worker staging version `0d1e14c1-ec4d-47db-b0e2-4275f246f919` đã được upload
  và promotion có kiểm soát lên 100%; version
  `8eb11c5e-f7bc-4a2f-a37f-2949a3d03541` là rollback point. Production Worker,
  D1 và R2 không bị mutation.
- D1 staging `giacong-vn-catalog-staging` đã apply migrations `0013–0016`;
  `d1 migrations list` báo không còn migration pending.
- `npm run check` trên source commit pass: admin `158/158`, các suite còn lại,
  lint, typecheck và build exit code `0`. Runtime public smoke/deep QA pass
  trên staging ở mobile/tablet/desktop, gồm no-overflow, catalog search/sort,
  cart localStorage và keyboard reachability.
- Preview workers.dev và admin hostname không có Access identity vẫn bị chặn
  đúng boundary. Runtime write/read-back member/lead/media, role matrix,
  browser admin authenticated và reduced-motion/focus screenshot evidence vẫn
  là gate mở.

Production vẫn không bị mutation; các gate production trước đây (dữ liệu thật,
restore/rollback drill, observability 24h và quyết định redirect
`giacong.vn`) giữ nguyên.

## Staging storefront motion follow-up — 2026-08-31

- Worker version `ec0522c7-2840-4118-a7fb-0740c5d7c91e` đã được upload và
  promotion 100%; version `a5534149-5af4-415b-8e2d-947a0a995016` là rollback
  point.
- Browser runtime trên staging xác minh slider dots hiển thị thật (`display:
  inline-block`, có bounding rect), click `Nội dung 2` chuyển được
  `sliderIndex=1`, không có hidden row và không có console error/warning.
- Đây là fix CSS nhỏ cho storefront; không thay đổi production Worker hoặc
  production data. Các gate Access identity thật, role matrix, authenticated
  write/read-back và production vẫn giữ nguyên trạng thái mở bên dưới.

## Staging footer settings follow-up — 2026-08-31

- Worker version `cd4a973e-6fde-4538-b66b-04d3fadbb02d` đã được upload và
  promotion 100%; version `ec0522c7-2840-4118-a7fb-0740c5d7c91e` là rollback
  point.
- Browser runtime xác minh published settings được áp dụng vào captured footer:
  mô tả footer, địa chỉ `108 Trần Hưng Đạo - Hoàn Kiếm - Hà Nội` và copyright
  đều đọc được từ DOM; footer không chứa `<script>` và console không có
  error/warning.
- Public staging smoke sau bản này pass các route `/`, `/san-pham/`, `/tin-tuc/`,
  `/gui-yeu-cau/`, `/thue-gia-cong/`: đều có `main` và `footer`, không có admin
  control trên public host, không có footer script và không có console
  error/warning.
- Đây là acceptance cho renderer footer và không thực hiện production mutation.

## Production gate read-only audit — 2026-08-31

- `npx wrangler d1 migrations list giacong-vn-catalog --remote` báo còn pending
  các migration `0009_admin_control_plane.sql` đến
  `0016_admin_lead_request_marker.sql`.
- Vì vậy production control plane chưa đủ schema cho các capability admin mới.
  Đợt audit này không apply migration, không ghi D1/R2 và không deploy Worker
  production; cần backup/rollback window và production data acceptance trước khi
  thực hiện.

## Staging admin browser verification — 2026-08-31

- Worker version `a22e9ecb-e1f6-4966-b96b-e2883d138fb1` là phiên bản admin
  browser verification trước follow-up storefront; `0d1e14c1-ec4d-47db-b0e2-4275f246f919`
  là rollback point của phiên bản đó.
- Browser đã đọc được admin staging bằng actor `public-demo` (owner của chế độ
  demo staging): đủ 10 route admin render đúng heading, không có alert và không
  có console error/warning; audit đọc 20 dòng đầu trên 93 event, product editor
  đọc lại media asset từ API.
- Mobile `390×844` pass no-overflow cho 10/10 route; nút mở menu có
  `aria-expanded=true` và sidebar hiện đúng. Fix CSS `d4383df` đã loại page-level
  overflow do sample CSV, trong khi bảng dữ liệu vẫn cuộn trong container riêng.
- Đây là bằng chứng runtime cho actor demo staging, không phải Access identity
  thật. Role matrix, authenticated write/read-back member/lead/media,
  focus/reduced-motion và production data/migration/restore gates vẫn mở.
