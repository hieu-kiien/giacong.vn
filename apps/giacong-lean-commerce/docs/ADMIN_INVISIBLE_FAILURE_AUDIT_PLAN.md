# Kế hoạch rà soát lỗi ẩn và lỗi giao diện Admin

Cập nhật: 2026-09-26. Đây là sổ theo dõi theo từng lát cắt; không thay thế cổng staging/production hiện có.

## Những điểm đã xác nhận trong đợt này

- Runner `qa:ux` trước đây luôn thoát mã `0`, dù đã ghi action hỏng, lỗi trang, lỗi mạng, tràn ngang hoặc kiểm tra axe không chạy. Đã thêm bộ phân loại verdict: lỗi trả mã `1`, thiếu bằng chứng trả mã `2`, chỉ đạt đầy đủ mới trả `0`.
- Các trang con `/admin` chưa có error boundary riêng cho lỗi render bất ngờ. Đã thêm màn hình khôi phục có nút thử lại, đường về tổng quan và mã digest khi có; không hiển thị thông tin lỗi nội bộ. Error boundary của segment không bắt lỗi phát sinh trong chính `admin/layout.tsx`, nên lỗi tải cấu hình/layout vẫn cần cổng theo dõi riêng.
- Đã bổ sung boundary dùng chung ở `src/app/error.tsx` để bắt lỗi từ layout/page con (kể cả `admin/layout.tsx`) và `src/app/global-error.tsx` cho lỗi root layout; cả hai ghi lỗi ở server/browser console, chỉ hiện digest an toàn, có thử lại và đường về.
- Error API Admin hiện ghi object gồm `requestId` và lỗi gốc; response lỗi giữ ID trong body và `X-Request-ID`. Client lưu ID trên `AdminClientError`, hiện mã cho lỗi 5xx, và lấy header khi body JSON bị hỏng. Test xác nhận lỗi nội bộ không lộ ra response và lỗi validation không bị đổi câu chữ.
- Toast lỗi và toast thành công trước đây dùng cùng `role="status"`. Đã chuyển lỗi sang `role="alert"`, status cho thành công/thông tin; vị trí toast đã được sửa ở lát cắt trước để tránh đè topbar.
- Kiểm tra tiếp vòng đời toast thấy lỗi cũng tự biến mất sau 4,5 giây. Đã đổi để lỗi tồn tại tới khi đóng, chỉ success/info tự đóng; timer được dọn khi đóng/unmount. Khi đầy stack, success/info cũ bị thay trước; lỗi không bị xóa âm thầm và lỗi trùng thông điệp được gộp. Stack lỗi dài cuộn bên trong theo chiều cao viewport; nội dung dài có `overflow-wrap:anywhere`. Toast desktop nằm dưới topbar, tablet/mobile xuống cạnh dưới. Nút đóng có vùng bấm 24×24px và focus ring rõ.
- Ca 503 adversarial với chuỗi lỗi không có điểm ngắt đã tái hiện document rộng 831px ở viewport 390px do cảnh báo inline của form. Đã bẻ dòng an toàn cho `.admin-editor-error`, field error và danh sách lỗi; retest lỗi cùng request ID dài ở 390px/1440px đạt, document giữ đúng 390px/1440px, toast còn sau 4,7 giây rồi đóng được. Request mutation bị Playwright intercept ở local fixture, không chạm API/D1/R2.
- Ca trên cũng phát hiện một save failure đang xuất hiện cùng lúc ở form và toast dưới hai `role="alert"`. Nội dung vẫn tiếp cận được nhưng có nguy cơ screen reader đọc trùng; cần rà các luồng tương tự và chọn một vùng announce cho mỗi lỗi.
- `observability.enabled` đang bật ở cấu hình Worker gốc và staging. Cấu hình này chưa chứng minh có người theo dõi log/alert thường xuyên.

## Bằng chứng trình duyệt — 2026-09-26

