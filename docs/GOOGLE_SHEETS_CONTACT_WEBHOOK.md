# Webhook liên hệ Google Sheets

Template [google-apps-script-contact-webhook.gs](google-apps-script-contact-webhook.gs) nhận JSON từ `POST /api/contact` và lưu vào sheet `Yeu cau`. Nếu sheet chưa có, script tự tạo với các cột: `Mã`, `Thời gian`, `Họ tên`, `Điện thoại`, `Email`, `Nội dung`, `Nguồn`, `Trạng thái`.

## Thiết lập thủ công

1. Tạo Google Sheet của đội ngũ, mở **Extensions → Apps Script** và dán template.
2. **Production bắt buộc đặt secret:** thêm Script Property `WEBHOOK_SECRET`; đặt đúng cùng giá trị trong biến môi trường Next.js. Code vẫn hỗ trợ secret trống cho local/test theo quyết định Lean V1, nhưng không được dùng cấu hình đó ở production.
3. Deploy **Web app**, chạy dưới tài khoản sở hữu sheet, cấp quyền ghi sheet và chọn quyền truy cập cho phép request **không đăng nhập** (webhook không có phiên Google). Secret ở bước 2 là lớp bảo vệ bắt buộc cho deployment public này.
4. Sao chép URL `/exec` rồi đặt `GOOGLE_SHEETS_WEBHOOK_URL`. Chỉ dùng URL HTTPS của `script.google.com` hoặc `script.googleusercontent.com`; không đưa URL hoặc secret vào mã nguồn hay biến `NEXT_PUBLIC_*`.
5. Gửi một form liên hệ thử và kiểm tra dòng mới có trạng thái `Mới` trong sheet.

Template kiểm tra cơ bản tên, điện thoại và email, đồng thời ép mọi dữ liệu do người dùng nhập thành text an toàn trước khi ghi sheet để không thực thi công thức bắt đầu bằng `=`, `+`, `-` hoặc `@`. Next.js chỉ chấp nhận phản hồi JSON chính xác dạng `{ "ok": true, "reference": "..." }`. Khi thay đổi deployment hoặc secret, cập nhật biến môi trường trên host rồi redeploy Next.js.
