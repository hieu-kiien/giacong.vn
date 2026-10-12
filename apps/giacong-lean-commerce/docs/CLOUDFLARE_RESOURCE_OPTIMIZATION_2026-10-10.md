# Tối ưu tài nguyên Cloudflare — staging 2026-10-10

## Phạm vi đã thực hiện

- Bật minify riêng staging: Worker từ 11.59 MiB xuống khoảng 7.91 MiB (giảm 31.7%); gzip từ 2328.14 KiB xuống khoảng 2025 KiB (giảm khoảng 13%). Import plugin username trực tiếp giữ đúng implementation; riêng thay đổi import không giảm kích thước handler đã tree-shake.
- Bỏ prefetch khi hover/focus sidebar admin và liên kết mở website; tắt prefetch các Link trang tài khoản, chính sách trong biểu mẫu liên hệ và nút giỏ nổi. Các href và thao tác điều hướng giữ nguyên.
- Tái sử dụng auth instance chỉ sau khi context/schema đã khởi tạo thành công. Khóa theo D1, origin và cấu hình auth/email; không chia sẻ khởi tạo đang chờ, request, cookie, session hay kết quả API. Quyền admin vẫn đọc D1 mỗi request.
- Xóa duy nhất KV `giacong-vn-probe-state`: kiểm kê đủ bốn Worker không có binding, không có tham chiếu mã, kiểm tra lại namespace đúng ID và 0 key trước xóa, xác nhận namespace biến mất sau xóa. Không có dữ liệu cần khôi phục.

## Kiểm kê và phần giữ lại

- Giacong có 2 Worker (production/staging), 2 D1, 4 R2 (ảnh/cache mỗi môi trường), 4 queue gồm 2 DLQ. Đây là các binding vận hành đang dùng; DLQ không có consumer là đúng thiết kế, không phải tài nguyên dư.
- Không có Pages project. Không thay đổi Worker `ictu-quiz-assistant`, `turnstile-siteverify-kienhieu`, R2 `marketflow-production-data` và KV `PROBE_STATE` thuộc phạm vi khác/chưa xác minh.
- D1 staging khoảng 1.16 MiB, production khoảng 0.60 MiB; dọn bản ghi nhỏ không giải quyết CPU render/auth. Không xóa dữ liệu kinh doanh hoặc QA trong lượt tối ưu hạ tầng này.
- Không đổi billing, không deploy production, không commit/push.

## Bằng chứng và giới hạn

- Bản auth `7ce42b82-360b-4da2-b808-f15c01b56135`: CPU session khởi tạo 192 ms, tải lại 13 ms; API dịch vụ 32 ms rồi 12 ms. Mẫu riêng lẻ, không phải benchmark p95 hoặc mức giảm được bảo đảm. Các request mẫu này có outcome `ok`.
- Chrome kiểm tra tổng quan, sản phẩm, dịch vụ, khách hàng, hai owner admin, tài khoản/lịch sử và reload; hồ sơ Chrome khác tới trang đăng nhập, admin không đăng nhập trả 401. Review Luna không phát hiện lỗi có căn cứ trong cache hoặc prefetch.
- Gate cuối `npm run check`: 934 test, lint 0 lỗi/2 cảnh báo có sẵn, typecheck/build đạt. RED→GREEN cho cache và prefetch. Không có DevTools MCP để đo LCP/INP/CLS.
- Bản chỉ minify trước auth vẫn tái hiện `exceededCpu`; chưa được dùng mẫu warm mới để kết luận đã loại bỏ mọi lỗi CPU khi tải lạnh hoặc tải cao.
- Artifact `.runtime/perf-*.log`, inventory và summary JSON là dữ liệu cục bộ có thể tái tạo. Raw tail có thể chứa cookie/dữ liệu riêng; không đưa vào gói bàn giao.

## Bản cuối

- Deploy staging exit 0: `ecad6dd2-0923-41dd-a04d-494d8747292a`. Worker 8101.02 KiB / gzip 2025.27 KiB; startup 21 ms.
- Sau reload tài khoản: không có request prefetch. Liên kết Vào quản trị hoạt động; dashboard reload đọc lại đúng 28 sản phẩm/8 hoạt động, 16 dịch vụ/13 hoạt động và 19 yêu cầu. Session admin warm 14 ms CPU, dashboard API 16 ms CPU/644 ms wall; chưa có `exceededCpu` trong mẫu mới. Một dashboard request bị hủy vì chủ động reload khi request đầu còn chạy, không có exception.
- Tải lạnh tài khoản 794 ms CPU/4292 ms wall; admin lần đầu 665 ms CPU/870 ms wall, reload 66 ms CPU/268 ms wall. Tốc độ tải lạnh vẫn chưa đạt kỳ vọng; không đóng nghiệm thu hiệu năng hoặc bàn giao toàn hệ thống bằng kết quả warm này.
- Ảnh bằng chứng: `.runtime/perf-admin-final.png`. Summary đã bỏ cookie/dữ liệu riêng: `.runtime/perf-final-runtime-summary.json`.
