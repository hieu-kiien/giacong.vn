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
