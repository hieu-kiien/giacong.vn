# Cloudflare current state — 2026-09-02

Hồ sơ này ghi bằng chứng runtime đã xác minh trong quá trình chuyển Lean V1 sang Cloudflare-native.

## Snapshot hiện hành — 2026-09-02

- Staging Worker `giacong-vn-staging` đang chạy version
  `eff0d7fa-c5e2-4641-911b-b3b324ac0284` ở 100%; rollback point gần nhất là
  `a709e5a4-c457-43ab-9d77-2d5d20ac0b7b`.
- Commit hardening tương ứng là `e1936cfb`. `npm run check` exit `0`: admin
  `198/198`, contact `104/104`, catalog `5/5`, purchase UI `1/1`, service
  `3/3`, commerce `68/68`, listing `4/4`, detail `29/29`, lint, typecheck và
  build đều pass. Deep QA responsive và Chrome owner direct-editor smoke test
  cũng pass, không có console error/warning.
- Production Worker/D1/R2/DNS chưa bị mutate. Read-only Wrangler ngày này còn
  xác nhận 11 migration pending `0009–0019` trên D1 production.
- Export production D1 fresh đã được tạo bằng Wrangler tại
  `.runtime/production-d1-backup-20260902-pre-release.sql` (69,233 bytes,
  SHA-256 `583BE2FBFFC2C6D8F0C77E7D97C3786E838EDBFD228E024AD7A8F078A147ABFD`).
  Restore-drill SQLite độc lập đạt `integrity_check=ok`, foreign-key violations
  `0`, với 19 bảng, 13 migration, 9 product, 17 variant và 0 lead.
- Migration preflight drill ngày 2026-09-03 đã đọc backup vào SQLite memory và
  chạy lần lượt toàn bộ file `0009–0019`; kết quả `integrity_check=ok`, foreign-
  key violations `0`, schema sau drill có 32 bảng. Drill không ghi D1 remote và
  không thay thế bước apply/verify production có cửa sổ rollback.
- Production promotion vẫn **NO-GO** cho tới khi hoàn tất role × route/action
  với nhiều Access identity, full write/read-back/audit, duyệt dữ liệu thật,
  migration window/rollback, và observability 24 giờ. Backup/restore artifact
  hiện đã có nhưng phải export lại ngay trước migration nếu dữ liệu thay đổi.

Các version và kết quả bên dưới là evidence lịch sử; khi mâu thuẫn với
snapshot này, snapshot này phản ánh trạng thái runtime mới nhất.

## Direct edit trên storefront thật — 2026-09-02

- `AdminVisualEditor` đã chuyển từ draft preview mô phỏng sang registry an toàn
  trên DOM homepage đang render. Owner/content manager có 8 target mapped:
  brand tagline, hero eyebrow/title/description, hai CTA và about
  title/description; URL/media vẫn dùng bảng nội dung đầy đủ.
- Chrome owner staging đã xác nhận 8/8 selector, sửa tạm text ngay tại node
  thật, thanh hành động báo thay đổi chưa lưu, reload khôi phục published;
  drawer có field text/link/media và không còn `DraftPreview`/`Xem trước draft`.
  Console admin không có error/warning; public staging không có toolbar hoặc
  `data-admin-direct-target`.
- Focused direct-editor test đạt `13/13`; full admin `192/192`, commerce
  `67/67`; OpenNext build qua compile, TypeScript và static generation.
- Worker `giacong-vn-staging` đang phục vụ version
  `6162fa96-38fb-46df-adba-beb1e2d99001` ở 100%; rollback point là
  `dabb547e-1475-4815-b9e9-03be91064105`. Production Worker/D1/R2 và DNS
  không bị thay đổi.

## Homepage content renderer — 2026-09-02

- Commit `732eba5` bổ sung adapter homepage riêng cho `hero_description`,
  `about_title` và `about_description`. Adapter chỉ nhắm section captured
  `section01/section02`, escape HTML và giữ nguyên các route captured khác.
- Local full gate sau thay đổi pass: admin `190/190`, contact `104/104`, catalog
  `5/5`, purchase UI `1/1`, service `3/3`, commerce `67/67`, listing `4/4`,
  detail `29/29`, lint, typecheck và build.
- Chrome public staging đọc lại DOM thật sau deploy: hero eyebrow/title/mô tả,
  CTA và phần giới thiệu đều khớp bản published; navigation và gallery vẫn
  hiện đúng. Không tạo draft, không ghi D1/R2 trong phép kiểm tra này.
- Worker staging `giacong-vn-staging` hiện phục vụ version
  `81b2e573-dea9-4e6a-b7ce-9cddb9b5fc70` ở 100%; rollback point là
  `0d4d66f9-2b6e-42d1-a8e2-58bda74f98f0`. Audit owner vẫn `139` sự kiện;
  production Worker/D1/R2 và DNS không bị thay đổi.

## Published hero CTA renderer round-trip — 2026-09-02

- Commit `173239e` nối bốn setting `hero_primary/secondary_cta_label/url` vào
  hai CTA captured của homepage. Label được HTML-escape, URL được attribute-
  escape; renderer chỉ nhắm đúng class CTA đã xác định trong captured markup.
- Owner Access thật đã chạy draft → publish với cả bốn trường; public DOM đọc
  đúng label, href và visibility của hai nút. Sau đó cả bốn giá trị được
  restore/publish về bản gốc.
