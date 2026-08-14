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

## Blocker kế tiếp

Lean V1 cần một Bagisto origin mà Cloudflare Worker có thể gọi server-to-server. Hiện:

- `admin-staging.kienhieu.id.vn` trả Cloudflare challenge HTTP 403 cho `/` và các path `/api/b2b/...` khi gọi máy-máy từ GitHub Actions.
- Chưa có Cloudflare Tunnel được phát hiện trong account.
- `BAGISTO_API_URL` và `BAGISTO_PROXY_ORIGIN` chưa được cấu hình cho bản OpenNext staging mới.

Vì vậy chưa được activate bản OpenNext mới trên `giacong-vn-staging` cho tới khi Bagisto private/service origin được thiết lập và catalog/cart integration smoke test đạt.

## Quyền API token hiện tại

Token GitHub Actions đã được xác minh có thể:

- xác thực account/zone;
- đọc và upload Worker versions;
- đọc D1 metadata;
- đọc R2 bucket metadata;
- đọc Cloudflare Tunnel list.

Token hiện không đọc được DNS records hoặc Workers Routes bằng API, trả authentication error cho hai endpoint đó. Nếu cần audit tự động các phần này, bổ sung quyền read tương ứng; không cần Global API Key.

## Quy tắc an toàn tiếp theo

1. Không chạm `giacong-vn` production.
2. Không activate version OpenNext mới trên `giacong-vn-staging` khi `/san-pham` chưa đọc canonical Bagisto thành công.
3. Giữ D1/R2 staging bindings hiện hữu cho tới khi migration có quyết định loại bỏ rõ ràng.
4. Bước tiếp theo là xác định/thiết lập Bagisto private origin, ưu tiên Cloudflare Tunnel hoặc private service path phù hợp với runtime PHP/container hiện có.
