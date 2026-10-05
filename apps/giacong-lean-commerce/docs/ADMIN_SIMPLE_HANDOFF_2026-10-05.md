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
- Google là cách đăng nhập/đăng ký chính theo lựa chọn khách hàng. Đăng ký email và khôi phục mật khẩu chỉ hiển thị khi dịch vụ gửi email đã cấu hình; mật khẩu đã thiết lập vẫn đăng nhập được trong mục phụ.
- Thông tin tài khoản, yêu cầu và giao dịch chia khối rõ ràng; phần thêm mật khẩu được thu gọn.
- `scripts/qa-account-ui.mjs` sinh lại ảnh và kiểm tra khoảng cách menu/tiêu đề, tràn ngang, chuyển đăng ký/đăng nhập và hiện mật khẩu ở 390, 958, 1366px; không gửi tài khoản mới hoặc sửa dữ liệu.
- Deep QA staging kiểm tra thêm trang đăng nhập trên năm kích thước màn hình.

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

- Chủ dự án chọn cả email owner và Google Sheets. Outbox D1, queue hiện có, ACK từng kênh và nút thử lại trong admin đã được triển khai trong mã; chưa bật trên staging.
- Cần xác nhận email nhận báo, link Sheet đích và cấu hình sender/Resend; Apps Script cần redeploy trước migration `0037` và Worker. Hồ sơ cũ không tự gửi email hàng loạt. Hướng dẫn tại [GOOGLE_SHEETS_CONTACT_WEBHOOK.md](GOOGLE_SHEETS_CONTACT_WEBHOOK.md).
- Đã xem trực tiếp màn hình Haravan Accounts đăng ký (email, Google/Apple, điều khoản) và đăng nhập (email, mật khẩu phụ, Google/Apple/Passkey); không tạo tài khoản. Website giữ Google theo quyết định, hỏi thông tin liên hệ bước sau và không thêm những cách đăng nhập chưa cấu hình.
- Bằng chứng tái tạo: `customer-contact-delivery.test.mts`, `google-apps-script-template.test.mjs`, `qa-customer-notification-local.mjs`; ảnh tham khảo và UI thử lại ở `.runtime/` là hiện vật có thể sinh lại.
