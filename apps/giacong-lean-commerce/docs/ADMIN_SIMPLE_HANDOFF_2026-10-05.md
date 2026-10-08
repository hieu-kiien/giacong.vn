# Admin gọn và tài khoản dùng chung — 05/10/2026

## Phạm vi đã chốt với khách

- Một màn hình đăng nhập website; hai nhóm: khách hàng và admin toàn quyền (`owner`).
- Công việc chính: sửa sản phẩm/dịch vụ, xem thông tin khách, ghi nhận và xem giao dịch đã chốt qua Zalo, xuất Excel.
- Ít mục hiện cùng lúc, tên tiếng Việt dễ hiểu; thông tin kỹ thuật và việc ít dùng nằm trong phần mở thêm.

## Bản sửa

Nền GitHub: `origin/master` tại `1c250e27`. Dùng lại các sửa mới về biểu mẫu sản phẩm, trạng thái, khách hàng, Google/email và xác minh email; không áp lại bản nháp cũ lên chúng.

| Vấn đề còn lại | Cách xử lý |
| --- | --- |
| Menu dài | 5 mục chính: Tổng quan, Sản phẩm, Dịch vụ gia công, Yêu cầu mua hàng, Khách hàng. Các mục khác trong “Nội dung & cài đặt”, tự mở khi đang ở trang tương ứng. |
| Đăng nhập chỉ nhận vài đích cố định | Nhận đường dẫn nội bộ an toàn; chặn URL ngoài, đường dẫn API và vòng lặp trang đăng nhập. |
| Các tab giữ màn hình sau đăng xuất | Phát sự kiện đăng xuất giữa các tab cùng origin; kiểm tra lại quyền khi cửa sổ được mở lại. Trang tài khoản cũng ẩn lịch sử nếu phiên kết thúc hoặc tài khoản thay đổi. |
| Mua hàng và quản trị có thể dùng hai hostname | Staging nhận `/admin/` trên `staging.kienhieu.id.vn`, dùng chung cookie website. Chỉ tài khoản đã xác minh email và có membership `owner` đang hoạt động được vào. Trang tài khoản hiện “Vào quản trị” cho đúng tài khoản. Host admin cũ giữ đường Access dự phòng. |
| “Đã bán” cộng yêu cầu chưa chốt | Chỉ cộng `zalo_sale_items` có giao dịch tương ứng trong `zalo_sales`. |
| Xuất Excel mới là CSV | Nút chính tải `.xlsx`: hai sheet “Khách hàng” và “Giao dịch đã chốt”, theo khách hàng đang được lọc. Số điện thoại là văn bản; số tiền là số; không có công thức từ dữ liệu nhập. API CSV hiện có vẫn tương thích. |
| Chỉ xem được 20 giao dịch | Lịch sử giao dịch có phân trang 20 bản ghi, truy vấn giới hạn/offset được bind và API kiểm tra tham số. |

Xuất dữ liệu giới hạn 2.000 khách và 10.000 giao dịch mỗi lần. Nếu vượt giới hạn, trả thông báo yêu cầu thu nhỏ tìm kiếm; không xuất thiếu dữ liệu âm thầm. Truy vấn giao dịch chia lô 90 tài khoản để giữ dưới giới hạn tham số D1. Không thêm dependency vào ứng dụng.

## Bằng chứng cục bộ

- `npm run check`: 859 kiểm tra, ESLint, TypeScript và production build; mã thoát cuối cùng `0`.
- `scripts/qa-admin-local-quality.mjs`: 29 tình huống với dữ liệu giả; 12 trang admin ở 390×844, 1366×768 và 1920×1080; kiểm tra giữ bản sửa chưa lưu và lịch sử trình duyệt.
- `scripts/qa-admin-simple-session.mjs`: menu gọn, tải Excel theo tìm kiếm, lỗi xuất, phân trang giao dịch, bố cục điện thoại và đăng xuất giữa hai tab.
- `.xlsx` được đọc bằng `openpyxl` và kiểm tra ZIP; cùng bộ tạo tệp chạy được trong Wrangler local với compatibility date `2026-08-14`.
- Review độc lập không tìm thấy lỗi cụ thể trong hai lượt rà soát mã.
- GitNexus cảnh báo `getAdminProduct` ở mức **CRITICAL**: 10 callers trực tiếp, 12 luồng. Thay đổi giới hạn ở phép cộng số lượng đã chốt; kiểm tra ghi sản phẩm và gallery vẫn nằm trong bộ kiểm tra đầy đủ.
- Kiểm tra phạm vi cuối sau khi dựng lại graph: 24 tệp, 102 ký hiệu, 33 luồng; kết quả `detect_changes` không có cờ partial/truncated. Các luồng do bộ dựng graph chưa liệt kê vẫn cần kiểm tra thực tế, không được coi là không bị ảnh hưởng.

