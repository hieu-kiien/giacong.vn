# Bàn giao production – giacong.vn / kienhieu.id.vn

## Vị trí mã nguồn
- Repo: `https://github.com/hieu-kiien/giacong.vn.git`, nhánh `codex/staging-acceptance`.
- Ứng dụng: `apps/giacong-lean-commerce` (Next.js 16.3.4 + OpenNext Cloudflare 1.20.5).
- Worker production: `giacong-vn`. D1: `giacong-vn-catalog`. R2: `giacong-vn-product-media`.

## Trạng thái production
- Đã áp dụng đủ 38 migration D1.
- Danh mục: 8 sản phẩm hiển thị, 15 quy cách, 45 mức giá, ảnh đã có trong R2.
- Zalo trỏ đúng `0868408115`; trang tài khoản hoạt động; nhãn giao diện tiếng Việt.
- Lịch sử tài khoản giới hạn 50 yêu cầu và 50 giao dịch gần nhất.
- Lưu sản phẩm/dịch vụ có xóa cache storefront; khóa cache toàn cục là `PUBLIC_DOCUMENT_CACHE_VERSION` trong `custom-worker.ts`
  (đổi giá trị rồi deploy để xóa toàn bộ cache HTML).

## Quy trình build và deploy
1. Chuẩn bị D1 local: `npm run db:local:bootstrap` rồi `npx wrangler d1 migrations apply GIACONG_VN_CATALOG --local`.
2. `npm run cf:build` (4–5 phút).
3. Canary: `npx opennextjs-cloudflare upload`, `npx wrangler versions deploy "<cũ>@99%" "<mới>@1%" --name giacong-vn --yes`,
   kiểm tra bằng header `Cloudflare-Workers-Version-Overrides: giacong-vn="<mới>"`, rồi nâng lên 100%.
4. Hoàn tác: `npx wrangler rollback <phiên bản> --name giacong-vn --yes`.

## Secret production
- Đã đặt đủ: `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `CUSTOMER_EMAIL_FROM` (giá trị Google/Resend dùng chung với staging).
- Luồng Google: production trả địa chỉ chuyển hướng `https://kienhieu.id.vn/api/auth/callback/google` và Google chấp nhận yêu cầu (302 sang trang đăng nhập). Chưa thử đăng nhập thật bằng tài khoản Google.
- Nếu Google báo `redirect_uri_mismatch`: thêm URI trên vào OAuth client trong Google Cloud Console.
- Email gửi qua Resend: cần domain gửi đã xác minh trong Resend; chưa thử gửi email thật từ production.

## Việc còn mở
- Next 16.4.0 làm mọi trang trả 500 trên OpenNext hiện tại (`loadManifest preview-props.json`), nên đang giữ 16.3.4;
  `npm audit --omit=dev` còn 1 lỗ hổng nghiêm trọng của Next. Cần thử lại khi OpenNext phát hành bản sửa.
- 3 lead QA trên staging ở trạng thái `failed` (Google Sheets 502/503); gửi lại bằng nút trong admin.
- Dọn dữ liệu QA trên staging (20 sản phẩm thử, số điện thoại `0000000000`).
- Chưa có số đo hiệu năng cuối; không khẳng định hết lag.
- Thông tin địa chỉ/giá/nội dung do khách hàng tự chỉnh trong admin.

## Sao lưu
Thư mục `backups/` (không commit) chứa bản xuất D1 production trước khi di chuyển và trước khi chép danh mục.

## Giới hạn CPU của Cloudflare (gói Free)
- Tài khoản đang ở gói **Free**: Cloudflare từ chối `limits.cpu_ms` (lỗi 100328). Worker khởi động nguội tốn 0,7-1,2 giây CPU và thỉnh thoảng vượt trần (`exceededCpu`, HTTP 503).
- Đã giảm thiểu không tốn phí: `custom-worker.ts` phục vụ trang công khai từ cache kể cả khi bản cũ (tối đa 7 ngày, coi là mới trong 10 phút) và làm mới ngầm; làm mới thất bại thì giữ bản cũ. Đo với `Accept: text/html`: 60/60 lần 200, trung vị 70-92 ms cho `/`, `/san-pham/`, `/lien-he/`.
- Trang động (đăng nhập, tài khoản, admin) không lưu cache, khoảng 0,6 giây; yêu cầu đầu tiên sau lúc rảnh vẫn có thể gặp khởi động nguội. Nâng lên Workers Paid (khoảng 5 USD/tháng) là cách dứt điểm nếu khách muốn, rồi thêm `limits: { cpu_ms: 30000 }` vào `wrangler.jsonc`.
- Sau khi sửa dữ liệu trực tiếp trong D1, đổi `PUBLIC_DOCUMENT_CACHE_VERSION` rồi deploy để xóa cache toàn cục.

## Cảnh báo bảo mật của Next 16.3.4 (đã đánh giá mức ảnh hưởng)
- `npm audit --omit=dev` báo mức nghiêm trọng cho Next 16.0.0-16.3.7; bản sửa là 16.4.0 nhưng bản này làm mọi trang trả 500 trên OpenNext 1.20.10 (`loadManifest preview-props.json`).
- Mã nguồn không dùng `next/og`/`ImageResponse` (lỗi thực thi mã từ xa), `use cache`, `draftMode` hay `cacheComponents` (lỗi rò rỉ Draft Mode); chỉ dùng `unstable_cache`. Lỗi ở máy chủ phát triển (MCP) không áp dụng cho production.
- Cảnh báo cache poisoning ISR/SSG nêu cho Next tự lưu trữ; ứng dụng chạy trên Cloudflare Workers với lớp cache riêng (khóa theo URL đã chuẩn hóa, bỏ qua yêu cầu có Cookie/Authorization), nên chưa chứng minh bị ảnh hưởng nhưng chưa thể loại trừ hoàn toàn.
- Việc cần làm: khi OpenNext phát hành bản chạy được với Next 16.4+, nâng cấp, chạy canary, rồi bật lại bước `npm audit --omit=dev` chặn trong `.github/workflows/ci-cloudflare.yml` (đang `continue-on-error`).

## Ghi chú vận hành bổ sung (12/10/2026)
- Đăng nhập Google production dùng OAuth client **Kienhieu Staging Web** (dự án Google Cloud `giacong-vn-staging-auth`); client này đã được thêm URI `https://kienhieu.id.vn/api/auth/callback/google` và `https://admin.kienhieu.id.vn/api/auth/callback/google`. Đã thử đăng nhập Google thật trên production: thành công. Client `Kienhieu Production Web` chưa được dùng (cần secret của nó nếu muốn tách).
- `npx opennextjs-cloudflare upload` KHÔNG tự build lại Next: luôn chạy `npm run cf:build` trước, rồi mới `upload`, canary (`wrangler versions deploy`) và chuyển 100%.
- Thẻ chia sẻ Facebook/Zalo (`og:*`, `twitter:card`) lấy từ cài đặt: ảnh bìa, rồi logo, rồi favicon (bỏ qua SVG). Nên đặt ảnh bìa raster 1200x630 trong admin.
- Cron giữ ấm `*/2 * * * *` (`scheduled` trong `custom-worker.ts`) giúp giảm 503 do khởi động nguội trên gói Free.
- Menu chính lấy từ bảng `site_navigation_items` (không phải giá trị mặc định trong mã).