- Worker staging `giacong-vn-staging` hiện phục vụ version
  `0d4d66f9-2b6e-42d1-a8e2-58bda74f98f0` ở 100%; rollback point là
  `c860a002-afcc-4c41-a329-b0390799d9bc`. Audit owner hiện có `139` sự kiện;
  deep QA public responsive sau deploy pass; production không bị thay đổi.

## Published brand tagline renderer round-trip — 2026-09-02

- Commit `ca14e5f` nối setting `brand_tagline` vào shared captured storefront
  renderer. Adapter thêm text đã HTML-escape cạnh logo và CSS tối thiểu; không
  thêm dependency, không mở rộng scope sang tùy ý sửa captured HTML.
- Full local gate sau thay đổi pass: admin `190/190`, contact `104/104`, catalog
  `5/5`, purchase UI `1/1`, service `3/3`, commerce `65/65`, listing `4/4`,
  detail `29/29`, lint, typecheck và build.
- Owner Access thật đã chạy trên staging: lưu draft tagline QA → publish →
  storefront public đọc đúng `data-site-setting="brand_tagline"`, text đúng và
  element có kích thước hiển thị; sau đó khôi phục/publish tagline gốc và đọc
  lại đúng. Audit hiện có `123` sự kiện; bốn event mới có revision
  `7 → 8 → 9 → 10 → 11`.
- Worker staging `giacong-vn-staging` hiện phục vụ version
  `c860a002-afcc-4c41-a329-b0390799d9bc` ở 100%; version ngay trước đó
  `26884d0b-0092-43cd-bad2-df077de605eb` là rollback point. Deep QA public
  responsive sau deploy pass toàn bộ; production Worker/D1/R2 và DNS không bị
  thay đổi.

## Navigation publish round-trip và homepage fallback — 2026-09-02

- Commit `7666d67` tách trạng thái `dirty` của server khỏi `localDirty` của
  form điều hướng: draft đã lưu được phép phát hành từng mục; draft chưa lưu
  bị chặn phát hành và publish-all. Regression nằm trong
  `scripts/admin-navigation-ui.test.mjs`; full admin gate đạt `187/187`.
- Trong browser owner, `Home [QA]` đã được đổi và lưu draft; nút `Phát hành`
  từng mục đã bật đúng, publish thành công và public homepage đọc đúng
  `Home [QA]`. Commit `8ecd8ae` sửa nguyên nhân thứ hai: `CapturedHomePage`
  trước đó không áp dụng `getPublishedSiteNavigation`, nên homepage luôn dùng
  menu captured mặc định dù D1 đã publish.
- Staging Worker `giacong-vn-staging` hiện phục vụ version
  `26884d0b-0092-43cd-bad2-df077de605eb` ở 100%; version ngay trước đó
  `1ff986f1-49ba-4a33-97d0-a6dfeb9e9d09` là rollback point. Build/deploy pass;
  không có migration hay thay đổi production.
- Owner đã khôi phục và publish lại nhãn `Home`. D1 staging đọc lại
  `draft_label = published_label = Home`, `version = 7`, `dirty = 0`; public
  hard reload đọc đúng `Home`. `/admin/audit` đọc `107 sự kiện`, trong đó có
  bốn event navigation mới với revision `3 → 4 → 5 → 6 → 7`.
- `node scripts/qa-deep-staging.mjs` sau version hiện hành pass toàn bộ kiểm tra
  mobile/tablet/desktop, catalog, detail/cart, keyboard và no-overflow.

## Cập nhật runtime 2026-09-02 (managed page write + role-safe admin)

- Commit `7d6b75b` đã hoàn tất contract ghi managed page: create/draft/publish
  dùng UUID `requestId`, optimistic version, replay idempotent và
  `409 IDEMPOTENCY_CONFLICT` khi fingerprint khác; mutation page và audit
  chuyên biệt được ghép trong cùng D1 batch. Migration
  `0019_admin_site_page_write_contract.sql` đã apply/verify trên D1 staging,
  không còn migration pending và không đụng production.
- Staging Worker `giacong-vn-staging` hiện phục vụ version
  `26884d0b-0092-43cd-bad2-df077de605eb` ở 100%; version ngay trước đó
  `1ff986f1-49ba-4a33-97d0-a6dfeb9e9d09` là rollback point. `ADMIN_PUBLIC=false`
  và bindings staging vẫn đúng.
- Active smoke sau promotion đạt 7/7 public route HTTP 200; product API trả
  `availableVariantCount=3`, SKU `B2B-DEMO-BGL-05` khả dụng và giá `78000`;
  cart revalidation trả subtotal `1950000` cho quantity 25; R2 media trả 200
  với 1,979,346 bytes. Tổng variant staging là 4 vì có một variant smoke
  không khả dụng; release workflow đã được sửa để kiểm tra invariant nghiệp vụ
  thay vì đếm tổng cứng.
- Local source gate gần nhất: admin `185/185`, lint, typecheck và build đều
  exit `0`; browser Chrome với Access identity thật xác nhận
  `qtu1053@gmail.com` là `Chủ sở hữu (toàn quyền)`, thấy form thêm admin, bulk
  action sản phẩm và quyền xử lý các màn hình owner. Chưa tạo admin thứ hai và
  chưa thực hiện mutation dữ liệu staging trong lượt revalidation này.
