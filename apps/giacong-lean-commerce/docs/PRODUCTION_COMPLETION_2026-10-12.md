# Kiểm tra và hoàn thiện production — 2026-10-12

## Phần đã xác minh

- Source phát hành đã đưa vào Git đầy đủ: bảy module/component và ba test trước đây chỉ có trong worktree. PR [#144](https://github.com/hieu-kiien/giacong.vn/pull/144).
- Next.js 16.3.8, OpenNext Cloudflare 1.20.10; audit production không còn vulnerability. Full audit còn năm high trong tooling ESLint/micromatch/braces; chưa có bản vá upstream phù hợp, không downgrade ESLint để che lỗi.
- CI chặn audit production thất bại và cài Chromium cho regression trình duyệt trên runner mới. Full application gate cục bộ đạt; staging deep QA đạt mobile/tablet/desktop, tìm kiếm, detail, cart và bàn phím.
- Staging version `05d3adb4-d512-427d-9fe1-aaf39f6130e2`, build `Q3LTqwR6TwvUT3ke0uRYc`; cache R2 của build đã put/get và so SHA-256 đủ 13 entry. Production có cùng cache build, namespace HTML cache mới tránh tham chiếu JS cũ.
- Apps Script production đã cập nhật deployment hiện có từ v4 lên v5, giữ URL và cơ chế xác thực webhook. Bản mới lưu request ID bền vững, upsert dòng giỏ hàng và giữ số điện thoại dưới dạng text. Google Sheet đã chuyển từ quyền sửa công khai qua link sang Restricted.
- Production đã chạy 100% bản vá. Sau khi khớp lại cấu hình URL/secret của Worker với Apps Script hiện có, version cuối là `13a4e010-a0cb-4e16-a390-750cf6227517`, deployment `d257715a-b439-4cde-ad59-13a0ce44c81b` lúc `2026-10-12T15:33:08Z`. Source ứng dụng giữ nguyên build đã nghiệm thu.
- Yêu cầu từng thất bại 502 đã chuyển sang `delivered`; Sheet kiểm tra trực tiếp có đúng một mã yêu cầu và hai dòng giỏ hàng. D1 vẫn có một lead, hai lead items, trạng thái kinh doanh `qualified`; không tạo giao dịch mới hoặc ghi đè snapshot giá. Retry thành công ở attempt thứ 10 sau khi cấu hình đích và xác thực được khớp.
- CI Quality gate và GitNexus safety gate đều xanh trên commit `696eae6d`. Staging gate trong PR được skip theo trigger workflow; runtime staging đã được chạy và kiểm tra riêng, không coi skip là bằng chứng pass.
- Backup D1 trước triển khai đã lưu cục bộ; SHA-256 `80120B5B9237962C2AFC989A456EEE29D024A7FD7305C508ECB76125CB729142`. Migrations production không còn pending.

## Điểm còn phải xử lý

- Cloudflare Dashboard xác nhận tài khoản đang ở **Workers Free**, CPU 10 ms/request. Log production đo được các invocation 500–1.000 ms; cache/cron không bảo đảm cold start dưới giới hạn này. Lỗi 1102 chưa được coi là khắc phục. Workers Paid đang hiển thị $5/tháng cộng usage; chủ tài khoản phải tự thực hiện bước đăng ký/thanh toán.
- Giá/MOQ và nội dung kinh doanh chưa được khách xác nhận không được tự suy diễn để đánh dấu nghiệm thu.

## Bằng chứng và khôi phục

Artifacts `.runtime/completion-*`, screenshot Apps Script, reconciliation và backup là bằng chứng cục bộ được ignore; harness kiểm tra có thể chạy lại. Không commit dữ liệu khách hàng, tokens hoặc backup D1. Phiên bản production trước thay đổi: `e19155b6-17a3-4bb2-93cf-da4a66d53856`; chỉ rollback code khi xác nhận regression, không rollback dữ liệu kinh doanh đã ghi.

Trạng thái ở trên đã đọc lại từ Cloudflare deployment, D1 và giao diện Google Sheet. Chưa coi cold start ổn định hoặc toàn bộ nghiệm thu kinh doanh hoàn tất khi các điểm còn phải xử lý vẫn mở.
