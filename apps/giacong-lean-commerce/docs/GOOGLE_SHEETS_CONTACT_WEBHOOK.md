# Webhook liên hệ Google Sheets

Template [google-apps-script-contact-webhook.gs](google-apps-script-contact-webhook.gs) nhận JSON từ `POST /api/contact` và lưu vào tab `Yêu cầu`. Nếu tab chưa có, script tạo đúng 15 cột A:O: `Mã`, `Thời gian`, `Loại`, `Sản phẩm/Dịch vụ`, `Biến thể`, `Số lượng`, `Họ tên`, `Điện thoại`, `Email`, `Nội dung`, `Nguồn`, `Trạng thái`, `Người phụ trách`, `Ghi chú`, `Cập nhật lần cuối`.

Mỗi submit được server chấp nhận tạo một `Mã` và dòng mới. Mỗi form public
tạo một `request_id` ổn định cho một lần gửi; server giữ và truyền mã này qua
queue/webhook, chỉ xóa sau phản hồi tiếp nhận bền vững để retry mạng có thể
replay cùng kết quả. Server tự gán `request_type`; Apps Script ghi giá trị
canonical vào C:F, `Mới` vào L, để trống M:N và ghi timestamp vào B:O. `Số
lượng` là số hoặc rỗng. Các text do request cung cấp vẫn được ép text an toàn
để không chạy công thức Sheet.

## Tab `Chi tiết giỏ hàng`

Template đã triển khai tab thứ hai cho submit giỏ nhiều dòng. Nó khóa theo `Mã` của dòng `Yêu cầu` và mang đúng 9 cột A:I: `Mã`, `Dòng`, `Sản phẩm`, `Biến thể`, `Đơn vị`, `Số lượng`, `Đơn giá`, `Thành tiền`, `Ghi chú hệ thống`. Toàn bộ cột do server/Apps Script ghi; `setupRequestWorkbook()` bảo vệ cả tab và **không** để vùng vận hành nào, nên administrator chỉ đọc. Không có trạng thái, người phụ trách hay công thức trong tab này; vận hành vẫn chỉ diễn ra ở L:N của `Yêu cầu`.

Nhánh giỏ được nhận khi payload có khóa `cart`. Schema 15 cột A:O của `Yêu cầu` không đổi: submit giỏ ghi `Giỏ hàng (N dòng)` vào D và để trống E:F. Đơn giá và thành tiền phải là số nguyên dương thật hoặc rỗng; chuỗi số bị từ chối cả dòng. Mọi text của chi tiết đi qua cùng lớp ép text an toàn như tab `Yêu cầu`.

Ba tính chất vận hành cần biết:

- **Thứ tự ghi.** N dòng chi tiết được ghi trước bằng một `setValues`, rồi dòng `Yêu cầu` mới được append. Dòng `Yêu cầu` là commit marker: nếu script chết giữa hai bước, kết quả là dòng chi tiết mồ côi mà operator không thấy, còn client nhận non-ok nên không có thành công giả. Thứ tự ngược lại sẽ hứa N dòng không tồn tại.
- **Lock.** `LockService.getScriptLock().tryLock(2000)` giữ toàn bộ thao tác ghi dưới ngưỡng abort 5s của Next; nếu không lấy được lock, script trả `{ ok: false }` và không ghi gì.
- **Chống retry trùng.** `CacheService` map `request_id` → `Mã` trong 6 giờ
  cho cả form thường và giỏ hàng. Gửi lại cùng `request_id` (ví dụ sau một
  `504` mà script đã kịp commit) trả lại đúng `Mã` cũ và không thêm dòng nào.
  Đây là replay protection ở tầng vận chuyển, không phải dedup engine: hai lần
  khách chủ động gửi là hai `request_id` và vẫn là hai dòng. `CacheService` có
  thể bị evict, nên backstop vận hành vẫn là `Không tiếp tục` + `Trùng mã
  <reference>`.

## Thiết lập thủ công

1. Tạo Google Sheet của đội ngũ, mở **Extensions → Apps Script** và dán template.
2. **Production bắt buộc đặt secret:** thêm Script Property `WEBHOOK_SECRET`; đặt đúng cùng giá trị trong biến môi trường Next.js. Code vẫn hỗ trợ secret trống cho local/test theo quyết định Lean V1, nhưng không được dùng cấu hình đó ở production.
3. Deploy **Web app**, chạy dưới tài khoản sở hữu sheet, cấp quyền ghi sheet và chọn quyền truy cập cho phép request **không đăng nhập** (webhook không có phiên Google). Secret ở bước 2 là lớp bảo vệ bắt buộc cho deployment public này.
4. Sao chép URL `/exec` rồi đặt `GOOGLE_SHEETS_WEBHOOK_URL`. Chỉ dùng URL HTTPS của `script.google.com` hoặc `script.googleusercontent.com`; không đưa URL hoặc secret vào mã nguồn hay biến `NEXT_PUBLIC_*`.
5. Gửi một form liên hệ thử và kiểm tra dòng mới có trạng thái `Mới` trong tab `Yêu cầu`.

Template kiểm tra cơ bản tên, điện thoại, email và contract context do server gửi; đồng thời ép mọi dữ liệu text thành text an toàn trước khi ghi Sheet để không thực thi công thức bắt đầu bằng `=`, `+`, `-` hoặc `@`. Next.js chỉ chấp nhận phản hồi JSON chính xác dạng `{ "ok": true, "reference": "..." }`. Khi thay đổi deployment hoặc secret, cập nhật biến môi trường trên host rồi redeploy Next.js.

## Thiết lập vận hành bởi owner

Sau khi dán script, owner chạy một lần `setupRequestWorkbook()` trong Apps Script. Hàm này tạo/làm mới validation cho `Loại` và `Trạng thái`, bảo vệ sheet với vùng L:N là vùng vận hành, tạo `Chi tiết giỏ hàng` được bảo vệ toàn bộ, và tạo `Tổng quan` với hai số đếm. `onEdit(event)` là simple trigger cho sửa một ô L:N: kiểm tra transition trạng thái, yêu cầu người phụ trách khi rời `Mới`, rồi cập nhật cột O.

Sau khi cập nhật template lên bản có nhánh giỏ, owner phải **chạy lại `setupRequestWorkbook()`** rồi redeploy Web app; chạy lại là idempotent và không xóa dòng chi tiết đã có.

Checklist trước bàn giao: owner chạy setup, cấp quyền/deploy Web app, thử intake một mặt hàng và một submit giỏ nhiều dòng, kiểm tra dòng chi tiết dùng chung `Mã` với dòng `Yêu cầu`, thử một transition hợp lệ, kiểm tra protection/validation/Tổng quan và protection của `Chi tiết giỏ hàng`, rồi xác nhận tài khoản Google/Workspace của khách là bên kiểm soát cuối. Protection không phải biện pháp bảo mật tuyệt đối: owner có thể override hoặc gỡ protection. Với tài khoản work/school, chuyển owner chỉ trong cùng tổ chức; khi không chuyển trực tiếp được cần copy/migration/redeploy dưới tài khoản khách. Các việc authorization trigger thực, chuyển ownership/migration và live verification vẫn **Chờ xác nhận** cho tới khi làm trong Google account của user/khách. [Google Sheets protections](https://support.google.com/docs/answer/1218656?hl=en-gb), [Google Drive ownership](https://support.google.com/drive/answer/2494892?hl=en-IN), [Apps Script triggers](https://developers.google.com/apps-script/guides/triggers/).