- Production Worker, D1/R2 và route production chưa bị thay đổi. Các gate role
  matrix nhiều identity, write/read-back từng domain, dữ liệu production,
  backup/restore, observability và production promotion vẫn mở.
- Read-only `wrangler d1 migrations list giacong-vn-catalog --remote` ngày
  2026-09-02 xác nhận production còn pending chính xác `0009–0019`; không apply
  migration, không ghi D1/R2 và không deploy production.
- Export production D1 mới ngày 2026-09-02 đã lưu tại
  `.runtime/production-d1-backup-20260902-pre-release.sql` (69,233 bytes,
  SHA-256 `583BE2FBFFC2C6D8F0C77E7D97C3786E838EDBFD228E024AD7A8F078A147ABFD`).
  Restore-drill cục bộ đạt SQLite `integrity_check=ok` với 19 bảng, 13
  migration, 9 product, 17 variant và 0 lead. Snapshot cũ ngày 2026-08-25 vẫn
  được giữ làm lịch sử; phải re-export lại ngay trước cửa sổ migration nếu dữ
  liệu production thay đổi.

## Cập nhật runtime 2026-09-01

- Local navigation contract commit `566489d` và create contract commit `d654f2e`
  đã hoàn tất: request UUID bắt buộc ở create/single save/publish và bulk publish, optimistic revision/CAS,
  idempotent replay/conflict, D1 batch atomic với audit chuyên biệt và giới hạn
  bulk 100 mục. `0017_navigation_bulk_publish_contract.sql` và
  `0018_navigation_create_contract.sql` đã được kiểm tra trên D1 local tạm sau
  `scripts/local-catalog-baseline.sql`; toàn bộ `0001–0018` apply thành công và
  lần list cuối báo không còn migration pending. Migration mới đã apply/verify
  trên D1 staging; production chưa bị thay đổi.

- Commit `8c509c5` đã harden dependency baseline: Next.js `16.3.4`,
  `@opennextjs/cloudflare` `1.20.5`, Wrangler `4.125.0`; loại `shadcn` CLI
  khỏi runtime dependency graph và giữ Tailwind extension cần thiết trong
  source.
- `npm run check` pass toàn bộ test/lint/typecheck/build. `npm audit --omit=dev
  --audit-level=high` và `npm audit --audit-level=high` đều trả `0
  vulnerabilities`.
- Staging Worker `giacong-vn-staging` đã build/deploy version
  `379d20d7-44d2-40ee-a603-2890ba7515fb` ở 100% traffic; version
  `278030a5-c21b-423f-b443-7f2ad4834b76` được giữ làm rollback point; bindings
  và routes staging vẫn đúng, `ADMIN_PUBLIC=false`.
- Live `qa:ux` sau deploy tại `https://staging.kienhieu.id.vn` pass 5/5 route,
  toàn bộ action, 0 console error, 0 HTTP 4xx/5xx, 0 overflow, axe `5/5` với
  0 serious/critical violation. Lượt mới nhất có 1 warning `postMessage` từ
  Google Maps bên thứ ba; không có application console error.
- Evidence Playwright mới nhất được lưu ngoài repo tại
  `C:\Users\hieuk\Desktop\staging-ux-audit-2026-09-01-admin-copy`; audit dependency
  trước đó ở `C:\Users\hieuk\Desktop\staging-ux-audit-2026-09-01-deps`. Cloudflare Access
  identity thật cho owner đã được xác nhận trên Chrome staging; role matrix với
  nhiều identity, write/read-back đầy đủ và production gate vẫn chưa đóng.
- Commit `650d10f` đã sửa nội dung hướng dẫn trên màn hình Access-blocked để
  người ít chuyên môn biết chọn nút đăng nhập, hoàn tất xác minh và quay lại;
  regression test và full local gate đã pass. Commit `60ac85e` tiếp tục trả
  `memberId` trong session để UI nhận diện đúng owner hiện tại khi Access `sub`
  khác D1 `access_subject`; Chrome staging đã xác nhận bằng identity thật.
- Commit `bbcbfba` tiếp tục đổi các trạng thái dùng chung của admin sang ngôn ngữ
  đời thường: lỗi dữ liệu, độ sẵn sàng, ghi chú dữ liệu và footer không còn lộ
  D1/API/schema/migration cho người vận hành. Regression `admin-ui-system` đạt
  `162/162`; full local gate, staging build/deploy và public browser audit sau
  deploy đều pass. Đây vẫn chưa thay thế Access identity thật cho browser QA
  bên trong admin.

- Commit `d654f2e` đã hoàn tất navigation create contract: build/upload và
  promotion staging version `eb921d4e-2250-460c-913a-071499e52c59` lên 100%,
  rollback point là `902b3a6e-732f-4de6-a9fc-429b6478d833`. D1 staging đã apply
  `0018_navigation_create_contract.sql`; migration list không còn pending,
  schema có `admin_navigation_create_audit` và `site_navigation_items.last_request_id`,
  số audit create trước browser write là `0`. Chrome Access thật đã đọc lại owner,
  form create navigation và audit read-only sau promotion; chưa submit mutation
  navigation để tránh tạo dữ liệu staging không được yêu cầu.

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
- Production D1 đã áp dụng migrations 0004/0007/0008; đợt 2026-08-25 có
  ghi nhận backup export trước seed. Đoạn này là bằng chứng lịch sử; export mới
  và restore-drill hiện tại được ghi ở phần cập nhật runtime 2026-09-02. Vẫn
  phải re-export lại ngay trước migration production nếu dữ liệu thay đổi.
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
- Read-only `sqlite_master`/`d1_migrations` audit cho thấy production mới áp
  tới các migration catalog/lead/media nền và `0004_admin_foundation`,
  `0007_news_posts`, `0008_service_images`; các bảng `site_pages`,
  `site_navigation_items` và các audit table chuyên biệt chưa có đầy đủ.
  Query trả `changed_db=false`, `rows_written=0`.
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

