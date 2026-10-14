# Bàn giao production – giacong.vn / kienhieu.id.vn

## Vị trí mã nguồn
- Repo: `https://github.com/hieu-kiien/giacong.vn.git`, nhánh `master`.
- Ứng dụng: `apps/giacong-lean-commerce` (Next.js 16.3.8 + OpenNext Cloudflare 1.20.10).
- Worker production: `giacong-vn` (version đang chạy: `679177ec-6d55-403e-a1f2-60707888faa9`). D1: `giacong-vn-catalog`. R2: `giacong-vn-product-media`.

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
- Đã đặt đủ: `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `CUSTOMER_EMAIL_FROM`.
- Luồng Google: production dùng OAuth client **Kienhieu Staging Web** (đã khai báo URI `https://kienhieu.id.vn/api/auth/callback/google` và `https://admin.kienhieu.id.vn/api/auth/callback/google`) và đã kiểm thử đăng nhập Google thật thành công.
- Nếu Google báo `redirect_uri_mismatch`: thêm URI trên vào OAuth client trong Google Cloud Console.
- Email gửi qua Resend: đã kiểm thử nhận email xác minh và đăng nhập mật khẩu thành công.

## Việc còn mở (do khách hàng / chủ dự án chủ động)
- Dữ liệu kinh doanh thật (giá bán, quy cách, MOQ, ảnh chụp sản phẩm thật) và 6 trang chính sách pháp lý (`noindex`) do khách hàng tự cập nhật và xuất bản trong `/admin/`.
- Dọn dữ liệu QA trên môi trường thử nghiệm staging (nếu cần dùng lại staging).
- Tên miền cũ `https://giacong.vn`: chủ dự án cấu hình redirect về `https://kienhieu.id.vn` tại nhà đăng ký tên miền (Tenten) nếu muốn gộp traffic.

## Sao lưu
Các bản xuất D1 production trước migration/deploy (`.sql`) được lưu cục bộ trong `.runtime/` (không commit lên Git).

## Giới hạn CPU của Cloudflare (gói Free)
- Tài khoản đang ở gói **Free**: Cloudflare từ chối `limits.cpu_ms` (lỗi 100328). Worker khởi động nguội tốn 0,5-1,2 giây CPU và thỉnh thoảng vượt trần 10 ms (`exceededCpu`, lỗi 1102 / HTTP 503) trên các trang động không dùng shared cache.
- Đã giảm thiểu không tốn phí: `custom-worker.ts` phục vụ trang công khai từ cache kể cả khi bản cũ (tối đa 7 ngày, coi là mới trong 10 phút) kèm cron giữ ấm `*/2 * * * *` ghi trực tiếp vào HTML cache. Trang công khai HIT tốn ~1–3 ms CPU.
- Trang động (đăng nhập, tài khoản, admin) không lưu shared cache; nếu khách muốn triệt tiêu hoàn toàn hiện tượng tải lạnh vượt 10 ms CPU, nâng lên Workers Paid (5 USD/tháng) rồi thêm `limits: { cpu_ms: 30000 }` vào `wrangler.jsonc`.
- Sau khi sửa dữ liệu trực tiếp trong D1, đổi `PUBLIC_DOCUMENT_CACHE_VERSION` rồi deploy để xóa cache toàn cục.

## Bảo mật dependency (đã xử lý)
- Đã nâng cấp lên **Next.js 16.3.8** và **OpenNext Cloudflare 1.20.10**; `npm audit --omit=dev` đạt **0 lỗ hổng bảo mật** (0 vulnerabilities) và cổng kiểm tra audit trong `.github/workflows/ci-cloudflare.yml` đã bật chặn tự động.

## Ghi chú vận hành bổ sung (12–14/10/2026)
- Đăng nhập Google production dùng OAuth client **Kienhieu Staging Web** (dự án Google Cloud `giacong-vn-staging-auth`); đã thử đăng nhập Google thật trên production: thành công.
- `npx opennextjs-cloudflare upload` KHÔNG tự build lại Next: luôn chạy `npm run cf:build` trước, rồi mới `upload`, canary (`wrangler versions deploy`) và chuyển 100%.
- Thẻ chia sẻ Facebook/Zalo (`og:*`, `twitter:card`) lấy từ cài đặt: ảnh bìa, rồi logo, rồi favicon (bỏ qua SVG). Nên đặt ảnh bìa raster 1200x630 trong admin.
- Cron giữ ấm `*/2 * * * *` (`scheduled` trong `custom-worker.ts`) giúp giảm 503 do khởi động nguội trên gói Free.
- Menu chính lấy từ bảng `site_navigation_items` (không phải giá trị mặc định trong mã).

## Giám sát và xác minh (12–14/10/2026)
- UptimeRobot (gói Free, đăng nhập Google qtu1053@gmail.com): monitor HTTP `https://kienhieu.id.vn/`, trạng thái Up, cảnh báo qua email tài khoản.
- Đăng ký bằng mật khẩu đã kiểm thử thật: nhận email xác nhận, bấm liên kết, `emailVerified=1`, đăng nhập mật khẩu thành công (tài khoản thử đã xóa).
- Email xác nhận hiện gửi từ `no-reply@auth.staging.kienhieu.id.vn`; nên đổi `CUSTOMER_EMAIL_FROM` sang tên miền chính khi cần.
- Trang chủ dùng `force-dynamic` và `open-next.config.ts` dùng `memoryQueue` để không phục vụ nội dung prerender cũ.