Runner `qa:ux` đã chạy trên staging công khai và Cloudflare OpenNext preview local. Mỗi lượt bao phủ 5 lần mở route, thao tác menu/tìm kiếm/form không hợp lệ và quét 6 kích thước viewport. Cả hai lượt đều có 0 lỗi console/page, 0 HTTP 4xx/5xx, 0 first-party request lỗi, 0 overflow, 5 lượt axe chạy và 0 vi phạm nghiêm trọng/critical; action đều đạt. Báo cáo và ảnh được lưu ở [staging](../../../docs/ux-audit/2026-09-26/audit.json) và [local preview](../../../docs/ux-audit/2026-09-26-local/audit.json).

Có một warning không làm hỏng gate: axe-core 4.10 phát `postMessage` sai origin khi kiểm tra iframe Google Maps; stack trỏ vào bundle axe, không phải code app. Warning được giữ trong báo cáo để không biến thành lỗi sản phẩm giả. LCP được chụp trước full-page screenshot/scroll vì thao tác QA có thể làm PerformanceObserver chọn nhầm ảnh lazy dưới fold.

Runner trước đây bấm menu trước khi React hydrate trên staging chậm; giờ chờ nút menu client được gắn. Kiểm tra chuyển động mobile cũng tôn trọng thiết kế tắt reveal dưới 550px và xác nhận ảnh lazy-load thay vì đòi hiệu ứng không được dùng. Bộ lọc lỗi mạng chỉ bỏ qua Next RSC GET bị hủy do điều hướng và Cloudflare RUM POST; lỗi first-party ảnh/API vẫn là lỗi thật.

QA Admin fixture đạt **30/30**, exit code 0; bao gồm 12 route tại 390/1366/1920px, trạng thái dữ liệu lỗi, giữ bản nháp, retry, điều hướng bàn phím và 503 lỗi lưu sản phẩm tại 390/1440px. Request ghi chỉ được route-intercept và trả fixture lỗi ở local; không có API mutation thật. Ảnh tái tạo được trong `.runtime/admin-quality/`.

## Thứ tự xử lý

| Ưu tiên | Phạm vi | Cách tìm lỗi | Điều kiện đóng |
|---|---|---|---|
| P0 | Cổng QA và lỗi render | Ép runner đi qua lỗi action, JS, HTTP, network, overflow và thiếu axe; kiểm tra error boundary bằng build và browser | Cổng storefront đã chạy trên staging/local; runner trả non-zero khi lỗi; trường hợp thiếu bằng chứng không được báo đạt |
| P1 | Thông báo và trạng thái thao tác | Kiểm tra thông báo success/error/loading ở desktop, tablet, mobile, bàn phím và screen reader; rà nhiều toast, chữ dài, nút đóng | Không có thông báo thành công giả; lỗi quan trọng còn đọc được và có trạng thái inline khi cần |
| P1 | Form và API Admin | Với từng luồng ghi, mô phỏng 401/403/409/422/429/5xx, mất mạng, timeout, JSON hỏng và kết quả chưa rõ; xác nhận đang lưu, giữ dữ liệu người dùng và khóa gửi lặp | Mỗi nhánh có thông báo đúng, không mất dữ liệu form, không báo thành công khi chưa xác nhận |
| P1 | Dữ liệu sau khi lưu | Đối chiếu response API, postcondition trong D1/R2, tải lại từ API Admin, rồi kiểm tra trang public và cache/revalidate | Giá trị lưu, giá trị đọc lại và nội dung storefront nhất quán |
| P2 | Ảnh và URL sản phẩm | Thử ảnh ngang/dọc/vuông, ảnh lỗi, upload thất bại, đổi ảnh chính, slug đổi tên và slug trùng | Không cắt ảnh ngoài ý muốn; fallback rõ; đường dẫn mới và redirect cũ đúng |
| P2 | Ma trận trình duyệt | Playwright theo viewport 360/390/768/1024/1440, màn hình nhỏ và trạng thái dữ liệu dài/rỗng; lưu trace/screenshot khi test lỗi | Không có lỗi console/page, request first-party hỏng, overflow hoặc lỗi accessibility nghiêm trọng |
| P2 | Nhật ký và truy vết | Gắn request ID giữa thông báo/API/log; xác nhận log được giữ, tìm được trên Cloudflare và có người nhận cảnh báo | Từ mã hiển thị trên màn hình tìm được lỗi tương ứng mà không lộ chi tiết nội bộ |