## Staging admin Access lock follow-up — 2026-08-31

- Commit `41f65eb` đã đổi staging admin từ public-demo sang Access-protected:
  `ADMIN_PUBLIC="false"`, bỏ `ADMIN_PUBLIC_SUBJECT`; storefront staging vẫn
  public.
- Version `11eb20a9-69c8-4dbd-884e-b65aa31d2d93` đã upload và promote 100%;
  rollback point là `cd4a973e-6fde-4538-b66b-04d3fadbb02d`.
- Browser runtime trên `admin-staging.kienhieu.id.vn/admin` hiện trả màn hình
  cần Cloudflare Access và không còn actor public-demo khi chưa có identity.
- Public smoke bằng fetch sau rollout pass `/`, `/san-pham/`, `/tin-tuc/`,
  `/gui-yeu-cau/`, `/thue-gia-cong/`: tất cả HTTP 200 sau redirect, có
  `main`/`footer`, không có admin control.
- Đây mới đóng boundary lock; Access identity thật, role matrix và
  authenticated write/read-back vẫn chờ chủ dự án đăng nhập.

## Staging admin login handoff follow-up — 2026-08-31

- Commit `d6bfb43` thêm nút đăng nhập trực tiếp trên blocked admin screen, giữ
  nút retry riêng cho trường hợp phiên vừa hết hạn.
- Version `a772e2d3-06b6-4046-bf0f-36f6ed5b2329` đã upload và promote 100%;
  rollback point là `11eb20a9-69c8-4dbd-884e-b65aa31d2d93`.
- Browser snapshot không có identity đã xác nhận nút `Đăng nhập Cloudflare
  Access` với href `/cdn-cgi/access/login?redirect_url=%2Fadmin`.
- Access identity thật, role matrix và authenticated write/read-back vẫn chưa
  chạy cho đến khi chủ dự án hoàn tất đăng nhập.

## Staging admin login handoff correction — 2026-08-31

- Probe độc lập xác nhận `/cdn-cgi/access/login` không phải endpoint hợp lệ của
  application này (404); nút login đã được sửa ở commit `4d090b4` để reload
  `/admin`, cho Cloudflare edge phát sinh redirect chuẩn.
- Version `0d73b4ce-ef7f-4f52-a3b0-63ecb7e3e90d` đã promote 100%; rollback point
  là `a772e2d3-06b6-4046-bf0f-36f6ed5b2329`.
- Browser snapshot hiển thị nút `Đăng nhập Cloudflare Access` với href `/admin`;
  fetch không có identity nhận HTTP 302 tới team Access
  `jolly-brook-7bc8.cloudflareaccess.com`, còn storefront `/` nhận HTTP 200.
- In-app browser hiện không hoàn tất được trang Access; không nhập credential
  hoặc OTP thay chủ dự án.

## Public staging deep QA revalidation — 2026-09-01

- Host public đúng của storefront staging là `staging.kienhieu.id.vn`; host
  `admin-staging.kienhieu.id.vn` là boundary nội bộ riêng và được Access bảo vệ
  toàn host. Không dùng admin host để suy ra public storefront.
- Deep QA read-only trên public host đã pass: 3 viewport mobile/tablet/desktop ×
  4 route, no-horizontal-overflow, catalog search/sort, mobile product detail,
  cart localStorage, cart line read-back và keyboard reachability.
- Lượt đầu lộ race condition trong harness vì chờ cứng 800 ms trước khi đọc dòng
  cart; commit `b45dede` đổi sang chờ selector thực tế. Test contract đỏ → xanh,
  sau đó `DEEP QA PASSED`. Không có D1/R2 mutation.
- Access host không có identity vẫn nhận HTTP 302 tới team Access; browser tab
  hiện vẫn ở màn hình yêu cầu đăng nhập. Role matrix và authenticated
  write/read-back vì thế chưa thể đóng.

## Staging admin login UX fallback — 2026-09-01

- Commit `3c15f0f` giữ nút đăng nhập Cloudflare Access ngay cả khi browser
  chuyển hướng Access làm `fetch('/api/admin/session')` rơi vào `NETWORK_ERROR`;
  retry vẫn được giữ riêng cho lỗi runtime thật.
- Version staging `8bf8de20-ed58-4637-aac7-ec9b81aeef37` đã build và deploy;
  browser reload hiện tới form `Log in to Giacong staging Admin` của Access.
- Public smoke sau deploy: `staging.kienhieu.id.vn/` và `/san-pham` đều HTTP
  200; request không identity tới `admin-staging.kienhieu.id.vn/admin` nhận
  HTTP 302 tới Access. Không có production mutation.
- Access identity thật, role matrix và authenticated write/read-back vẫn chờ
  chủ dự án tự đăng nhập.

## Staging Access policy and owner bootstrap audit — 2026-09-01

- Lần xác thực gần nhất trên browser quay về `__cf_access_message=unauthorized`;
  vì vậy policy Allow của ứng dụng Access staging chưa chứng minh đã cho phép
  identity vận hành.
