# Cloudflare current state — 2026-08-15

Hồ sơ này ghi **bằng chứng runtime đã xác minh** qua GitHub Actions/Cloudflare API và các gate staging của Lean V1. Đây là evidence log, không phải nơi quyết định scope. Scope/roadmap nằm ở `CLOUDFLARE_NATIVE_V1_PLAN.md`.

## 1. Platform baseline

- Lean V1 runtime/deployment target: **Cloudflare only**.
- Production hostname: `kienhieu.id.vn`.
- Production Worker: `giacong-vn`.
- Staging Worker: `giacong-vn-staging`.
- Turnstile helper Worker: `turnstile-siteverify-kienhieu`.
- Không có Cloudflare Tunnel đang hoạt động trong audit gần nhất.
- Không dùng VPS/PHP origin/Bagisto làm commerce runtime.
- Vercel không thuộc runtime/deployment target; GitHub vẫn có legacy Vercel preview integration `giacong-vn-demo`, cần cleanup riêng.

## 2. GitHub Actions → Cloudflare API

Repo có Cloudflare credentials dưới GitHub Actions Secrets và các workflow audit/deploy sử dụng chúng mà không đưa secret value vào source/log:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Workflow token-identity đã xác minh token active và Cloudflare API trả `success: true`. Quyền đã được audit ở mức policy cho các tác vụ cần thiết như D1, Workers/R2, Workers Routes, Access, DNS và Observability.

Secret/token value **không được ghi vào tài liệu, commit hoặc log**.

GitHub Actions là cầu nối vận hành Cloudflare hiện hành. Khi cần live verification, ưu tiên chạy/đọc workflow audit thay vì suy đoán từ file cấu hình.

## 3. Live staging resources đã xác minh

Staging Worker `giacong-vn-staging` tồn tại và đã phục vụ storefront qua Cloudflare.

Bindings đã xác minh:

- `GIACONG_VN_CATALOG` → D1 `giacong-vn-catalog-staging` (`981b5d5e-bba9-4f7e-9e1e-a15e379cd095`);
- `GIACONG_VN_PRODUCT_MEDIA` → R2 `giacong-vn-product-media-staging`;
- `NEXT_INC_CACHE_R2_BUCKET` → R2 `giacong-vn-next-cache-staging`;
- `ADMIN_HOSTNAME` → `admin-staging.kienhieu.id.vn`;
- Turnstile verification binding/URL hiện hữu.

Staging runtime đã được smoke test qua Cloudflare:

- `/` → HTTP 200;
- `/san-pham` → HTTP 200;
- catalog product API mới trả dữ liệu D1;
- R2 `/media/*` trả object thật;
- cart revalidation đọc lại D1 và tính canonical money;
- `admin-staging.kienhieu.id.vn` không xác thực bị edge chặn, không bypass trực tiếp Worker.

### Lưu ý về active version

Cloudflare có thể thay active Worker version sau mỗi staging promotion. Các version ID được ghi trong các audit cũ chỉ là snapshot tại thời điểm đó, không được coi là current nếu chưa có một audit mới xác nhận. Trước mỗi promotion/admin QA mới phải đọc lại deployment status và ghi version hiện hành.

## 4. DNS, routes và Access

Đã xác minh qua Cloudflare API/workflow:

- `admin-staging.kienhieu.id.vn` có DNS proxied;
- staging admin route `admin-staging.kienhieu.id.vn/*` → `giacong-vn-staging`;
- production storefront route `kienhieu.id.vn/*` → `giacong-vn`;
- production admin route `admin.kienhieu.id.vn/*` → `giacong-vn` vẫn tồn tại trong trạng thái hạ tầng cũ, nhưng production admin chưa được coi là active/accepted surface;
- Cloudflare Access có self-hosted application, allow policy và identity-provider state cho `admin-staging.kienhieu.id.vn`;
- request chưa xác thực tới staging admin bị Cloudflare edge chặn.

Không được coi route production admin hiện hữu là permission để bật production admin writes.

