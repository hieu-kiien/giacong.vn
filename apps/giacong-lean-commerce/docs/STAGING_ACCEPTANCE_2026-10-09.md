# Nghiệm thu staging — 09/10/2026

## Đối chiếu trực tiếp sau deploy — 10/10/2026

Đây là phần bổ sung cho lần kiểm tra mới; không ghi đè bằng chứng cũ và không được hiểu là nghiệm thu toàn hệ thống.

- Mã Worker staging đang mở: `ecad6dd2-0923-41dd-a04d-494d8747292a`. Lượt kiểm tra này không sửa mã, ghi dữ liệu, deploy hoặc thay đổi production.
- Chrome mở `/san-pham/`: hiện 8 mặt hàng công khai, cả 8 ảnh đều tải và có nhãn nhìn thấy “Ảnh minh họa do AI tạo”. Các giá/quy cách đang hiện trên staging chưa có xác nhận kinh doanh; không dùng làm giá bàn giao.
- Search thật: truy vấn “bột đậu nành” trả Cloudflare 1102 một lần; tải lại cùng URL thành công và trả đúng một sản phẩm. Hai truy vấn tiếp theo (một có kết quả và một không có kết quả) cũng trả trạng thái đúng. Đây là lỗi chập chờn đã tái hiện, chưa tìm ra nguyên nhân hay đóng lỗi. Wrangler tail chỉ bắt được request thành công sau đó; không có bằng chứng tail cho invocation 1102.
- Trang `/thue-gia-cong/` hiển thị 13 nhóm và 193 trang nội dung; 13 là số nhóm, không phải tổng số URL nội dung. Chưa xác minh lại mọi URL riêng lẻ trong lượt này.
- Truy vấn D1 staging chỉ đọc: 28 sản phẩm, 8 bật và 20 tắt; 24 bản ghi có `image_url`, 4 bản ghi thiếu ảnh. Trong 8 bản ghi bật, cả 8 đều có ảnh. Không bật thêm bản ghi vì điều kiện kinh doanh chưa được xác thực; không ghi D1.
- `npm run check` sau đối chiếu: exit 0, 934 test pass, 0 fail; lint/typecheck/build hoàn tất. Build local dùng fallback cấu hình đã commit khi D1 local chưa khởi tạo bảng `site_settings`; log này không phải kết quả đo staging. `git diff --check` đạt.
- Không tái kiểm tra thao tác admin được trong lượt này: Chrome hiện đăng xuất. Luồng Google đang yêu cầu chọn hồ sơ; chưa chọn để gửi thông tin hồ sơ tài khoản đến staging. Responsive Tester đang có trên Chrome nhưng trang `chrome-extension://` bị chính sách điều khiển chặn, nên không dùng đường vòng; ma trận responsive đã có trong bằng chứng của deploy trước, chưa chạy lại bằng extension ở phiên này.

**Trạng thái mới:** staging vẫn chưa đủ điều kiện bàn giao cuối. Các blocker hiện có căn cứ là 1102 chập chờn ở truy vấn catalog; giá/quy cách/MOQ kinh doanh chưa xác nhận; dịch vụ công khai còn thiếu điều kiện gia công; và các luồng quyền admin chưa được tái kiểm tra trên phiên đăng nhập của owner. Production không thay đổi.

Bản kỹ thuật đã triển khai và đạt các kiểm tra dưới đây. Dữ liệu kinh doanh vẫn cần xác nhận trước khi phát hành cho khách; dữ liệu QA không phải seed production. Tài liệu này thay thế các kết luận tạm thời trước đó.

- Website https://staging.kienhieu.id.vn; admin https://admin-staging.kienhieu.id.vn.
- Worker `083c8439-c0b3-48cf-ae91-0802945186de` (sửa kích thước thumbnail trong bảng danh mục); Apps Script staging phiên bản 7.
- Nhánh `codex/staging-acceptance`, nền `ffdb3fc5`. Chưa commit/push; production không thay đổi.

## Checklist hợp nhất