- Read-only query trên D1 `giacong-vn-catalog-staging` trả
  `total_members=0`, `active_owners=0`, `active_members=0`; không có owner để
  chạy `/admin/thanh-vien` hoặc role matrix. Query có `changes=0`,
  `rows_written=0`, `changed_db=false`.
- Không tự động seed email hay nâng quyền: sau khi policy cho phép identity,
  owner đầu tiên phải được chủ dự án xác nhận và tạo chủ ý qua quy trình admin
  hoặc bootstrap đã duyệt; không dùng public-demo làm bằng chứng Access thật.

## Staging storefront motion and UX runtime revalidation — 2026-09-01

- Commit 6c0de5e (motion/menu/asset integration) đã deploy thành version
  43e186bc-8dff-4812-b9e1-68e10336a4f1; bindings vẫn trỏ đúng staging D1,
  R2, queue và Access hostname.
- Runner tái lập `npm run qa:ux` đã kiểm tra 5 route public ở mobile/desktop:
  catalog search/detail, news search, contact invalid-form, mobile menu +
  product accordion, desktop mega-menu pointer handoff và scroll reveal.
  Tất cả action pass; HTTP 200; không có 4xx/5xx; không horizontal overflow;
  axe chạy đủ 5/5 với 0 serious/critical violation.
- Hard gate runtime ghi nhận 0 console error. Có 1 warning từ Google Maps
  iframe bên thứ ba trên trang liên hệ (`postMessage` target-origin), không
  phát sinh từ app code và không có mutation D1/R2.
- Ảnh WebP demo được upload trong cùng deployment; test commerce/detail và
  build/type generation đã pass trước promotion.

## Staging admin plain-language states — 2026-09-01

- Commit `bbcbfba` đã thay các câu hiển thị hạ tầng trong `AdminErrorState`,
  `DataReadiness`, `AdminUnavailableNote` và footer của `AdminShell` bằng câu
  hướng dẫn dễ hiểu; logic phát hiện lỗi, API, quyền và dữ liệu không đổi.
- Admin regression đạt `162/162`; full local gate đã hoàn tất test/lint/typecheck/
  build output không có lỗi. Wrapper Windows giữ process sau khi in kết quả nên
  không dùng exit code của wrapper treo làm bằng chứng riêng.
- Staging version `ecda5cee-8791-4290-8505-56acbd5f4d5f` build/deploy thành công;
  public `qa:ux` pass 5/5 route, mọi action, 0 console error, 0 HTTP 4xx/5xx,
  0 overflow, axe `5/5` không serious/critical. Evidence mới nhất nằm ngoài
  repo tại `C:\Users\hieuk\Desktop\staging-ux-audit-2026-09-01-admin-copy`.
- Probe admin không có Access identity trả HTTP `302` về lớp Access, đúng
  fail-closed; browser admin bằng identity thật, role matrix và authenticated
  read/write-back vẫn là gate mở.
- Route boundary probe không có identity đã kiểm tra `22/22` đường dẫn admin
  page/API đã khai báo; tất cả đều trả HTTP `302`, không đọc được Worker payload
  trực tiếp và không có mutation. Production edge probe cùng ngày trả public
  `200`, admin `302`. Hai lần gọi D1 read-only production (`migrations list` và
  query `d1_migrations`) gặp Cloudflare API internal error `7500` ở query và
  authentication error `10000` ở database info, nên chưa dùng kết quả đó để
  suy diễn migration state và không phát hành lệnh ghi.

## Staging admin Access fallback visual fix — 2026-09-01

- Commit `af23063` đặt loading screen và màn hình phiên bị chặn vào chung
  `.admin-app`, để các token màu admin không bị mất khi chưa có phiên hợp lệ.
  Contract test mới tái hiện đúng lỗi nút đăng nhập chữ trắng trên nền trắng.
- Full local gate sau thay đổi đạt exit code `0`: admin `163/163`, các suite
  còn lại `104/104`, `5/5`, `1/1`, `3/3`, `63/63`, `4/4`, `29/29`, cùng lint,
  typecheck và build.
- Staging version `675fbf36-e9ef-46d7-a377-9b75d5803c78` deploy thành công;
  `ADMIN_PUBLIC=false`, Access boundary và các binding staging giữ nguyên.
- Playwright headless cô lập với response `403` giả lập xác nhận DOM có đúng
  nút `Đăng nhập Cloudflare Access`, nền xanh đậm, chữ sáng và không có page
  error. Ảnh kiểm tra nằm ngoài repo tại
  `C:\Users\hieuk\Desktop\admin-access-fix-2026-09-01.png`.
- Đây chỉ là sửa hiển thị fallback; chưa chứng minh Access policy đã cho phép
  identity hoặc owner bootstrap. Chủ dự án cần tải lại trang Chrome rồi chọn
  nút đăng nhập nếu phiên vẫn chưa được chấp nhận.

## Staging admin Access action and Vietnamese font fix — 2026-09-01

- Commit `4d02df9` đổi handoff đăng nhập thành button thật gọi full document
  reload. Điều này tránh `next/link` điều hướng client-side tại chính `/admin`,
  để request quay lại Cloudflare edge và có cơ hội phát sinh Access redirect;
  không nới JWT validation, policy hay quyền admin.