## 5. D1 catalog baseline

Staging D1 `giacong-vn-catalog-staging` có schema nghiệp vụ:

- `categories`
- `products`
- `product_variants`
- `variant_tier_prices`
- `services`
- `d1_migrations`

Snapshot audit đã xác minh:

- 4 categories;
- 10 products;
- 18 variants;
- 54 tier-price rows;
- 0 managed service rows tại snapshot.

Dataset hiện vẫn là demo/test và **không phải production data**.

Deep QA trước đây đã phát hiện và sửa hai contact thresholds demo không hợp lệ theo MOQ/step. Post-condition audit xác nhận staging read path trở lại xanh.

## 6. Runtime migration state

Active Cloudflare runtime dùng D1/R2 cho:

- `/san-pham`;
- product detail;
- catalog APIs;
- commerce mega-menu;
- cart revalidation/submit canonical resolver;
- `/media/*`;
- managed service copy khi có D1 row.

`next.config.ts` không còn Bagisto proxy rewrites và `.env.example` không còn Bagisto API settings.

Bagisto artifacts còn trong repository chỉ là migration/history evidence; không được xem là runtime dependency.

## 7. Admin server implementation state

Server-side admin contract đang được triển khai trên branch staging-only, trước UI:

- Cloudflare Access/admission foundation: đã có;
- D1 audit/revision foundation: đã có;
- Category API contract: đã triển khai;
- Product API contract: đã triển khai;
- Variant write/validation foundation: đã triển khai;
- Tier-price atomic replacement: chưa coi là hoàn tất cho tới khi parent revision concurrency và atomic replacement được test xanh;
- R2 media contract: chưa hoàn tất;
- Service-content write contract: chưa hoàn tất;
- Admin UI: **chưa bắt đầu**.

Không có bước nào ở trên được phép tự động suy ra production readiness.

## 8. Staging QA gate

Các runtime/storefront gates trước đây đã đạt: catalog, product detail, cart matrix, cart drift, R2 media và responsive browser QA.

Đối với admin write work hiện tại, gate mới bắt buộc:

1. `npm run check` xanh;
2. OpenNext build/package xanh;
3. D1 migration/preflight nếu schema thay đổi;
4. protected mutation qua Cloudflare Access;
5. readback storefront từ D1/R2 đúng canonical state;
6. stale-write/idempotency/conflict/media regression matrix xanh;
7. active Worker version và route được audit lại trước/sau promotion.

## 9. Production safety

Chưa thay đổi production Worker `giacong-vn`, production D1/R2 hoặc production data để thực hiện admin work.

Không copy staging demo data sang production.

Production promotion chỉ được phép sau:

- staging runtime acceptance;
- admin write + CRUD acceptance;
- production dataset được duyệt;
- production D1/R2 được tạo/audit có chủ ý;
- Google Sheet/Apps Script request intake được live-verify;
- backup/export + rollback procedure được ghi rõ;
- production smoke checklist đạt.

## 10. Vercel cleanup state

Vercel preview integration `giacong-vn-demo` đang nằm ngoài kiến trúc đích và có thể tạo failed preview deployment/email khi repo nhận commit mới. Đây không phải Cloudflare runtime failure.

Quyết định hiện hành:

- không sửa application để làm Vercel preview pass;
- không đưa Vercel trở lại delivery path;
- sau khi xác minh không còn dependency vận hành, disable/remove Vercel Git integration/project khỏi repo delivery path;
- sau cleanup, GitHub Actions + Cloudflare là đường deploy duy nhất.

## 11. Next gate

Thứ tự tiếp theo theo plan:

1. hoàn tất Tier-price atomic replacement + parent revision concurrency;
2. hoàn tất R2 media upload/reference/delete contract;
3. hoàn tất service-content contract;
4. chạy full staging admin regression;
5. cập nhật evidence này bằng live Cloudflare audit mới;
6. chỉ khi server contracts xanh mới bắt đầu Admin UI.