| # | Hạng mục | Kết quả và bằng chứng |
|---|---|---|
| 1 | Ảnh và khoảng trống | Bộ ảnh AI đã tạo thành 20 WebP. Staging có 20 mặt hàng nội dung mục tiêu (8 đang hiển thị, 12 bản nháp); 17 ảnh đã được tải/lưu qua admin, còn 3 bản nháp mới (#25–#27) chưa gắn ảnh. Ảnh AI không phải ảnh lô hàng thực tế. |
| 2 | Nội dung, giá, quy cách | Cơ chế lưu đã kiểm tra; dữ liệu hiện có là staging, chưa được xác nhận để bàn giao kinh doanh. |
| 3 | MOQ/điều kiện giá | Theo quy cách chọn: Bao 5 kg MOQ 25/bước 5; Bao25 kg MOQ 4/bước 2; 20 bao ×344.000đ =6.880.000đ. QA mới:8 bao ×296.000đ =2.368.000đ. |
| 4 | Hotline/Zalo | Staging thống nhất0868408115 và https://zalo.me/0868408115 ở cấu hình/footer/liên hệ nhanh theo AGENTS.md và người dùng. Scope cũ có số khác; không dùng số cũ ghi đè staging. |
| 5 | Đồng bộ/retry | Snapshot và mã giữ nguyên, claim chống đồng thời, phục hồi queued quá10 phút, có audit. Lead từng lỗi504 `LEAD-4960 CAF706` nay delivered. Retry `LEAD-E26B1D767E` delivered lần6. Lead mới `LEAD-912C4909DC` delivered lần2. Giao dịch mới delivered lần1. |
| 6 | Tài khoản | Chrome thật: tạo QA → email vào inbox → xác minh → đăng nhập → quay lại giỏ. Reset email vào inbox; mật khẩu xác nhận không khớp bị chặn, đổi thành công, mật khẩu cũ bị từ chối, mật khẩu mới đăng nhập được, link đã dùng bị từ chối. QA khách bị chặn admin; Google owner vào được. |
| 7 | Dọn QA | Yêu cầu thử đã chuyển Rác có thể khôi phục, giữ audit. Giao dịch QA mới giữ nhãn rõ và Đã chốt. Sản phẩm QA ở nháp/tạm ẩn; không xóa cứng tài khoản/giao dịch/ảnh audit. |
| 8 | Tài khoản quản trị | Mục quyền nằm trong công việc hằng ngày. Staging chỉ nhận role `owner` (Admin toàn quyền); role cũ bị chặn ở admission/capability. Sửa `AdminCategoryPanel` dùng helper quyền catalog chuẩn để không hiện thao tác cho `catalog_manager` đã nghỉ. Khi mở chậm danh mục, trạng thái tải không còn báo nhầm 0; sau deploy Chrome hiển thị đủ 4 danh mục. Chrome owner mở được trang quyền và thao tác quản lý danh mục; hồ sơ không phiên chỉ thấy màn đăng nhập, GET `/api/admin/members` trả 401. D1 có 2 membership `owner` đang hoạt động; không thay đổi membership và không cho owner tự khóa/hạ quyền. |
| 9 | Tổng quan | Ưu tiên yêu cầu và4 việc chính; một CTA hộp thư. Chrome staging kiểm chứng. |
| 10 | Tài khoản/lịch sử | Đầu trang gọn; tên sản phẩm là tiêu đề, mã phụ. Đã rà mobile/desktop và reload lịch sử mới. Nhãn “Email tài khoản” dùng chung Google/mật khẩu. |
| 11 | Điện thoại | Chặn0000000000/số lặp, lỗi cụ thể, không lưu. Không tự thay số cá nhân cũ của owner. |
| 12 | Dịch vụ thiếu dữ liệu | Gom MOQ/thời gian cùng thiếu thành một nhãn Cần bổ sung điều kiện gia công. Không tự điền thông tin không có nguồn. |
| 13 | Quay lại danh sách | Sửa lịch sử mở lại editor đã đóng, giữ filter. Local có directURL/close/Back/Forward/reload/chuyển sản phẩm. Chrome bản cuối:status=draft → mở#15 → đóng → Forward → reload vẫn danh sách draft, editor không mở lại. |
| 14 | Responsive | Chrome thật:12 route admin ×390/768/1440px =36 tổ hợp đạt, innerWidth đúng, không tràn trang. Local bổ sung390/1366/1920px. Storefront/tài khoản đã rà390/768/1440px. |
| 15 | Thông báo/lỗi | Kiểm tra lưu, validation, đăng nhập/reset/retry/gửi yêu cầu. Local có503, abort request thật và hết phiên: báo phù hợp, thử lại phục hồi; hết phiên không giữ dữ liệu riêng tư. |
| 16 | Upload/giá/giao dịch/Excel/quyền | Giá QA#14:10.000→11.000→reload→hoàn nguyên10.000→reload. Upload ảnh AI qua admin đạt cho 17 mặt hàng. Giao dịch mới D1/Sheet/lịch sử khách đạt. Excel hợp lệ,6 thành phần/2 sheet, export tạm đã xóa. Có 2 owner, chặn tự vô hiệu hóa. Không thay membership thật để thử quyền. |

## Giao dịch trọn luồng trên bản cuối

QA tổng hợp có ghi chú không liên hệ, không sản xuất, không phải đơn thật; không gửi Zalo hoặc thanh toán.

- Lead `LEAD-912C4909DC`, ID `912c4909-dc46-42dd-b9f8-6e4460bbc71f`, mã Sheet `YC-FAC4561E-3B96-4005-BBF3-9DCE0F926541`.
- Gửi form → lịch sử đúng khách → admin ghi `ZL-20261009-DC764B39`, ID `dc764b39-0502-4d59-90dc-7453e9a3f0e3`.
- 8 bao ×296.000đ =2.368.000đ. Audit trước:0 giao dịch; sau ghi/reload/mở lại:1 giao dịch cùng ID. Sales outbox delivered/lần1; admin hiển thị đã đồng bộ theo mã.
- Lead new/revision1 → won/revision2. Khách đăng nhập lại/reload thấy yêu cầu hoàn tất và giao dịch đúng tổng tiền.
- QA account có tên kiểm thử, không có membership admin. Phiên owner khôi phục sau kiểm thử.

## Kiểm tra mã

Đối chiếu trực tiếp tab Yêu cầu của Sheet: mã QA mới ở A12, hai mã retry cũ ở A13/A14 đều trả “1 trong tổng số 1”. Tab Giao dịch đã chốt: mã giao dịch mới ở B4 cũng trả đúng một kết quả. Không chỉ dựa vào thông báo D1 để kết luận không ghi trùng.

Hai bản QA cũ có snapshot giỏ hợp lệ đã phục hồi: `LEAD-A2D0140978` delivered lần 6; `LEAD-B366D9922C` gặp 504 rồi tự retry, delivered lần 7. Cùng mã gốc, trạng thái Rác và revision 2 được giữ. Chỉ còn ba bản thử `LEAD-7BC5BD35E9`, `LEAD-768E107B5F`, `LEAD-6307E5CD22` thiếu dịch vụ/giỏ gốc và nằm trong Rác; không bịa dữ liệu để gửi. Retry mẫu thiếu dữ liệu trả 422 trước enqueue.

- `npm run check`: exit 0, 913 test pass; lint 0 lỗi/2 cảnh báo sẵn có window.location.assign trong AdminShell; typecheck/build thành công. Sau cập nhật quyền, nhóm test admin chạy 526/526 pass (không có fail); test chuyên biệt danh mục và batch chạy 10/10 pass.
- `node scripts/qa-admin-local-quality.mjs`: exit 0, 38 ca pass, dùng fixture local; không gán thành bằng chứng D1 thật.
- Chrome staging:36 tổ hợp đạt; email và giao dịch kiểm tra dịch vụ thật. Một lần danh sách lỗi tải tạm thời, bấm thử lại phục hồi; chưa xác định nguyên nhân.
- Browser recheck sau deploy `083c8439`: Chrome hiển thị đủ 4 danh mục; thumbnail 48×48 nằm gọn trong cột 64px, không còn đè tên/mô tả. Trang thành viên từng giữ skeleton hơn 10 giây; hard reload sau deploy tải được 2 membership owner, nút tự khóa/hạ quyền vẫn bị khóa. Đây là lỗi tải chập chờn chưa tìm được nguyên nhân, chưa đóng nghiệm thu.
- Cùng lượt rà: admin hiển thị 27 sản phẩm tổng cộng (trong đó có bản ghi QA), không được xem là 27 mặt hàng đủ điều kiện bán. Admin dịch vụ có 16 dòng: 13 đang hiển thị, 2 lưu trữ, 1 nháp; cả 13 dịch vụ công khai hiện còn thiếu MOQ/thời gian và đang hiện nhãn cần bổ sung. Hộp yêu cầu có 19 dòng, gồm dữ liệu QA và 3 bản cũ báo Google 502/503 sau 5 lần thử. Không sửa/xóa dữ liệu QA trong lượt kiểm tra này.
- Luna review điều hướng cuối không phát hiện blocker; ca giữ filter đã bổ sung theo review.
- GitNexus detect all:35 file/92 symbol/26 process, risk CRITICAL của tổng diff xuyên nhiều luồng; không partial/truncated. Phạm vi component danh mục: impact LOW, 1 caller/1 process. Không commit/push.
- git diff --check đạt. Artifact giữ cục bộ, có thể tái tạo; không commit PII/secret.

| Artifact | Vị trí từ gốc worktree |
|---|---|
| Full gate | .runtime/acceptance/full-check-final.log |
| Deploy | .runtime/acceptance/deploy-final.log |
| Chrome responsive | .runtime/acceptance/admin-responsive-36.json |
| Local browser | apps/giacong-lean-commerce/.runtime/admin-quality/results.json |
| Giao dịch QA đã đồng bộ | .runtime/acceptance/qa-sale-final.png |

## Dữ liệu kinh doanh cần chốt

Ảnh trên 8 sản phẩm đang hiển thị và 9 sản phẩm nháp được tạo bằng AI, chỉ để minh họa. 9 mặt hàng nháp lấy tên từ trang danh sách nguồn, gắn URL tham chiếu, không có giá/MOQ tự đặt và chưa mở bán. Nguồn hiện ghi 32 kết quả; đó là các chủ đề sản phẩm gia công, không phải bằng chứng về SKU có sẵn hoặc giá bán. Nội dung, giá, quy cách, MOQ/bước trên 8 sản phẩm đang hiển thị vẫn cần xác nhận kinh doanh. Ảnh AI trên 8 trang công khai chưa có nhãn minh họa nhìn thấy được; cần bổ sung nhãn qua admin khi phiên được khôi phục.

Số 13 là số nhóm dịch vụ trên staging, không phải tổng số dịch vụ. Trang thuê gia công staging hiển thị 13 nhóm và 193 trang nội dung trong kho URL cũ. Sitemap lưu tại repo có 237 URL tổng cộng; 192 URL riêng lẻ là trang dịch vụ, còn một URL trong bộ đếm của directory là trang danh mục. Trang nguồn hiện tại lại công bố 238 bài dịch vụ thuộc 7 công đoạn (sấy, chiết xuất, cô đặc, đóng gói, nghiền, phối trộn, sơ chế). Đây là hai tập dữ liệu/phiên bản khác nhau; cần đối chiếu và bổ sung các URL mới trước bàn giao. Không nhập 238 bài thành 238 dịch vụ thương mại vì chúng là trang nội dung. Danh mục tin tức trong sitemap cũ chỉ có URL archive `/tin-tuc/`; không có bài tin riêng được bắt trong manifest, và khi rà nguồn công khai hiện tại trang này đang báo “Nothing Found”. Vì vậy chưa có căn cứ để phục hồi thêm bài báo cũ.

Nhập CSV 12 dòng xem trước hợp lệ nhưng endpoint staging trả lỗi máy chủ chung. Ngay sau lần thử đó D1 staging vẫn có 15 bản ghi ban đầu, 0 SKU AI và 0 marker import; batch không ghi dở. Cloudflare tail đồng thời ghi Worker vượt CPU limit ở `GET /api/admin/products?page=1` và `POST /api/admin/products`; dashboard account là Free, có giới hạn 10 ms/request. Đây là nguyên nhân đã xác nhận cho các lần admin chập chờn, nhưng chưa có log riêng cho request import nên chưa xác nhận đó là nguyên nhân trực tiếp của lỗi import. Đã tạo thêm 3 bản nháp #25–#27 (Bột đậu nành rang, Hoa cúc sấy nguyên bông, Tinh bột sắn biến tính); Chrome xác nhận danh sách có 27 bản ghi tổng cộng. Ba ảnh tương ứng đã sinh nhưng chưa tải lên/gắn trong lượt này; giá, MOQ và quy cách vẫn để trống, các bản nháp chưa công bố.

514 ảnh legacy chưa được gán vì chưa xác minh ảnh nào đại diện đúng 8 sản phẩm. Các ảnh AI hiện dùng đã tải qua trình quản trị staging; không tự đổi chúng thành ảnh thật.

Production có cổng riêng trong PRODUCTION_ACCEPTANCE_CHECKLIST.md. Không đưa dữ liệu QA, mật khẩu, token hoặc export khách vào gói bàn giao.

## Bổ sung nghiệm thu 2026-10-10

- Phát hiện và sửa lỗi responsive tái hiện được ở modal “Quản lý danh mục”: toolbar bị ép cùng hàng khiến nội dung tràn ngang tại 390 px; các thẻ danh mục thiếu nhãn cho thứ tự và trạng thái. Toolbar nay xếp dọc trên màn hình nhỏ, thẻ có nhãn trường rõ ràng. Deploy staging `fa32f905-6a9a-4350-8bab-83fdcc2dac28` đạt 100%.
- Chrome sau deploy: modal danh mục được kiểm tra ở 360, 390 và 1440 px; không còn thanh cuộn ngang, các thao tác sửa/ẩn hiển thị nguyên vẹn. Trang sản phẩm được kiểm tra ở 390 px; chi tiết ở 390, 768 và 1440 px; thông tin quy cách và chú thích ảnh AI đọc được. Tài khoản 390 px hiển thị lỗi rõ cho số QA lặp `0000000000`. Sửa sản phẩm → danh sách, mở mục khác, Back/Forward và reload giữ đúng URL/bản ghi; không thấy lỗi console trong lượt này.
- Danh sách sản phẩm staging có 8 mục đang công khai; Chrome xác nhận cả 8 thẻ có nhãn ảnh AI. Đây là ảnh minh họa, không phải ảnh hàng hóa xác thực. Trang chi tiết cũng ghi chú ảnh có thể khác thực tế.
- Kiểm thử hiện tại: admin 529/529; contact 15/15; services 29/29; danh mục + responsive tables 17/17; export/list/detail tập trung 57/57. Lint 0 lỗi, còn 2 cảnh báo `window.location.assign()` trong `AdminShell.tsx`; typecheck không báo lỗi. Build Next/OpenNext và deploy staging hoàn thành. Lượt `npm run check` tổng hợp trước đó đã tới bảng route build nhưng tiến trình không trả mã thoát, nên không ghi nhận là cổng tổng hợp pass.
- Đo HTTP tài liệu `/san-pham` sau deploy: tại POP CDG, cache miss khoảng 3.085 ms; cache hit 320–343 ms. Lượt đo khác tại POP HKG trước đó là 1.037 ms miss và 106–118 ms hit. Kết quả phụ thuộc POP/đường mạng; cache staging hiện 30 giây nên tải lạnh vẫn chậm và vấn đề tốc độ chưa được đóng.
- Chưa dọn dữ liệu QA khỏi staging; admin vẫn có 28 bản ghi sản phẩm tổng cộng và tài khoản staging còn yêu cầu/giao dịch QA. Không xóa hoặc ẩn hàng loạt trong lượt này. Hai membership admin đang hoạt động có toàn quyền; chưa thay đổi quyền truy cập.
- Chưa có nguồn xác thực để chốt giá, quy cách, MOQ, thời gian, công bố sản phẩm nháp hoặc khẳng định nội dung kỹ thuật cho khách. Đồng bộ webhook/import và kiểm thử thủ công đầy đủ xác minh email, đặt lại mật khẩu, quyền theo từng tài khoản, xuất Excel, upload media và thông báo lỗi vẫn cần nghiệm thu riêng trước khi bàn giao.

## Cập nhật nghiệm thu 2026-10-10 — tìm kiếm, mobile và tốc độ

- Tái hiện được lỗi kính lúp header: markup nguồn đặt icon trong liên kết `href="#"`; bước lọc liên kết rỗng đã bỏ thẻ `<a>` và chỉ để lại icon. Sửa chuẩn hóa để gán đích `/san-pham/#catalog-query` và nhãn truy cập “Tìm sản phẩm” trước bước lọc.
- Deploy staging `95508111-ee22-4718-b7ed-40918a474f08`. Chrome hồ sơ Công Việc xác nhận liên kết có mặt. Trên viewport điện thoại 390 px, bấm kính lúp mở menu tìm kiếm và focus ô nhập; gửi “gạo lứt” trả về 1 sản phẩm (“Bột gạo lứt xay mịn”). Trang danh sách tại 390 px không tràn ngang; ô tìm kiếm trong danh sách cũng trả đúng kết quả.
- Responsive Tester tạo tab viewer riêng qua `chrome-extension://`; browser bridge chặn trang nội bộ này theo URL policy. Dùng viewport responsive 390 px để kiểm tra trang, chưa hoàn thành ma trận extension nhiều thiết bị ở lần cập nhật này.
- Sau deploy, request canonical `GET /san-pham/` trả HTTP 200, không redirect. Ba request cache HIT có thời gian TTFB 0,26–2,48 giây và tổng 0,36–2,76 giây; một phản hồi ghi `cfWorker=28 ms`, `cfEdge=399 ms`, còn TTFB phía client 0,90 giây. Cache được hit nhưng độ trễ vẫn dao động và chưa thể coi vấn đề lag đã đóng. Trình duyệt nhúng gặp trang `ERR_TOO_MANY_REDIRECTS` khi điều hướng tiếp sau lượt tìm kiếm, trong khi Chrome hồ sơ Công Việc tải lại trang canonical thành công và kiểm tra HTTP cũng trả 200; cần tái kiểm tra ở lần rà tiếp theo.
- Chrome DevTools performance-trace MCP không có trong phiên này, nên chưa đo LCP/INP hoặc xác định phần tải nào chiếm thời gian. Không coi các phép đo HTTP đơn lẻ là Core Web Vitals.
- Sửa được kính lúp chưa làm thay đổi các cổng còn lại: dữ liệu kinh doanh vẫn cần nguồn xác thực; nghiệm thu responsive đầy đủ, hành trình tài khoản trên phiên đăng nhập, luồng admin và độ trễ ổn định vẫn chưa đóng.

## Cập nhật tiếp 2026-10-10 — phiên tài khoản, ảnh nháp và bố cục

Các kết quả dưới đây thay thế trạng thái kiểm tra tương ứng ở các lượt trước; không phải xác nhận bàn giao toàn hệ thống.

- Staging `08a16228-fed9-4775-bb33-c2036651721a`: phân biệt lỗi kiểm tra phiên với hết phiên thật. Lỗi kết nối nay có thông báo và nút “Thử lại”; nội dung riêng vẫn được giữ kín. Test trạng thái lỗi/phiên bị thu hồi đạt; Chrome đăng nhập Google trở lại admin và trang tài khoản tải được. Chưa mô phỏng offline trên Chrome để nghiệm thu nhánh thông báo lỗi.
- Bốn bản nháp #25–#28 đã tải ảnh AI qua Chrome, lưu và tải lại xác nhận URL R2 còn nguyên: Bột đậu nành rang, Hoa cúc sấy nguyên bông, Tinh bột sắn biến tính, Trà đen nguyên chất. Giữ trạng thái nháp, không thêm giá/MOQ giả. Có tên trùng với sản phẩm công khai nên tổng số bản ghi không chứng minh đủ 20 mặt hàng riêng biệt.
- Rà 11 màn hình admin ở 390/768/1440 px (33 tổ hợp) phát hiện ảnh xem trước logo làm trang Nội dung rộng 401 px ở viewport 390 px. Đã sửa và Chrome tải lại xác nhận không tràn ở 360/390/768/1440 px. Đây là kiểm tra chiều rộng trang và giới hạn control, không bao phủ mọi modal/editor.
- Cả 8 trang chi tiết sản phẩm công khai ở 390/768/1440 px (24 tổ hợp) tải ảnh và không có control tràn ngang. Trang tài khoản và giỏ cũng đạt ba kích thước này. Kính lúp trên tài khoản mobile mở ô tìm kiếm và focus được.
- Thử sản phẩm carton: đổi số lượng 10 → 150 áp dụng giá bậc 632.000đ, giỏ xác nhận tổng 94.800.000đ; xóa đúng dòng vừa thêm và khôi phục giỏ trống. Không gửi yêu cầu/giao dịch trong lượt này.
- `npm run check` sau sửa phiên trả exit 0: 931 test đạt, lint 0 lỗi/2 cảnh báo có sẵn; typecheck/build đạt. Deploy logo có build Next/OpenNext đạt và exit 0. Không commit/push, production không đổi.
- Cloudflare 1102 được tái hiện trên Chrome. Tail ghi `exceededCpu` tại `/api/admin/services` (21 ms, HTTP 503), `/api/admin/session` và `/admin/yeu-cau/` (10 ms). Vấn đề tài nguyên gây lỗi tải chập chờn chưa đóng; đang chờ quyết định chi phí Workers Paid. Các trang tải lại được sau deploy không chứng minh lỗi đã hết. Chưa có DevTools MCP để đo LCP/INP.
- Artifact cục bộ, có thể tái tạo: `.runtime/acceptance/admin-e72407b4-matrix.json`, `storefront-product-final-matrix.json`, `logo-preview-mobile-fixed.jpg`; log gate/deploy ở `.runtime/` của app. Raw tail có thể chứa dữ liệu riêng, không đưa vào gói bàn giao.
- Bản tiếp theo `af56bb69-4da3-4025-a881-a8035feb59c4` sửa lỗi CSS ở Thiết kế trang: quy tắc desktop không có layer ghi đè breakpoint trong layer, khiến khung xem trước đè biểu mẫu ở 390 px. Chrome sau reload đạt 320/360/390/768/1024/1440 px; thêm cả sáu loại khối chưa lưu và kiểm tra control ở 320/390/768/1440 px đều không tràn. Reload khôi phục trang không có khối và nút lưu bị khóa, không phát hành nội dung thử. Artifact: `builder-final-matrix.json`, `builder-mobile-before.jpg`, `builder-mobile-fixed.jpg` trong thư mục acceptance ở gốc worktree. Deploy exit 0; `npm run check` chạy lại sau sửa CSS trả exit 0, toàn bộ 931 test đạt, lint 0 lỗi/2 cảnh báo sẵn có, typecheck/build đạt (`.runtime/acceptance-check-builder-final.log` của app).
- Review độc lập Luna cho thay đổi phiên và CSS logo/builder không phát hiện lỗi thực tế; không mở rộng kết luận đó sang toàn bộ diff kế thừa hoặc các luồng chưa nghiệm thu.

- Cập nhật tài nguyên 2026-10-10: [bằng chứng tối ưu Cloudflare](CLOUDFLARE_RESOURCE_OPTIMIZATION_2026-10-10.md). Bản cuối `ecad6dd2-0923-41dd-a04d-494d8747292a`: Worker giảm 31.7%, bỏ prefetch thừa, tái sử dụng auth đã khởi tạo, dọn một KV thử nghiệm rỗng. 934 test đạt, deploy và QA Chrome đạt trong phạm vi đã ghi. Tải lạnh tài khoản vẫn 4.3 giây; nghiệm thu hiệu năng/toàn hệ thống chưa đóng, không đổi billing/production.

## Kiểm tra tiếp — 10/10/2026

- Chrome trên staging xác nhận `/san-pham/` hiển thị 8 sản phẩm đang bật; cả 8 ảnh có nhãn “Ảnh minh họa do AI tạo”. Tìm “gạo lứt” bằng ô tìm kiếm trả đúng 1 kết quả; tải lại giữ bộ lọc và nội dung.
- Tail của Worker `ecad6dd2-0923-41dd-a04d-494d8747292a` trong cùng lượt smoke ghi một invocation `exceededCpu` tại ngưỡng 10 ms, HTTP 503. Các lượt tải tiếp theo thành công (CPU ghi nhận 65–1563 ms, HTTP 200), nên lỗi CPU vẫn xảy ra chập chờn, chưa đóng. Không coi kết quả tìm kiếm thành công sau tải lại là nghiệm thu ổn định. Chưa có CPU profile để quy lỗi cho một hàm cụ thể.
- Cloudflare công bố Workers Free giới hạn 10 ms CPU/request; tài liệu cũng cảnh báo invocation vượt limit có thể được dung thứ không thường xuyên nhưng bị kết thúc khi tình trạng lặp lại. [Giới hạn Cloudflare Workers](https://developers.cloudflare.com/workers/platform/limits/). Không đổi gói tính phí.
- Đọc D1 staging chỉ đọc: 28 dòng sản phẩm; 8 đang bật. Trong 28 dòng, 19 tên sản phẩm riêng không mang dấu QA (ba dòng #25–27 trùng tên với dòng khác), sáu dòng QA (#10–15), còn #7 thiếu ảnh; mười sản phẩm sữa/trà #16–24/#28 chưa có biến thể. Không đủ điều kiện công bố 20 sản phẩm như danh mục có thể yêu cầu/báo giá và không tự điền giá, MOQ hoặc quy cách.
- Trang dịch vụ đã có 13 nhóm và kho 193 URL nội dung; số nhóm không phải số trang dịch vụ. Lượt này chưa đối chiếu toàn bộ 193 URL hoặc 238 trang dịch vụ đang được nguồn công bố.
- GitNexus MCP không kết nối; lần index CLI dự phòng thất bại khi bộ nhớ LadybugDB đầy. Không sửa mã trong lượt này khi chưa có phân tích impact khả dụng cho custom Worker. `npm run check` gần nhất vẫn là 934/934, từ trước kiểm tra trực tiếp này.
- Kết luận: lỗi CPU trên Worker Free, danh mục kinh doanh chưa đủ dữ liệu xác thực, và nghiệm thu luồng admin/Responsive Tester extension trên ma trận đầy đủ còn mở. Bản hiện tại chưa đủ điều kiện bàn giao cuối.

## Bản staging d157bd03 — sửa và kiểm tra tiếp 10/10/2026

- Khôi phục GitNexus CLI bằng buffer pool riêng 2 GiB; index thành công. Các cảnh báo thiếu nhánh/flow vẫn được giữ làm giới hạn của phân tích. Impact `formatVnd` và `siteBrandStyles` là CRITICAL và đã báo trước sửa; Worker entry là UNKNOWN, xác nhận thêm bằng cấu hình `main` và export.
- CPU profile local xác định module khởi tạo `Intl.NumberFormat` VND có khoảng 70 ms self time trong lượt nạp danh mục. Thay bằng nhóm chữ số/rounding cho khoản VND thông thường, giữ formatter dự phòng cho giá trị ngoại lệ. Test đối chiếu hơn 2.000 giá trị và kiểm tra không khởi tạo ICU đạt. Đây là sửa một điểm nóng, không phải chứng minh mọi request nằm dưới limit.
- Chrome tái hiện kính lúp mobile trắng trên nền trắng, vùng bấm chỉ rộng khoảng 15 px. Đã sửa màu và vùng bấm 44 × 44 px. Test trình duyệt 390/768/849/1024 px đạt; bản deploy xác nhận màu `rgb(31,51,32)`, vùng bấm 44 × 44, không tràn ngang. Tìm “gạo lứt” từ menu mobile trả đúng một kết quả.
- Gốc `admin-staging.kienhieu.id.vn/` trước đây mở storefront; nay GET/HEAD trả 307 sang `/admin/`, giữ query và no-store. Production, API, các đường dẫn khác và POST không đổi. Host admin riêng hiện mở đúng cổng đăng nhập; nghiệm thu phiên dưới host này chưa đóng. Phiên Google hiện có dưới `staging.kienhieu.id.vn/admin/` mở được tổng quan và danh sách sản phẩm, hiển thị Admin toàn quyền.
- Modal danh mục đã được kiểm tra lại trên bản cuối: desktop không còn thumbnail đè tên; ở 390 px ảnh 48 px và chữ nằm trong card, document không tràn ngang. Escape đóng modal. Chuỗi editor #28 → Quay lại danh sách → mở #27 → Back → Forward → reload giữ đúng sản phẩm và URL; không ghi thay đổi dữ liệu.
- `npm run check` trả exit 0: 939 test, lint 0 lỗi/2 cảnh báo có sẵn, typecheck/build đạt. Sau đổi phiên bản khóa HTML cache, 4 test cache đạt. OpenNext build đạt. Helper nạp cache R2 thất bại 500/timeout cả khi giảm đồng thời; thay bằng CLI R2 chính thức, dùng hàm tạo khóa của OpenNext cùng phiên bản, nạp 11 mục và tải lại đối chiếu SHA-256 từng mục. Deploy Wrangler với cấu hình staging và tắt tự phát hiện framework trả exit 0.
- Worker cuối `d157bd03-8367-4a50-90e7-5be9d4d99b2e`: 8102.02 KiB, gzip 2025.70 KiB, startup 18 ms. Chỉ deploy staging; không đổi billing, production hay D1 nghiệp vụ.
- Tail đã lọc PII trên bản này: `/san-pham/` 200, CPU 646 ms/wall 1029 ms; `/admin/` 200, CPU 525 ms/wall 595 ms rồi 14/53 ms; `/api/admin/categories` 200, CPU 13/wall 359 ms. Gốc host admin 307, CPU/wall 0. API session host admin chưa đăng nhập trả 401 đúng cổng admission. Không ghi `exceededCpu` trong hai cửa sổ tail ngắn này; CPU vẫn vượt 10 ms và không đủ bằng chứng đóng lỗi 1102/hiệu năng lạnh.
- Artifact có thể tái tạo ở `.runtime/acceptance/`: log check/build/deploy, profile CPU local, manifest/hash kiểm tra cache, tail chỉ giữ pathname/timing/status, `mobile-search-fixed.png`, `category-modal-fixed.png`. Lỗi chụp viewport thu nhỏ được khắc phục khi lấy ảnh bằng clip đúng 390 × 844; đã trả viewport về mặc định.

**Cổng còn mở:** hiệu năng lạnh/1102 ổn định; dữ liệu đủ khoảng 20 sản phẩm riêng với quy cách hợp lệ và nguồn kinh doanh xác thực; đối chiếu đầy đủ nội dung/URL cũ; QA cleanup có phục hồi; đồng bộ/retry và các nhánh lỗi tài khoản/phiên/lưu dữ liệu trên bản cuối. Không xác nhận bàn giao toàn hệ thống.

## Cập nhật mới nhất — staging 2026-10-10

- Sau khi người dùng cho phép dữ liệu demo trên staging, đã rà/lưu MOQ demo `1.000 sản phẩm (demo)` và thời gian demo `14 ngày` cho 13 dịch vụ đang công khai. Reload admin xác nhận đủ 13 dòng đang hiển thị cùng điều kiện; 2 bản ghi lưu trữ và 1 bản nháp vẫn giữ trạng thái. Các giá trị này không phải cam kết kinh doanh.
- Thêm thông báo dùng dữ liệu demo trên trang danh mục dịch vụ và trang chi tiết nhóm dịch vụ. Build OpenNext báo hoàn tất; Wrangler báo deploy thành công lên Worker staging `giacong-vn-staging`, version `c6259d55-7829-4052-87d2-d4757fb703f9`. Không deploy production.
- Chrome staging sau deploy xác nhận danh mục dịch vụ hiển thị thông báo staging và `13 nhóm · 193 trang nội dung`; trang `Gia công bột` hiển thị cùng cảnh báo, MOQ demo và thời gian demo. Footer/liên hệ nhanh hiển thị hotline/Zalo `0868408115`.
- Phân trang sản phẩm đã có trong implementation: D1 nhận `page`, kích thước trang cho phép 12/24/48, URL giữ bộ lọc/tìm kiếm và kết quả ngoài phạm vi được chặn/clamp. Hiện staging có 8 sản phẩm công khai nên nút trang 2 không xuất hiện; chưa nghiệm thu trực tiếp chuyển trang trên dữ liệu staging >12 sản phẩm. Test listing mới: 14/14 báo pass; OpenNext đã qua biên dịch/TypeScript và tạo Worker.
- Tình trạng 1102/lag chưa đóng: trước và trong các lần thao tác admin đã có Worker Error 1102/`exceededCpu`. Các trang tải lại thành công và deploy mới không chứng minh lỗi CPU chập chờn đã hết; cần đo lại có kiểm soát trên bản này và profile đường xử lý nếu còn tái hiện. Không đổi gói Cloudflare.
- Responsive Tester toolbar có mặt trên Chrome; khi thử mở trang viewer của extension, chính sách URL của browser bridge chặn giao thức `chrome-extension://`. Không truy cập vòng qua công cụ khác. Bằng chứng responsive trước đó vẫn là ma trận viewport bằng trình duyệt; chưa xác nhận kiểm thử đa màn hình trực tiếp trong extension ở lượt này.
- `git diff --check` không phát hiện whitespace lỗi (chỉ cảnh báo chuyển LF→CRLF trên ba file đã sửa từ trước). Không commit/push. Bản staging chưa được coi là nghiệm thu cuối.