- Admin dùng asset font nội bộ `SFProDisplay-Regular.woff2` và
  `SFProDisplay-Bold.woff2` dưới tên `Admin Sans`; tiêu đề fallback không còn
  phụ thuộc `Geist`/`Georgia` thiếu glyph tiếng Việt.
- Full local gate đạt exit code `0`: tất cả test admin/contact/catalog/service/
  commerce/listing/detail, lint, typecheck và build đều pass. Playwright headless
  ở desktop/mobile xác nhận button actionability, full reload tạo document
  request thứ hai, font `Admin Sans` loaded và không có page error.
- Staging version `474656c9-e5b5-49c7-b509-26464e71b3b6` deploy thành công;
  public host trả HTTP `200`, hai font trả HTTP `200` với MIME `font/woff2`,
  admin host không có identity vẫn trả HTTP `302` về Access.
- Access identity thật, role matrix và owner bootstrap vẫn là gate riêng; không
  seed tài khoản hay thay policy thay cho chủ dự án.

## Staging Access audience correction — 2026-09-01

- Audit read-only bằng workflow `cloudflare-admin-access-audit.yml`, run
  `33483017841`, đọc đúng ứng dụng `Giacong staging Admin` và xác nhận team
  domain `https://jolly-brook-7bc8.cloudflareaccess.com`.
- Audience thực tế của ứng dụng là
  `a5738e3cb28340605b9aa2fc16c272032619233086e3d281b19e4a8ef9303ccf`, khác
  với giá trị cũ trong block staging. Sai audience giải thích chính xác lỗi
  `FORBIDDEN · Phiên quản trị không hợp lệ` sau khi Access đã cho request qua.
- Chỉ thay `POLICY_AUD` của environment staging; không thay policy, JWT
  validation, production vars, D1/R2 hay dữ liệu tài khoản.
- Staging version `100e84c3-78f1-4a54-aa69-2b21f6d31386` deploy thành công;
  public staging vẫn trả `200`, admin không có identity vẫn trả `302` về
  Cloudflare Access. Cần re-test bằng phiên Chrome đã đăng nhập để đóng gate
  Access identity; owner bootstrap và role/read-write acceptance vẫn còn mở.

## Staging admin owner bootstrap và browser acceptance — 2026-09-01

- Workflow dispatch `33488908920` đã hoàn tất thành công trên GitHub Actions.
  Workflow chỉ nhắm tới D1 staging `giacong-vn-catalog-staging`, khóa cứng
  owner được phê duyệt là `qtu1053@gmail.com` và không nhắm production.
- Preflight xác minh bảng `admin_members` tồn tại, chưa có identity trùng,
  không có row xung đột với id owner dành riêng. Upsert idempotent ghi đúng một
  row; post-condition xác minh `matching_rows = 1` và
  `active_owner_matches = 1`.
- Chrome đã đăng nhập được tải lại tại `/admin`: header hiển thị `Vai trò:
  Chủ sở hữu`, dashboard đọc được dữ liệu D1 thật, không còn lỗi thiếu quyền.
  Console không có error hoặc warning trong lượt kiểm tra.
- `/admin/thanh-vien` render đúng với một tài khoản owner; nút `Thêm thành
  viên` hoạt động và mở form tạo thành viên. Chưa submit tài khoản thứ hai
  trong lượt acceptance này.
- Đây là bằng chứng Access identity thật + owner bootstrap trên staging. Các
  gate còn lại của admin (role matrix đầy đủ, write/read-back từng capability,
  reduced-motion/focus và production data/migration) vẫn phải hoàn tất trước
  khi mở production.

## Admin owner identity hardening và staging revalidation — 2026-09-01

- Commit `60ac85e` sửa điểm nhận diện tài khoản hiện tại: Cloudflare Access
  có thể gửi `sub` khác với `admin_members.access_subject`, trong khi email đã
  được D1 dùng để resolve đúng owner. API `/api/admin/session` giờ trả thêm
  `memberId`; UI ưu tiên `memberId` và vẫn giữ subject fallback tương thích.
- Sau khi deploy, `/admin/thanh-vien` hiển thị đúng
  `qtu1053@gmail.com · tài khoản hiện tại`, vai trò `Chủ sở hữu`, quyền
  `Owner · có quyền`; combobox role và checkbox active của chính tài khoản
  bị khóa. Nút `Thêm thành viên` vẫn hiện để owner tạo admin/nhân sự với các
  role được phép. Không tạo tài khoản thứ hai trong lượt kiểm tra này.
- Gate code mới đạt: focused session/UI tests `17/17`; full admin suite
  `165/165`; lint, typecheck và build đều exit `0`; `git diff --check` không
  có whitespace error. GitNexus detect-changes không phát hiện execution
  flow bị ảnh hưởng ngoài phạm vi dự kiến.
- Staging version `a1f71e85-113e-4559-9377-ebedc22b92e7` đã được promote
  `100%`; các route public `/`, `/san-pham/`, `/tin-tuc/`, `/gui-yeu-cau`
  đều trả HTTP `200`. Kiểm tra Chrome đã đăng nhập xác nhận dashboard đọc
  được D1 thật và không có console error/warning.
- Production chưa bị deploy hoặc thay đổi. Việc tạo admin thứ hai ngoài
  thực tế cần xác định trước email/Access identity, tên hiển thị và role;
  đây là acceptance gate có chủ đích để không ghi nhầm dữ liệu quyền hạn.