Ảnh, tệp Excel và log trong `.runtime/` là bằng chứng sinh lại được từ fixture, không phải dữ liệu khách hàng thật.

## Nghiệm thu staging sau triển khai

1. Google và email đã xác minh đăng nhập trên hostname website; khách thường nhận từ chối khi mở admin/API admin.
2. Owner dùng “Vào quản trị”, mở website rồi quay lại admin mà không phải đăng nhập thêm.
3. Đăng xuất, Back/Forward và chuyển lại tab cũ không còn hiển thị lịch sử hoặc thao tác được bằng phiên cũ.
4. Tải Excel bằng dữ liệu staging, đối chiếu số khách, giao dịch và tổng tiền với D1.
5. Kiểm tra Access dự phòng trên host admin cũ. Production giữ cổng nghiệm thu riêng.

Người dùng đã cho phép push nhánh, mở PR và triển khai staging. PR #143 giữ production ngoài phạm vi triển khai.

## Giao diện tài khoản — bổ sung 05/10

- Dùng nguyên thanh điều hướng, logo, footer và phần tiêu đề xanh của website; sửa CSS trang tin tức kéo nội dung tài khoản lên 120px. Cách hiển thị tài khoản chỉ áp dụng cho đăng nhập, tài khoản và đặt lại mật khẩu.
- Google và form email/mật khẩu hiển thị rõ trên màn hình đăng nhập. Đăng ký email và khôi phục mật khẩu cần dịch vụ gửi email đã cấu hình; không thu gọn form mật khẩu.
- Thông tin tài khoản, yêu cầu và giao dịch chia khối rõ ràng; phần thêm mật khẩu được thu gọn.
- `scripts/qa-account-ui.mjs` sinh lại ảnh và kiểm tra khoảng cách menu/tiêu đề, tràn ngang, chuyển đăng ký/đăng nhập và hiện mật khẩu ở 390, 958, 1366px; không gửi tài khoản mới hoặc sửa dữ liệu.
- Deep QA staging kiểm tra thêm trang đăng nhập trên năm kích thước màn hình.

### Bổ sung đăng ký email — đang hoàn thiện trên nhánh

- Admin → Nội dung & cài đặt → Liên hệ có lựa chọn bật/tắt đăng ký email, dùng hợp đồng lưu nháp/phát hành hiện có. Migration `0038_customer_email_registration.sql` đã áp dụng staging cùng `0037` bằng guard khớp trạng thái; 10 yêu cầu cũ giữ nguyên, không có lỗi khóa ngoại.
- API đọc lựa chọn đã phát hành trực tiếp mỗi lần đăng ký; lỗi đọc D1 trả 503. Tắt đăng ký mới không tắt Google, đăng nhập hiện có, khôi phục mật khẩu hoặc gửi lại xác minh.
- `npm run check`: 877 kiểm tra, lint/typecheck/build, mã thoát 0. QA trình duyệt đăng nhập ở 390/958/1366 px qua; review độc lập chưa tìm thấy lỗi cụ thể.
- Resend đã xác minh `auth.staging.kienhieu.id.vn`; ba bản ghi DNS và khóa chỉ có quyền gửi cho tên miền thử đã cấu hình. Email thử thực nhận trong Gmail owner. Tạo/xác minh và đăng nhập email đã nghiệm thu thực ở phần cuối; khôi phục mật khẩu thực còn cần nghiệm thu riêng.
- Theo ảnh khách chọn: dùng asset nền liên hệ `form-bg.webp`, chữ tiêu đề tối đa 48px, bỏ hình trang trí tự dựng; thêm mục Tài khoản cả trang marketing và giữ menu desktop trong hai hàng. QA kiểm tra thêm đáy menu không vượt thanh điều hướng.

### Tài liệu định dạng

