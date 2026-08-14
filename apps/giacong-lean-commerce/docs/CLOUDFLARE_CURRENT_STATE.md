# Cloudflare current state — 2026-08-14

Tài liệu này ghi lại bằng chứng runtime đã xác minh trong quá trình chuyển Lean V1 sang Cloudflare Workers. Đây là hồ sơ hiện trạng, không thay thế `COMMERCE_PLATFORM_MASTER_PLAN.md` hay `CLOUDFLARE_DEPLOYMENT.md`.

## Hạ tầng đã xác minh

- Production domain đã chốt: `kienhieu.id.vn`.
- Worker production hiện có: `giacong-vn`.
- Worker staging hiện có: `giacong-vn-staging`.
- Turnstile helper Worker hiện có: `turnstile-siteverify-kienhieu`.
- Staging đang phục vụ 100% traffic từ version `b4693784-d4c4-4659-83ca-1e13b02a6177`; quá trình migration hiện tại chưa thay active staging deployment.
- Active staging Worker có các text bindings `ADMIN_HOSTNAME`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SITEVERIFY_URL` và `ASSETS`.
- Active staging Worker còn có các Cloudflare data bindings cũ:
  - D1 `GIACONG_VN_CATALOG` → database `giacong-vn-catalog-staging`, id `981b5d5e-bba9-4f7e-9e1e-a15e379cd095`, hiện có 6 tables.
  - R2 `GIACONG_VN_PRODUCT_MEDIA` → bucket `giacong-vn-product-media-staging`.
  - R2 `NEXT_INC_CACHE_R2_BUCKET` → bucket `giacong-vn-next-cache-staging`.
- `wrangler.jsonc` giữ các D1/R2 bindings này trong `env.staging` để migration không vô tình tháo tài nguyên đang tồn tại. Chúng là compatibility/legacy bindings; source-of-truth mục tiêu của Lean V1 vẫn theo Master Plan hiện hành.
- Cloudflare Tunnel API hiện trả về danh sách rỗng: chưa có Tunnel trong account được API token hiện tại nhìn thấy.

## Bằng chứng staging an toàn

Một bản OpenNext mới đã được upload dưới dạng **version không nhận traffic**. Sau khi sửa homepage để không đọc filesystem Node ở runtime Cloudflare, preview mới xác minh:

- `/` → HTTP 200.
- `/gui-yeu-cau` → HTTP 200.
- `/thue-gia-cong` → HTTP 200.
- `/san-pham` → HTTP 500 vì Lean V1 production path yêu cầu `BAGISTO_API_URL` nhưng staging Worker chưa có Bagisto origin phù hợp.

Không có traffic nào được chuyển từ active staging version sang bản OpenNext mới trong các phép thử này.

## Hiện trạng backend/catalog cũ

Active staging Worker hiện tại trả `/san-pham` HTTP 200 và hiển thị 10 sản phẩm, nhưng `/api/b2b/catalog/categories` và `/api/b2b/catalog/products` trên chính Worker đó trả 404. Cùng với binding D1 `GIACONG_VN_CATALOG`, điều này là bằng chứng rằng staging hiện hữu đang dùng kiến trúc Cloudflare-native cũ, không phải contract Bagisto B2B của Lean V1 hiện tại.

Không được vì vậy đổi source-of-truth của Lean V1 sang D1 một cách ngầm định. Master Plan hiện hành vẫn khóa Bagisto là canonical source cho catalog, variant, giá, tồn, MOQ, quantity step, threshold và nội dung CMS được chọn quản trị.

## Quyền API token đã xác minh lại

Token `dry-boat-b034` hiện `active`, không có ngày hết hạn và có **2 policy**:

- Account policy: 273 permission groups cho toàn account.
- Zone policy: 90 permission groups cho riêng zone `kienhieu.id.vn`, trong đó có `DNS Read/Write`, `Workers Routes Read/Write`, `Zone Read/Write` và các quyền zone khác.

Sau khi bổ sung zone policy, API thực tế đã xác minh:

- DNS records của `kienhieu.id.vn` đọc thành công (`success: true`).
- Workers Routes của zone đọc thành công (`success: true`).
- D1, R2, Worker versions và Cloudflare Tunnel API vẫn đọc được như trước.

Không còn blocker về quyền Cloudflare API cho việc audit hạ tầng hiện tại.

## DNS và Workers Routes hiện tại

Các record liên quan đã xác minh:

- `kienhieu.id.vn` → A `13.67.69.121`, proxied qua Cloudflare.
- `admin.kienhieu.id.vn` → AAAA `100::`, proxied qua Cloudflare.
- `admin-staging.kienhieu.id.vn` → AAAA `100::`, proxied qua Cloudflare.

Workers Routes hiện có đúng 2 route:

- `kienhieu.id.vn/*` → `giacong-vn`.
- `admin.kienhieu.id.vn/*` → `giacong-vn`.

Hiện không có Workers Route cho `admin-staging.kienhieu.id.vn`.

## Kiểm tra origin trực tiếp

Đã thử bypass Cloudflare và kết nối trực tiếp tới `13.67.69.121` với SNI/Host là `admin.kienhieu.id.vn` và `admin-staging.kienhieu.id.vn`. TLS handshake thất bại vì certificate tại origin không có SAN phù hợp với hai hostname này. Do đó không thể coi `13.67.69.121` là một Bagisto HTTPS origin hợp lệ cho hai hostname trên nếu chưa cấu hình lại TLS/origin routing.

## Blocker kế tiếp

Lean V1 cần một Bagisto origin mà Cloudflare Worker có thể gọi server-to-server. Hiện:

- `admin-staging.kienhieu.id.vn` qua Cloudflare trả HTTP 403 cho `/` và các path `/api/b2b/...` khi gọi máy-máy.
- Chưa có Cloudflare Tunnel được phát hiện trong account.
- Direct HTTPS tới `13.67.69.121` với hostname admin/admin-staging không hợp lệ do TLS certificate mismatch.
- `BAGISTO_API_URL` và `BAGISTO_PROXY_ORIGIN` chưa được cấu hình cho bản OpenNext staging mới.

Vì vậy chưa được activate bản OpenNext mới trên `giacong-vn-staging` cho tới khi Bagisto private/service origin được thiết lập và catalog/cart integration smoke test đạt.

## Quy tắc an toàn tiếp theo

1. Không chạm `giacong-vn` production.
2. Không activate version OpenNext mới trên `giacong-vn-staging` khi `/san-pham` chưa đọc canonical Bagisto thành công.
3. Giữ D1/R2 staging bindings hiện hữu cho tới khi migration có quyết định loại bỏ rõ ràng.
4. Bước tiếp theo là thiết lập Bagisto private origin, ưu tiên Cloudflare Tunnel hoặc một HTTPS service origin có TLS hợp lệ và không bị browser challenge trên đường server-to-server.
