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

Token GitHub Actions đã xác minh active và có đủ scope account + zone để audit/deploy hạ tầng cần thiết. DNS records và Workers Routes đã đọc thành công bằng API thật. Không còn blocker về quyền Cloudflare.

## DNS và routes hiện tại

- `kienhieu.id.vn` có A record proxied tới `13.67.69.121`; public traffic thực tế được Worker route `kienhieu.id.vn/*` đưa vào `giacong-vn`.
- `admin.kienhieu.id.vn/*` cũng route vào `giacong-vn` theo trạng thái hạ tầng cũ; production admin chưa được coi là active/accepted surface.
- `admin-staging.kienhieu.id.vn` có DNS proxied nhưng chưa có Worker route/admin authentication boundary đã audit.

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

Deep QA workflow đã được mở rộng để tự chạy khi storefront/runtime source, Wrangler config hoặc package contract liên quan thay đổi trên `master`; vẫn có `workflow_dispatch` để chạy lại sau data-only mutation.

## Governance Cloudflare-native

Nguồn quyết định mới là `docs/CLOUDFLARE_NATIVE_V1_PLAN.md`. `COMMERCE_PLATFORM_MASTER_PLAN.md` được giữ làm hồ sơ lịch sử Bagisto-era, không còn quyết định runtime/admin đích.

Plan mới khóa các nguyên tắc:

- D1/R2 là canonical data/media;
- Bagisto không quay lại runtime;
- Cloudflare-native admin nằm trong scope nhưng phải có auth boundary riêng và server write contract trước UI;
- request queue vẫn là Google Sheet + Apps Script cho đến quyết định riêng;
- staging là cổng bắt buộc;
- production không được dùng làm môi trường thử nghiệm.

**Production Worker `giacong-vn`, production data resources và production route `kienhieu.id.vn/*` chưa bị thay đổi bởi các bước staging/QA trên.**

## Cổng kế tiếp

Application/runtime migration và deep QA đã đạt staging. Các bước tiếp theo là:

1. Audit authentication boundary cho `admin-staging.kienhieu.id.vn`, ưu tiên Cloudflare Access nếu account/domain hỗ trợ đúng policy cần thiết.
2. Khóa server-side admin write contract cho D1/R2: validation, conflict/stale write, media policy, error mapping và auditability.
3. Xây admin staging CRUD theo thứ tự category → product → variant → tier price → media → services; không đưa request inbox vào scope này.
4. Xác minh Google Sheet/Apps Script trên account thật hoặc ra quyết định riêng nếu chuyển request inbox sang D1.
5. Chốt production taxonomy, SKU, variants, prices, MOQ, media, content và contact/trust claims.
6. Tạo/audit production D1/R2 có chủ ý và migration dataset đã duyệt; không copy demo staging ngầm định.
7. Chỉ sau acceptance admin + production data + request intake mới upload/promotion `giacong-vn` production.
