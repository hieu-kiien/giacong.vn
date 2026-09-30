# Webhook liên hệ Google Sheets

Template [google-apps-script-contact-webhook.gs](google-apps-script-contact-webhook.gs) nhận intake từ `POST /api/contact` vào tab `Yêu cầu` và bản sao giao dịch nhân viên đã chốt qua Zalo từ D1 vào hai tab giao dịch. Sheet là bản sao vận hành; Admin/D1 vẫn là nguồn dữ liệu gốc.

## Đồng bộ giao dịch Zalo đã chốt

Admin lưu giao dịch, các dòng hàng snapshot, audit và một dòng `google_sheet_sales_outbox` trạng thái `pending` trong cùng batch D1. Worker chỉ nhận `{ type: "zalo-sale", saleId }`, đọc lại giá và nội dung từ D1 rồi gửi `sale.confirmed`; browser không gửi giá làm nguồn đồng bộ. Nếu binding queue không có hoặc enqueue lỗi, route thử webhook đồng bộ ngay. Outbox chỉ thành `delivered` sau JSON ACK có đúng cả `sale_id` và `sale_code`; lỗi giữ `pending` để queue retry hoặc thành `failed` khi hết lần thử/synchronous fallback lỗi.

Apps Script dùng cùng `ScriptLock` như intake. Tab `Giao dịch đã chốt` có `sale_id`, mã, yêu cầu nguồn, thời điểm, khách và tổng; `Chi tiết giao dịch` có `sale_id`, `sale_line_id`, snapshot sản phẩm, số lượng và đơn giá. Cả hai tab được bảo vệ chỉ đọc. Các khóa UUID ổn định được upsert chính xác dưới lock; cùng ID và cùng `snapshot_sha256` được replay an toàn, còn cùng ID với snapshot khác bị từ chối. Chi tiết được ghi trước và dòng giao dịch là commit marker; script chỉ trả ACK sau `flush()` và đọc lại xác nhận đủ header cùng toàn bộ 16 cột snapshot của mọi dòng hàng.

Queue producer/consumer `GIACONG_VN_LEAD_QUEUE` và DLQ hiện có được tái dùng, không cần queue binding mới. Consumer đặt tối đa ba lần retry theo Wrangler; bản ghi vào DLQ cần được vận hành viên kiểm tra và replay sau khi sửa lỗi cấu hình/webhook. D1/outbox là nơi đối soát trạng thái, không nhập giao dịch bằng tay lần nữa trong Sheet.

Nếu đồng bộ kết thúc ở trạng thái `failed`, nhân viên mở lại giao dịch trong Admin và bấm **Thử đồng bộ lại Google Sheets**. Endpoint gửi lại snapshot đọc từ D1 theo đúng `sale_id` hiện có nên không tạo giao dịch hoặc dòng bán mới; Apps Script upsert theo ID ổn định. Nếu lần thử vẫn lỗi, trạng thái tiếp tục là `failed` và nút thử lại còn hiển thị. Lỗi còn nằm trong queue/DLQ vẫn cần vận hành viên kiểm tra và replay theo hướng dẫn queue.

Mỗi submit được server chấp nhận tạo một `Mã` và dòng mới. Mỗi form public
tạo một `request_id` ổn định cho một lần gửi; server giữ và truyền mã này qua
queue/webhook, chỉ xóa sau phản hồi tiếp nhận bền vững để retry mạng có thể
replay cùng kết quả. Server tự gán `request_type`; Apps Script ghi giá trị
canonical vào C:F, `Mới` vào L, để trống M:N và ghi timestamp vào B:O. `Số
lượng` là số hoặc rỗng. Các text do request cung cấp vẫn được ép text an toàn
để không chạy công thức Sheet.

## Tab `Chi tiết giỏ hàng`

Template đã triển khai tab thứ hai cho submit giỏ nhiều dòng. Nó khóa theo `Mã` của dòng `Yêu cầu` và mang đúng 9 cột A:I: `Mã`, `Dòng`, `Sản phẩm`, `Biến thể`, `Đơn vị`, `Số lượng`, `Đơn giá`, `Thành tiền`, `Ghi chú hệ thống`. Toàn bộ cột do server/Apps Script ghi; `setupRequestWorkbook()` bảo vệ cả tab và **không** để vùng vận hành nào, nên administrator chỉ đọc. Không có trạng thái, người phụ trách hay công thức trong tab này; vận hành vẫn chỉ diễn ra ở L:N của `Yêu cầu`.

