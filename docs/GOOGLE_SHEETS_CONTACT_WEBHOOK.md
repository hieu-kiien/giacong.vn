# Webhook liên hệ Google Sheets

Template [google-apps-script-contact-webhook.gs](google-apps-script-contact-webhook.gs) nhận JSON từ `POST /api/contact` và lưu vào tab `Yêu cầu`. Nếu tab chưa có, script tạo đúng 15 cột A:O: `Mã`, `Thời gian`, `Loại`, `Sản phẩm/Dịch vụ`, `Biến thể`, `Số lượng`, `Họ tên`, `Điện thoại`, `Email`, `Nội dung`, `Nguồn`, `Trạng thái`, `Người phụ trách`, `Ghi chú`, `Cập nhật lần cuối`.

Mỗi submit được server chấp nhận tạo một `Mã` và dòng mới. Server tự gán `request_type`; Apps Script ghi giá trị canonical vào C:F, `Mới` vào L, để trống M:N và ghi timestamp vào B:O. `Số lượng` là số hoặc rỗng. Các text do request cung cấp vẫn được ép text an toàn để không chạy công thức Sheet.

Tab thứ hai `Chi tiết giỏ hàng` cho submit giỏ nhiều dòng là **Cần làm**, chưa có trong template hiện tại. Theo [COMMERCE_PLATFORM_MASTER_PLAN.md](./COMMERCE_PLATFORM_MASTER_PLAN.md), tab này khóa theo `Mã` của dòng `Yêu cầu`, mang các cột `Mã | Dòng | Sản phẩm | Biến thể | Đơn vị | Số lượng | Đơn giá | Thành tiền | Ghi chú hệ thống`, do server/Apps Script ghi toàn bộ, được bảo vệ toàn cột và không mang trạng thái hay người phụ trách. Khi triển khai, schema 15 cột A:O của `Yêu cầu` không đổi; submit giỏ nhiều dòng ghi `Giỏ hàng (N dòng)` vào D và để trống E:F.

## Thiết lập thủ công

1. Tạo Google Sheet của đội ngũ, mở **Extensions → Apps Script** và dán template.
2. **Production bắt buộc đặt secret:** thêm Script Property `WEBHOOK_SECRET`; đặt đúng cùng giá trị trong biến môi trường Next.js. Code vẫn hỗ trợ secret trống cho local/test theo quyết định Lean V1, nhưng không được dùng cấu hình đó ở production.
3. Deploy **Web app**, chạy dưới tài khoản sở hữu sheet, cấp quyền ghi sheet và chọn quyền truy cập cho phép request **không đăng nhập** (webhook không có phiên Google). Secret ở bước 2 là lớp bảo vệ bắt buộc cho deployment public này.
4. Sao chép URL `/exec` rồi đặt `GOOGLE_SHEETS_WEBHOOK_URL`. Chỉ dùng URL HTTPS của `script.google.com` hoặc `script.googleusercontent.com`; không đưa URL hoặc secret vào mã nguồn hay biến `NEXT_PUBLIC_*`.
5. Gửi một form liên hệ thử và kiểm tra dòng mới có trạng thái `Mới` trong tab `Yêu cầu`.

Template kiểm tra cơ bản tên, điện thoại, email và contract context do server gửi; đồng thời ép mọi dữ liệu text thành text an toàn trước khi ghi Sheet để không thực thi công thức bắt đầu bằng `=`, `+`, `-` hoặc `@`. Next.js chỉ chấp nhận phản hồi JSON chính xác dạng `{ "ok": true, "reference": "..." }`. Khi thay đổi deployment hoặc secret, cập nhật biến môi trường trên host rồi redeploy Next.js.

## Thiết lập vận hành bởi owner

Sau khi dán script, owner chạy một lần `setupRequestWorkbook()` trong Apps Script. Hàm này tạo/làm mới validation cho `Loại` và `Trạng thái`, bảo vệ sheet với vùng L:N là vùng vận hành, và tạo `Tổng quan` với hai số đếm. `onEdit(event)` là simple trigger cho sửa một ô L:N: kiểm tra transition trạng thái, yêu cầu người phụ trách khi rời `Mới`, rồi cập nhật cột O.

Checklist trước bàn giao: owner chạy setup, cấp quyền/deploy Web app, thử intake và một transition hợp lệ, kiểm tra protection/validation/Tổng quan, rồi xác nhận tài khoản Google/Workspace của khách là bên kiểm soát cuối. Protection không phải biện pháp bảo mật tuyệt đối: owner có thể override hoặc gỡ protection. Với tài khoản work/school, chuyển owner chỉ trong cùng tổ chức; khi không chuyển trực tiếp được cần copy/migration/redeploy dưới tài khoản khách. Các việc authorization trigger thực, chuyển ownership/migration và live verification vẫn **Chờ xác nhận** cho tới khi làm trong Google account của user/khách. [Google Sheets protections](https://support.google.com/docs/answer/1218656?hl=en-gb), [Google Drive ownership](https://support.google.com/drive/answer/2494892?hl=en-IN), [Apps Script triggers](https://developers.google.com/apps-script/guides/triggers/).
