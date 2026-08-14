# Cloudflare current state — 2026-08-14

Hồ sơ này ghi bằng chứng runtime đã xác minh trong quá trình chuyển Lean V1 sang Cloudflare-native.

## Hạ tầng đã xác minh

- Production domain: `kienhieu.id.vn`.
- Worker production: `giacong-vn`.
- Worker staging: `giacong-vn-staging`.
- Turnstile helper Worker: `turnstile-siteverify-kienhieu`.
- Staging hiện có D1 `GIACONG_VN_CATALOG` → `giacong-vn-catalog-staging` (`981b5d5e-bba9-4f7e-9e1e-a15e379cd095`).
- Staging có R2 `GIACONG_VN_PRODUCT_MEDIA` → `giacong-vn-product-media-staging`.
- Staging có R2 `NEXT_INC_CACHE_R2_BUCKET` → `giacong-vn-next-cache-staging`.
- Không có Cloudflare Tunnel và kiến trúc đích không cần Tunnel/VPS.
- Bagisto từng được thử nghiệm bằng Docker nhưng không phải production backend.

## Quyền Cloudflare API

Token GitHub Actions đã xác minh active và có đủ scope account + zone để audit/deploy hạ tầng cần thiết. DNS records và Workers Routes đã đọc thành công bằng API thật. Không còn blocker về quyền Cloudflare.

## DNS và routes hiện tại

- `kienhieu.id.vn` có A record proxied tới `13.67.69.121`; public traffic thực tế được Worker route `kienhieu.id.vn/*` đưa vào `giacong-vn`.
- `admin.kienhieu.id.vn/*` cũng route vào `giacong-vn`.
- `admin-staging.kienhieu.id.vn` có DNS proxied nhưng chưa có Worker route riêng.

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

9 sản phẩm đầu là dữ liệu `B2B-DEMO-*`; sản phẩm thứ 10 là dữ liệu test thủ công. Một variant của `nuoc-mam-cot-pha-loang` đang unavailable. Tier price, MOQ, quantity step và contact threshold đã có đủ dữ liệu để Worker tính canonical request cart.

## Migration code đang thực hiện

Nhánh `cloudflare-d1-catalog` chuyển các đường runtime sau khỏi Bagisto:

- `/san-pham` → D1
- product detail → D1
- commerce mega-menu → D1
- `/api/catalog/products/[slug]` → D1
- cart revalidation/submit canonical resolver → D1
- managed service copy → D1 khi có row, fallback static khi table chưa có dữ liệu
- `/media/*` → R2

`next.config.ts` không còn Bagisto proxy rewrites trong nhánh migration.

## Bằng chứng OpenNext trước migration D1

Một OpenNext version mới trước đây đã được upload nhưng không nhận traffic. `/`, `/gui-yeu-cau` và `/thue-gia-cong` trả 200; `/san-pham` khi đó 500 vì code còn đòi Bagisto URL. Active staging traffic không bị đổi.

Mục tiêu của nhánh hiện tại là loại blocker đó bằng cách đọc binding D1 trực tiếp.

## Cổng kế tiếp

1. Quality gate của PR phải xanh.
2. Merge vào master.
3. Master Cloudflare staging gate phải xanh.
4. Upload version staging mới không nhận traffic.
5. Preview smoke test D1 listing/detail/cart và R2 media.
6. Nếu đạt, promotion sang active `giacong-vn-staging`.
7. QA staging.
8. Sau đó mới thiết kế/tạo production D1/R2 và migration dữ liệu production; tuyệt đối chưa chạm production Worker trước cổng này.
