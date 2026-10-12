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

- Ràng buộc khách xác nhận: **chỉ dùng gói miễn phí, không đăng ký dịch vụ trả phí**. Tài khoản vẫn ở Workers Free. Log đã có invocation tải lạnh vượt CPU 10 ms; chưa coi lỗi 1102 được khắc phục. Khuyến nghị nâng gói trước đây đã rút lại; hướng xử lý là đo và tối ưu tài nguyên hiện có.
- Dashboard đọc lại: Workers Free, chi phí sử dụng $0.00, hôm nay 1.535/100.000 request tại thời điểm kiểm tra. Chưa hết quota request; CPU render là vấn đề riêng.
- Cron trước đây render ba trang nhưng chưa ghi HTML cache. Bản sửa dùng đúng hostname môi trường và ghi cache qua bộ lọc hiện có; test xác nhận không cache trang tài khoản hoặc response `Set-Cookie`, và lượt HIT không gọi Next render. Giữ nguyên ba đường dẫn, lịch `*/2 * * * *`, bindings và dịch vụ; không tăng tài nguyên hoặc đăng ký gói trả phí.
- Full gate đạt 947 test, lint/typecheck/build exit 0; review độc lập không có finding chặn. GitNexus kiểm tra thay đổi trả low; caller của `scheduled` vẫn không được graph giải quyết, đã xác nhận qua cron cấu hình và test runtime.
- Đã triển khai wrapper mới: staging `2681af38-978b-484b-9a5f-2656495f012a`, production `eb718887-cd55-42a5-a43d-f93e618e4fe1`. Tái sử dụng artifact OpenNext build `Q3LTqwR6TwvUT3ke0uRYc` đã nghiệm thu: source ứng dụng của commit baseline và worktree tạo artifact không có diff; phần thay đổi là custom Worker wrapper. Không chạy migration hoặc ghi dữ liệu kinh doanh mới.
- Runtime staging: 15 lượt trên home/liên hệ/catalog/dịch vụ/login đều 200; trang công khai HIT, login và request có cookie không dùng shared cache; anonymous admin API 401. Production: 10 lượt cùng nhóm trang đều 200; anonymous admin API qua public host 401, hostname admin chuyển 302 tới Cloudflare Access (không coi trang login Access 200 sau redirect là API thành công).
- CPU mẫu với `Accept: text/html`: trước sửa staging HIT nóng 1–3 ms; sau sửa staging HIT nóng 1–2 ms, production nóng khoảng 1 ms. Production lần đầu còn 820 ms, login 22–38 ms. Đây là mẫu nhỏ, chưa phải p95, chưa chứng minh mức giảm cold start hoặc bảo đảm mọi trung tâm dữ liệu đều HIT. Cache API cục bộ theo trung tâm dữ liệu; không coi cron priming là tối ưu hoàn tất.
- Giá/MOQ và nội dung kinh doanh chưa được khách xác nhận không được tự suy diễn để đánh dấu nghiệm thu.

## Bằng chứng và khôi phục

Artifacts `.runtime/completion-*`, screenshot Apps Script, reconciliation và backup là bằng chứng cục bộ được ignore; harness kiểm tra có thể chạy lại. Không commit dữ liệu khách hàng, tokens hoặc backup D1. Phiên bản production trước thay đổi: `e19155b6-17a3-4bb2-93cf-da4a66d53856`; chỉ rollback code khi xác nhận regression, không rollback dữ liệu kinh doanh đã ghi.

Trạng thái ở trên đã đọc lại từ Cloudflare deployment, D1 và giao diện Google Sheet. Chưa coi cold start ổn định hoặc toàn bộ nghiệm thu kinh doanh hoàn tất khi các điểm còn phải xử lý vẫn mở.