## Cổng kiểm tra cho mỗi thay đổi

1. Tái hiện hoặc tạo fixture mô phỏng lỗi trước khi sửa; ghi rõ kết quả nhìn thấy và dữ liệu sau thao tác.
2. Dùng GitNexus để xem luồng và blast radius trước khi sửa symbol; mức `UNKNOWN` cần kiểm tra thêm bằng tìm kiếm mã nguồn.
3. Viết kiểm tra hợp đồng cho logic, sau đó kiểm tra giao diện bằng browser ở trạng thái thành công và lỗi.
4. Chạy `npm run check`; với kiểm tra runtime dùng `qa:ux` trên local/preview và `qa:admin-staging` chỉ đọc. Mọi thao tác ghi cần dữ liệu test có thể dọn sạch; không chạy trên production.
5. Lưu kết quả, ảnh/trace và các điều kiện môi trường không kiểm tra được. Không coi “không thấy lỗi” là bằng chứng nếu log, axe hoặc request không thu được.

## Việc kế tiếp

- Chạy lại QA Admin fixture sau thay đổi giao diện lớn và giữ ca toast lỗi 503 desktop/mobile trong runner để bắt tái phát.
- Chạy `qa:admin-staging` chỉ đọc sau khi có phiên owner Access: môi trường hiện không có `QA_ADMIN_STORAGE_STATE` hoặc role-state file. Xác nhận staging bằng UI thật; không lưu phiên vào Git hoặc chia sẻ cookie.
- Quét tĩnh 42 module route Admin: 41 route dùng `adminFailure`/`adminErrorFrom`; route `/admin/session` ủy quyền cho `handleAdminSession`, hàm này cũng trả qua hai helper chung. Không thấy route nào tự tạo `Response.json` hoặc `new Response`. Đây là bằng chứng bao phủ mã nguồn, chưa thay cho mô phỏng runtime từng route theo các mã 401/403/409/422/429/5xx.
- Rà các mutation Admin theo nhóm sản phẩm/ảnh, bài viết, danh mục/dịch vụ, điều hướng/cấu hình và CRM; so message với postcondition thật.
- Đối chiếu semantics toast với lỗi inline để một lần thất bại chỉ được announce một lần; lỗi form vẫn cần nằm cạnh trường/cả form sau khi đóng toast. Lỗi thao tác hàng loạt phải giữ danh sách dòng chưa xác nhận để không tạo cảm giác đã lưu hết.
- Xác minh sampling/retention/alert trên môi trường Cloudflare đang chạy; file cấu hình một mình không xác nhận được dashboard hoặc quy trình trực ca. Mã ID đã nối ở code, nhưng chưa xác nhận dashboard hoặc quy trình trực ca.

## Tham khảo cách kiểm chứng

- [W3C WCAG 2.2 — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html): status cần được công nghệ hỗ trợ nhận biết mà không phải đổi focus; status thường và alert lỗi cần semantics phù hợp.
- [W3C WCAG 2.2 — Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): kiểm tra kích thước tối thiểu cho nút đóng trên màn hình cảm ứng.
- [Next.js — Error Handling](https://nextjs.org/docs/app/getting-started/error-handling): ranh giới lỗi theo segment, fallback root và giới hạn của từng boundary.
- [Cloudflare Workers — Errors and exceptions](https://developers.cloudflare.com/workers/observability/errors/) và [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/): exception cần được quan sát cùng log thực thi; cấu hình bật không tự chứng minh retention/alert.
- [Playwright — Trace Viewer](https://playwright.dev/docs/trace-viewer) và [Assertions](https://playwright.dev/docs/test-assertions): giữ trace/screenshot khi ca lỗi, chờ UI bằng assertion thay vì sleep không gắn với điều kiện; sleep 4,7 giây ở ca toast là chủ ý để kiểm tra lỗi tồn tại sau timeout cũ.
