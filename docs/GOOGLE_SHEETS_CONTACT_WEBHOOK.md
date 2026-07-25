# Webhook liên hệ Google Sheets

Template [google-apps-script-contact-webhook.gs](google-apps-script-contact-webhook.gs) nhận JSON từ `POST /api/contact` và lưu vào sheet `Yeu cau`. Nếu sheet chưa có, script tự tạo với các cột: `Mã`, `Thời gian`, `Họ tên`, `Điện thoại`, `Email`, `Nội dung`, `Nguồn`, `Trạng thái`.

## Thiết lập thủ công

1. Tạo Google Sheet của đội ngũ, mở **Extensions → Apps Script** và dán template.
2. Nếu cần bảo vệ webhook, thêm Script Property `WEBHOOK_SECRET`; đặt đúng cùng giá trị trong biến môi trường Next.js. Nếu không đặt cả hai nơi, webhook vẫn hoạt động không có khóa chia sẻ.
3. Deploy **Web app**, chạy dưới tài khoản sở hữu sheet và cấp quyền ghi sheet; chọn phạm vi truy cập phù hợp với môi trường triển khai.
4. Sao chép URL `/exec` rồi đặt `GOOGLE_SHEETS_WEBHOOK_URL`. Chỉ dùng URL HTTPS của `script.google.com` hoặc `script.googleusercontent.com`; không đưa URL hoặc secret vào mã nguồn hay biến `NEXT_PUBLIC_*`.
5. Gửi một form liên hệ thử và kiểm tra dòng mới có trạng thái `Mới` trong sheet.

Next.js chỉ chấp nhận phản hồi JSON chính xác dạng `{ "ok": true, "reference": "..." }`. Khi thay đổi deployment hoặc secret, cập nhật biến môi trường trên host rồi redeploy Next.js.