Nhánh giỏ được nhận khi payload có khóa `cart`. Schema 15 cột A:O của `Yêu cầu` không đổi: submit giỏ ghi `Giỏ yêu cầu (N dòng)` vào D và để trống E:F. Đơn giá và thành tiền phải là số nguyên dương thật hoặc rỗng; chuỗi số bị từ chối cả dòng. Mọi text của chi tiết đi qua cùng lớp ép text an toàn như tab `Yêu cầu`.

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
2. Trước khi redeploy script, xác nhận Script Property `CONTACT_WEBHOOK_SECRET` tồn tại và khớp giá trị Worker `GOOGLE_SHEETS_WEBHOOK_SECRET`. Script từ chối mọi request (cả intake hiện tại và giao dịch mới) nếu property thiếu/rỗng hoặc secret không khớp; không có secret mặc định.
3. Deploy **Web app**, chạy dưới tài khoản sở hữu sheet, cấp quyền ghi sheet và chọn quyền truy cập cho phép request **không đăng nhập** (webhook không có phiên Google). Secret ở bước 2 bảo vệ deployment public này.
4. Sao chép URL `/exec` rồi đặt `GOOGLE_SHEETS_WEBHOOK_URL`. Chỉ dùng URL HTTPS của `script.google.com` hoặc `script.googleusercontent.com`; không đưa URL hoặc secret vào mã nguồn hay biến `NEXT_PUBLIC_*`.
5. Gửi một form liên hệ thử và kiểm tra dòng mới có trạng thái `Mới` trong tab `Yêu cầu`. Sau khi rollout phần giao dịch, xác nhận Admin ghi một giao dịch thử vào D1 rồi kiểm tra hai tab giao dịch có một header cùng dòng hàng, và replay cùng `sale_id` không tạo hàng trùng.

Template kiểm tra cơ bản tên, điện thoại, email và contract context do server gửi; đồng thời ép mọi dữ liệu text thành text an toàn trước khi ghi Sheet để không thực thi công thức bắt đầu bằng `=`, `+`, `-` hoặc `@`. Next.js chỉ chấp nhận JSON phù hợp của intake hoặc ACK giao dịch khớp `sale_id`/`sale_code`. Khi thay đổi script hoặc secret, owner phải cập nhật và redeploy Apps Script Web app; cập nhật `GOOGLE_SHEETS_WEBHOOK_SECRET` trên host tương ứng rồi redeploy Worker.

## Thiết lập vận hành bởi owner

Sau khi dán script, owner chạy một lần `setupRequestWorkbook()` trong Apps Script. Hàm này tạo/làm mới validation cho `Loại` và `Trạng thái`, bảo vệ sheet với vùng L:N là vùng vận hành, tạo `Chi tiết giỏ hàng` được bảo vệ toàn bộ, và tạo `Tổng quan` với hai số đếm. Hai tab giao dịch được tạo và khóa khi sale đầu tiên được nhận; nếu tạo trước, tên/cột phải khớp header trong template. `onEdit(event)` là simple trigger cho sửa một ô L:N: kiểm tra transition trạng thái, yêu cầu người phụ trách khi rời `Mới`, rồi cập nhật cột O.

Sau khi cập nhật template lên bản có nhánh giỏ, owner phải **chạy lại `setupRequestWorkbook()`** rồi redeploy Web app; chạy lại là idempotent và không xóa dòng chi tiết đã có.

Checklist trước bàn giao: owner chạy setup, cấp quyền/deploy Web app, thử intake một mặt hàng và một submit giỏ nhiều dòng, kiểm tra dòng chi tiết dùng chung `Mã` với dòng `Yêu cầu`, thử một transition hợp lệ, kiểm tra protection/validation/Tổng quan và protection của `Chi tiết giỏ hàng`, rồi xác nhận tài khoản Google/Workspace của khách là bên kiểm soát cuối. Protection không phải biện pháp bảo mật tuyệt đối: owner có thể override hoặc gỡ protection. Với tài khoản work/school, chuyển owner chỉ trong cùng tổ chức; khi không chuyển trực tiếp được cần copy/migration/redeploy dưới tài khoản khách. Các việc authorization trigger thực, chuyển ownership/migration và live verification vẫn **Chờ xác nhận** cho tới khi làm trong Google account của user/khách. [Google Sheets protections](https://support.google.com/docs/answer/1218656?hl=en-gb), [Google Drive ownership](https://support.google.com/drive/answer/2494892?hl=en-IN), [Apps Script triggers](https://developers.google.com/apps-script/guides/triggers/).
