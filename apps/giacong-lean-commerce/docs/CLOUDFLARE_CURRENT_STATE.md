# Cloudflare current state — 2026-08-15

Hồ sơ này ghi **bằng chứng runtime đã xác minh** qua GitHub Actions/Cloudflare API và trạng thái implementation trên branch staging-only. Đây là evidence log, không phải nơi quyết định scope. Scope/roadmap nằm ở `CLOUDFLARE_NATIVE_V1_PLAN.md`.

## 1. Platform baseline

- Lean V1 runtime/deployment target: **Cloudflare only**.
- Production hostname: `kienhieu.id.vn`.
- Production Worker: `giacong-vn`.
- Staging Worker: `giacong-vn-staging`.
- Turnstile helper Worker: `turnstile-siteverify-kienhieu`.
- Không có Cloudflare Tunnel đang hoạt động trong audit gần nhất.
- Không dùng VPS/PHP origin/Bagisto làm commerce runtime.
- Vercel không thuộc runtime/deployment target; legacy preview integration `giacong-vn-demo` cần cleanup riêng ở tài khoản Vercel.

## 2. GitHub Actions → Cloudflare API

Repo có Cloudflare credentials dưới GitHub Actions Secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Workflow token-identity đã xác minh token active và Cloudflare API trả `success: true`. Quyền đã được audit ở mức policy cho D1, Workers/R2, Workers Routes, Access, DNS và Observability.

Secret/token value **không được ghi vào tài liệu, commit hoặc log**.

GitHub Actions là cầu nối vận hành Cloudflare hiện hành. Khi cần live verification, ưu tiên đọc workflow audit thay vì suy đoán từ file cấu hình.

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

Cloudflare có thể thay active Worker version sau mỗi staging promotion. Version ID trong audit cũ chỉ là snapshot tại thời điểm đó; trước admin QA/promotion mới phải đọc lại deployment status.

## 4. DNS, routes và Access

Đã có evidence qua Cloudflare API/workflow cho staging admin DNS/route và Access policy. Production storefront route `kienhieu.id.vn/*` và production admin route `admin.kienhieu.id.vn/*` vẫn tồn tại trong hạ tầng, nhưng production admin chưa được coi là active/accepted write surface.

Không được coi route production admin hiện hữu là permission để bật production admin writes.

## 5. D1 catalog baseline

Staging D1 có:

- `categories`
- `products`
- `product_variants`
- `variant_tier_prices`
- `services`
- `d1_migrations`

Snapshot audit đã xác minh trước đây: 4 categories, 10 products, 18 variants, 54 tier-price rows, 0 managed service rows. Dataset vẫn là demo/test và **không phải production data**.

## 6. Admin server implementation state

Branch `feat/cloudflare-admin-category-api` đang triển khai server contract trước UI:

- Cloudflare Access/admission foundation: **đã có**;
- D1 audit/revision foundation: **đã có**;
- Category API: **đã triển khai**;
- Product API: **đã triển khai**;
- Variant write/validation foundation: **đã triển khai**;
- Tier-price complete replacement route `PUT /api/admin/variants/[variantId]/tier-prices`: **đã triển khai, chờ CI/runtime regression để coi là xanh**;
- R2 product media upload/list/delete contract: **đã triển khai, chờ CI/runtime regression**;
- Service-content write contract: **chưa triển khai**;
- Admin UI: **chưa bắt đầu**.

Tier replacement dùng parent variant `revision` làm concurrency token; R2 media upload dùng server-generated UUID namespace, magic-byte validation, 8 MiB file cap, reference-safe delete và request-ID idempotency.

## 7. Current CI gate

Commit mới nhất đang kích hoạt GitHub Actions:

- `CI and Cloudflare staging gate` — đang chạy;
- `GitNexus safety gate` — đang chạy.

Chưa tuyên bố `npm run check` xanh cho đến khi workflow hoàn tất. Không dùng trạng thái “in progress” làm evidence thành công.

## 8. Cleanup

Đã loại khỏi branch workflow `.github/workflows/bagisto-origin-probe-once.yml` vì nó còn probe trực tiếp origin IP của Bagisto/VPS và không còn phù hợp với Cloudflare-only architecture.

Các tài liệu legacy có giá trị lịch sử vẫn được giữ nhưng không có quyền quyết định runtime. Vercel integration nằm ngoài GitHub source và cần disable/remove ở tài khoản Vercel sau khi xác minh dependency vận hành cuối cùng.

## 9. Production safety

Chưa thay đổi production Worker `giacong-vn`, production D1/R2 hoặc production data để thực hiện admin work.

Production promotion chỉ được phép sau staging runtime acceptance, admin CRUD acceptance, production dataset approval, production D1/R2 audit, request-intake live verification, backup/rollback và smoke checklist.

## 10. Next gate

1. CI xanh cho Tier + R2 media.
2. Service-content contract sau khi đối chiếu chính xác schema/read path hiện hành.
3. Full staging admin regression và protected Cloudflare Access QA.
4. Cập nhật evidence bằng live Cloudflare audit mới.
5. Chỉ khi server contracts xanh mới bắt đầu Admin UI.