- [SpreadsheetML — Microsoft](https://learn.microsoft.com/en-us/office/open-xml/spreadsheet/structure-of-a-spreadsheetml-document)
- [Node zlib](https://nodejs.org/api/zlib.html) và [Cloudflare zlib](https://developers.cloudflare.com/workers/runtime-apis/nodejs/zlib/)
## Hồ sơ liên hệ và nghiệm thu tiếp theo

- Khách xác nhận thu số điện thoại cả sau đăng nhập và khi gửi tư vấn; profile được điền sẵn, khách vẫn sửa được cho từng yêu cầu.
- Migration `0036_customer_contact_profiles.sql` bổ sung bảng riêng; email/ID lấy từ phiên đã xác minh. Admin tìm kiếm, chi tiết và Excel đọc số điện thoại mới.
- Giữ header/logo/hero/footer chung. Không thêm checkout, thanh toán hoặc CRM mở rộng.
- Xác nhận yêu cầu trong tab được gắn với tài khoản; xóa khi đăng xuất, không phục hồi cho khách khác.
- Bằng chứng tái tạo: `qa-storefront-journey.mjs` (7 trang × 3 viewport), `qa-customer-contact-local.mjs` (validation, consent, lỗi/retry, prefill, submit), `customer-contact-profile.test.mts` (D1/schema/identity).
- Staging hiện không có sản phẩm active để nghiệm thu gửi yêu cầu thực với catalog; các trường hợp có dữ liệu dùng fixture cục bộ. Luồng Google cần người dùng thực thao tác nếu phải xác thực lại.

## Báo khách mới — chuẩn bị 05/10

- Chủ dự án chọn cả email owner và Google Sheets. Outbox D1, queue hiện có, ACK từng kênh và nút thử lại trong admin đã triển khai; cấu hình hai kênh đã bật trên staging.
- Đã tạo Sheet và Apps Script staging riêng sau xác nhận của owner, không thay webhook cũ có thể dùng chung production. Script phiên bản 2, secret riêng, `@OnlyCurrentDoc`; nhận hồ sơ mẫu và replay trả ACK đúng ID/revision. Sửa lỗi Sheets ép số điện thoại có số 0 đầu bằng định dạng text trước khi ghi; revision giữ kiểu số. Worker mới đã kích hoạt; email báo hồ sơ từ ứng dụng chưa nghiệm thu. Hồ sơ cũ không tự gửi email hàng loạt. Hướng dẫn tại [GOOGLE_SHEETS_CONTACT_WEBHOOK.md](GOOGLE_SHEETS_CONTACT_WEBHOOK.md).
- Giao diện theo ảnh khách: commit `0afc84de`, full gate 879 kiểm tra/lint/typecheck/build qua; Cloudflare build và preview QA [37317300816](https://github.com/hieu-kiien/giacong.vn/actions/runs/37317300816) qua. QA tài khoản trên staging 390/958/1366px qua, đăng ký email và khôi phục đã hiển thị.
- Đã xem trực tiếp màn hình Haravan Accounts đăng ký (email, Google/Apple, điều khoản) và đăng nhập (email, mật khẩu phụ, Google/Apple/Passkey); không tạo tài khoản. Website giữ Google theo quyết định, hỏi thông tin liên hệ bước sau và không thêm những cách đăng nhập chưa cấu hình.
- Bằng chứng tái tạo: `customer-contact-delivery.test.mts`, `google-apps-script-template.test.mjs`, `qa-customer-notification-local.mjs`; ảnh tham khảo và UI thử lại ở `.runtime/` là hiện vật có thể sinh lại.

## Đăng ký có số điện thoại — nghiệm thu 05/10

- Commit `c8fe1b34`: bỏ tên đăng nhập khỏi form đăng nhập/đăng ký và phần thêm mật khẩu cho tài khoản Google. Đăng nhập bằng email hoặc Google; đăng ký email hỏi họ tên, điện thoại, mật khẩu và đồng ý liên hệ.
- Điện thoại được kiểm tra phía máy chủ và lưu hồ sơ theo ID do Better Auth tạo. Phản hồi đăng ký giữ nguyên để tránh dò email có sẵn. Email/Sheets chỉ gửi sau xác minh; delivery kiểm tra lại `emailVerified` trước mọi kênh.
- Staging version `43f8436c-995f-4b55-ac33-0fb9307a5073` nhận 100%. Full check và Cloudflare build qua; preview QA [37323530507](https://github.com/hieu-kiien/giacong.vn/actions/runs/37323530507), active QA [37324275167](https://github.com/hieu-kiien/giacong.vn/actions/runs/37324275167) qua. QA tài khoản 390/958/1366px qua; một lượt sát triển khai gặp trang lỗi tải phía client, chạy lại và kiểm tra trình duyệt thực đã qua.
- Tài khoản thử có tên “THỬ NGHIỆM STAGING - KHÔNG LIÊN HỆ”: email thật nhận xác minh, đăng nhập trước xác minh bị chặn, sau xác minh đăng nhập email/mật khẩu thành công, khách bị chặn admin. D1 trước/sau: users 1→2, profiles 0→1, leads giữ 10, sales giữ 0, FK errors 0. Outbox pending→delivered, Sheet revision 0→1; Gmail owner thực nhận thông báo và điện thoại thử giữ đúng trong Sheet.
- Một tài khoản thử được giữ riêng trên staging; credentials và cookie thử đã xóa khỏi file cục bộ. Production chưa thay đổi.
