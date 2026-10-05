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

Quy tắc app `AGENTS.md` yêu cầu người dùng cho phép rõ ràng trước khi push. Bản sửa chưa tự động được đưa lên GitHub hoặc website chỉ vì có trong worktree.

### Tài liệu định dạng

- [SpreadsheetML — Microsoft](https://learn.microsoft.com/en-us/office/open-xml/spreadsheet/structure-of-a-spreadsheetml-document)
- [Node zlib](https://nodejs.org/api/zlib.html) và [Cloudflare zlib](https://developers.cloudflare.com/workers/runtime-apis/nodejs/zlib/)