- Lỗi giới hạn tài nguyên từng thấy khi chuyển nhanh qua nhiều route admin
  chưa được coi là đã giải quyết vĩnh viễn; lượt kiểm tra có kiểm soát riêng
  tại `/admin/tin-tuc` đã tải bình thường. Cần tiếp tục quan sát bằng trace
runtime trước khi đóng gate hiệu năng/ổn định.

## Navigation contract verification — 2026-09-01

- Commit `566489d` đã đưa navigation single save/publish và bulk publish về cùng
  chuẩn write contract: exact body, UUID request id, optimistic revision,
  idempotent replay/conflict, D1 batch coupling và audit chuyên biệt.
- Bulk publish không còn âm thầm bỏ qua mục thứ 101: query đọc `LIMIT 101`,
  vượt 100 thì từ chối trước mutation; kết quả trả `selectedCount`,
  `changedCount`, danh sách đã publish và `skipped[{id, reason}]`. UI hiển thị
  rõ partial result thay vì báo thành công giả.
- Audit history đã merge được child navigation events và bulk envelopes qua
  `/api/admin/audit`; không đưa payload nội dung vào response.
- Bằng chứng local: migration baseline + `0001–0018` pass, full admin `175/175`,
  typecheck, lint, build và `git diff --check` pass. Staging đã apply migration,
  upload/promote version mới; browser đã xác nhận owner/dashboard/navigation/
  audit read-only không có console error/warning. Browser navigation write/read-
  back, role matrix nhiều identity và production gate vẫn là bước kế tiếp.
- Remote D1 read-only verify sau migration trả đúng ba bảng navigation/audit,
  cột `site_navigation_items.last_request_id` và `changes=0`; không có dữ liệu
  staging nào bị thay đổi trong lượt kiểm tra schema.
- `qa:ux` sau version mới pass 5/5 route, 0 console error, 0 HTTP 4xx/5xx,
  không overflow và không có axe serious/critical; 36 warning là từ script/
  iframe bên thứ ba và không chặn gate hiện tại.
- Rollback drill staging sau promotion đã pass: tạm chuyển 100% traffic về
  `a1f71e85-113e-4559-9377-ebedc22b92e7`, smoke public đạt, rồi khôi phục 100%
  về `902b3a6e-732f-4de6-a9fc-429b6478d833`. Production Worker/D1/R2 không bị
  mutation; backup/restore production và production promotion vẫn chưa đóng.
- Production D1 read-only migration check vẫn báo các migration `0009–0018`
  đang chờ apply. Lượt kiểm tra không apply migration và không ghi dữ liệu;
  production control plane chỉ được mở sau backup, phê duyệt dữ liệu và cửa sổ
  rollback riêng.

## Admin owner/RBAC boundary và staging revalidation — 2026-09-02

- Commit `d14d4e4` đã chốt mô hình control plane: `qtu1053@gmail.com` là tài
  khoản `owner` cấp cao nhất trên staging, có toàn bộ capability và được phép
  tạo tài khoản admin, cấp/sửa năm vai trò (`owner`, `content_manager`,
  `catalog_manager`, `sales_manager`, `viewer`) và bật/tắt quyền truy cập.
  Các API member vẫn kiểm tra server-side; owner không thể tự hạ quyền hoặc tự
  vô hiệu hóa, role khác không thể sửa control plane.
- `/admin/thanh-vien` trên Chrome đã hiển thị đúng `qtu1053@gmail.com · tài
  khoản hiện tại`, `Chủ sở hữu (toàn quyền)`, năm lựa chọn vai trò và nút
  `Thêm tài khoản quản trị`; form tạo tài khoản mở được. Không submit member
  mới trong lượt xác minh để tránh ghi dữ liệu quyền hạn ngoài chủ ý.
- `/admin/dieu-huong` sau khi session quyền tải xong hiển thị `Có quyền chỉnh
  sửa`, `Thêm mục`, `Phát hành tất cả`; `/admin/audit` hiển thị trang owner-only
  với 93 sự kiện. Commit `f4707b4` thêm trạng thái `Đang kiểm tra quyền…` trong
  thời gian chờ session; lượt reload Chrome đã quan sát được trạng thái này và
  sau đó owner trở về đúng quyền chỉnh sửa.
- Version staging `379d20d7-44d2-40ee-a603-2890ba7515fb` đã upload và promote
  100%; preview/public smoke `/`, `/san-pham`, `/gui-yeu-cau`, `/thue-gia-cong`,
  `/tin-tuc` đều HTTP `200`. `qa:ux` pass 5/5 route, toàn bộ action, 0 console
  error, 0 HTTP 4xx/5xx, 0 overflow và axe không có serious/critical violation;
  còn 1 warning `postMessage` từ Google Maps iframe bên thứ ba.
- Local release gate sau hardening đạt focused admin UI `12/12`, full admin
  `179/179`, các suite khác, lint, typecheck và build đều exit `0`. Production
  Worker/D1/R2 không bị thay đổi; role matrix nhiều identity, write/read-back
  bằng identity thật, backup/restore và production promotion vẫn mở.

## Admin bulk retry boundary — 2026-09-02

- Commit `d63c7ec` đã harden ba bulk action còn lại ở UI: News publish/unpublish,
  Services archive và CMS publish-all. UI chặn nhấn đúp; khi lỗi mạng/5xx,
  lần retry giữ cùng request ID và đúng fingerprint item/revision; lỗi 4xx hoặc
  success mới xóa marker để thao tác kế tiếp có request mới.
