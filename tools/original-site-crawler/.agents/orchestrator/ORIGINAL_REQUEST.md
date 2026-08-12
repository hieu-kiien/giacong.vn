# Original User Request

## Initial Request — 2026-07-16T16:50:28Z

Cào và trích xuất dữ liệu cấu trúc toàn bộ nội dung từ trang web https://giacong.vn bao gồm các dịch vụ gia công, sản phẩm, tin tức và thông tin liên hệ. Dữ liệu trích xuất sẽ được lưu trữ dưới định dạng JSON/CSV trong thư mục làm việc.

Working directory: c:\Users\hieuk\Desktop\cào giacong.vn
Integrity mode: benchmark

## Requirements

### R1. Bộ thu thập dữ liệu (Crawler/Scraper)
Triển khai bộ thu thập tự động bắt đầu từ trang chủ `https://giacong.vn`, tự động phát hiện và thu thập toàn bộ các liên kết nội bộ hợp lệ. Tránh thu thập lặp lại bằng cách chuẩn hóa URL (loại bỏ query params không cần thiết như `?replytocom`, `/feed/`, v.v.) và lọc bỏ các liên kết ngoại miền. Thiết lập độ trễ hợp lý giữa các yêu cầu (delay) kết hợp cơ chế thử lại (retry) với exponential backoff khi gặp lỗi HTTP 429 (Too Many Requests) hoặc 503 để tránh bị chặn.

### R2. Trích xuất thông tin cấu trúc
Phân tích cú pháp của các trang thu thập được để trích xuất các trường thông tin: URL, Tiêu đề (Title), Thẻ H1, Thể loại trang (Sản phẩm, Dịch vụ, Tin tức, Liên hệ, v.v. - phân loại dựa trên đường dẫn hoặc các class CSS đặc trưng của WordPress/WooCommerce), Nội dung văn bản chính, thông tin liên hệ (số điện thoại, email, địa chỉ) và danh sách liên kết hình ảnh đi kèm (cần kiểm tra cả các thuộc tính lazy-load như `data-src`, `data-lazy-src`).

### R3. Lưu trữ kết quả đầu ra
Lưu trữ toàn bộ dữ liệu cào được thành hai định dạng file trong thư mục làm việc:
- `crawled_data.json` chứa cấu trúc chi tiết dạng phân cấp.
- `crawled_data.csv` chứa bảng tổng hợp thông tin tóm tắt của các trang.

## Acceptance Criteria

### Dữ liệu đầu ra đầy đủ và đúng định dạng
- [ ] Tồn tại file `crawled_data.json` trong thư mục làm việc với định dạng JSON hợp lệ, chứa mảng danh sách các trang đã cào.
- [ ] Tồn tại file `crawled_data.csv` trong thư mục làm việc với các cột tối thiểu: `url`, `title`, `category`, `content`, `contacts`.
- [ ] Số lượng trang cào được tối thiểu phải đạt 15 trang độc lập thuộc tên miền `giacong.vn`.

### Chất lượng dữ liệu trích xuất
- [ ] Dữ liệu trích xuất không bị rỗng ở các trường chính như `url`, `title`, `content` (trừ khi trang thực tế không có nội dung).
- [ ] Thông tin liên hệ (Hotline: `0947142999`, Email: `info@giacong.vn`) được phát hiện và trích xuất chính xác từ trang liên hệ hoặc trang chủ.

### Kiểm thử và chạy tự động
- [ ] Cung cấp hướng dẫn chi tiết hoặc script chạy tự động để dễ dàng thực hiện lại quá trình cào dữ liệu.

## Follow-up — 2026-07-17T01:50:09+07:00

Identity: Project Orchestrator (Successor)
Working Directory: c:\Users\hieuk\Desktop\cào giacong.vn\.agents\orchestrator\
Workspace Root: c:\Users\hieuk\Desktop\cào giacong.vn\
Original User Request File: c:\Users\hieuk\Desktop\cào giacong.vn\ORIGINAL_REQUEST.md

You are replacing the previous orchestrator (25ea89cc-e6a4-4d3e-9a87-b0199c1a615c) which stopped due to a quota exhaustion error. Please resume the project:
1. Re-read the existing plan.md, progress.md, and context.md files in your working directory.
2. Clean up the pytest collection errors by renaming the root-level files `explore_fetch_test.py` and `explore_multiple_posts_test.py` so they do not end with `_test.py`.
3. Run the E2E test suite to verify 100% pass without errors.
4. Execute the final scraper to retrieve structured data from https://giacong.vn and output them as `crawled_data.json` and `crawled_data.csv` in the workspace root.
5. Notify the Sentinel when completed and verified to claim victory.
