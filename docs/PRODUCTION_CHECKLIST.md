# Checklist production

## Trước khi public

- Chạy storefront bằng `docker compose -f docker-compose.production.yml up -d --build`; cổng app chỉ bind `127.0.0.1`, reverse proxy là điểm public duy nhất.
- Bagisto, Redis, Elasticsearch, Kibana và Mailpit phải ở private network; không dùng Sail compose làm cấu hình production.
- Đặt `GOOGLE_SHEETS_WEBHOOK_URL`, `GOOGLE_SHEETS_WEBHOOK_SECRET` (ít nhất 32 ký tự) và Script Property `WEBHOOK_SECRET` cùng giá trị.
- Đặt rate limit tại reverse proxy/WAF theo IP cho `POST /api/contact`. Limiter trong app là lớp phụ theo fingerprint và không thay thế storage chia sẻ khi có nhiều instance.
- Thay tài khoản/mật khẩu demo Bagisto; không seed dữ liệu `B2B-DEMO` vào production.

## Smoke test sau deploy

1. Mở catalog, trang chi tiết và `/lien-he/` qua hostname public.
2. Gửi một form liên hệ và một yêu cầu giỏ; xác nhận mỗi yêu cầu có `Mã` đúng trong Sheet.
3. Gửi lại giỏ với cùng request ID và xác nhận không có dòng trùng.
4. Kiểm tra reverse proxy từ chối hoặc giới hạn burst tới `POST /api/contact`.
5. Kiểm tra không có cổng Redis, Elasticsearch, Kibana hay Mailpit lắng nghe công khai.