- Focused contract `18/18`; full gate đã in pass cho toàn bộ admin `179/179`,
  các suite contact/catalog/service/commerce/listing/detail, lint, typecheck và
  build. Wrapper Windows cần dừng thủ công sau khi output hoàn tất nên không xem
  mã dừng của wrapper là bằng chứng riêng.
- Version staging `379d20d7-44d2-40ee-a603-2890ba7515fb` đã upload và promote
  100%; rollback point `278030a5-c21b-423f-b443-7f2ad4834b76`. Public UX audit
  đúng host `https://staging.kienhieu.id.vn` pass 5/5 route, action pass, 0
  console error, 0 HTTP 4xx/5xx, 0 overflow, axe 5/5 không có serious/critical;
  warning duy nhất là iframe Google Maps bên thứ ba.

## Dashboard metric và authenticated lead round-trip — 2026-09-02

- Commit `8652130` sửa `getAdminOverview`: “Sản phẩm bản nháp” chỉ đếm product
  có `product_admin_meta.status IN ('draft', 'review')`; không còn dùng nhầm
  `products.is_active = 1`. Regression `scripts/admin-dashboard.test.mts` đã
  được thêm vào `test:admin` và full admin gate đạt `186/186`.
- Version staging `d1d270a8-52d5-4a8b-a988-daa21e8fdfa3` đã promote 100%; version
  `14a6e3c9-7a4f-46a2-b8a0-c6eaf827647c` còn tồn tại làm rollback point. Chrome
  với Access identity owner đọc lại dashboard: tổng `12`, active `10`, draft
  `0`.
- Trên lead QA `QA-STAGING staging-path`, owner đã thực hiện có kiểm soát
  `Mới tiếp nhận → Đã xác thực → Mới tiếp nhận`. Inbox đọc lại đúng trạng thái
  cuối; `/admin/audit` đọc hai event `admin_lead_audit`, revision `1 → 2` và
  `2 → 3`, cùng actor subject và request ID. Dữ liệu cuối được khôi phục như
  trước kiểm thử; đây chỉ là evidence cho lead domain, không thay thế
  write/read-back mọi domain hoặc role matrix nhiều identity.
- Public `https://staging.kienhieu.id.vn/` vẫn HTTP `200` và không có admin
  control; request chưa xác thực tới admin staging vẫn HTTP `302` về Access;
  staging D1 báo không còn migration pending. Production không bị thay đổi.

## Owner route matrix và public deep QA — 2026-09-02

- Chrome với Access identity `qtu1053@gmail.com` đã điều hướng qua đủ 10 route
  admin canonical trên `admin-staging.kienhieu.id.vn`; các URL giữ đúng route
  và trang trả title `Khu vực vận hành | Giacong.vn`. Đây chỉ là owner
  navigation/read-only evidence.
- `node scripts/qa-deep-staging.mjs` chạy trên staging hiện hành pass toàn bộ
  mobile/tablet/desktop route checks, HTTP 200/no-overflow, catalog controls,
  product detail mobile stacking, cart localStorage, request route và keyboard
  reachability. Không submit lead và không mutate D1/R2.
- Chưa suy diễn từ evidence này rằng các role khác đã pass, mọi domain đã
  write/read-back, hay production đã sẵn sàng.

## CMS draft isolation round-trip — 2026-09-02

- Owner staging đã đổi tạm setting `brand_tagline` sang một giá trị QA và lưu
  draft; `/` public vẫn đọc `Giải pháp gia công toàn diện chuyên nghiệp` và
  không lộ giá trị draft.
- Owner đã lưu lại đúng giá trị ban đầu. Admin đọc lại trạng thái
  `Published/Đã đồng bộ`, không còn draft treo; đây là write/read-back có hoàn
  nguyên cho setting, không phải bằng chứng publish/preview đầy đủ, role matrix
  nhiều identity hay production readiness.

## Navigation draft isolation round-trip — 2026-09-02

- Owner staging đã đổi tạm nhãn item `Home` thành giá trị QA và lưu draft;
  public vẫn hiển thị `Home`, không lộ draft.
- Nhãn ban đầu `Home` đã được lưu lại; admin đọc lại item ở trạng thái
  `Published`, không còn draft. Đây chưa phải bằng chứng publish-all, các item
  navigation khác, role matrix nhiều identity hoặc production readiness.

## News draft create/delete round-trip — 2026-09-02

- Owner staging đã tạo một bài nháp QA với slug riêng, danh sách admin đọc lại
  đúng một record và public `/tin-tuc` vẫn hiển thị empty state vì chưa publish.
- Bản ghi QA đã được xóa qua confirm dialog; danh sách admin trở về `0 bài
  viết`. Không còn dữ liệu thử; publish/cover-media, các role khác và production
  readiness vẫn chưa được suy diễn.

## Audit read-back sau staging round-trips — 2026-09-02

- `/admin/audit` đọc lại `103 sự kiện`. Các event mới nhất gồm
  `admin_news_audit` cho bài QA, `admin_navigation_audit` cho item `home` và
  `admin_site_setting_audit` cho `brand_tagline`; mỗi event hiển thị actor,
  action, revision và request ID, không hiển thị payload nội dung.
- Đây là bằng chứng audit cho các phép thử owner staging vừa thực hiện, không
  thay thế consistency audit/write-read-back của mọi domain hoặc role matrix.
