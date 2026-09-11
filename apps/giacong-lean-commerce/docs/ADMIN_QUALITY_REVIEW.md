# Kiểm duyệt và hoàn thiện admin — 2026-09-06

Phạm vi: cải thiện admin hiện tại trên nhánh `codex/admin-quality-completion`,
giữ các thay đổi có sẵn trong workspace. Bản mới đã triển khai riêng staging;
không push hoặc thay đổi production. Không thay thế production acceptance.

## Kết quả cập nhật — 2026-09-07

Đã triển khai staging `83384ce2-c68a-43a9-b15c-ec784ec13158`: chỉ còn
**Admin toàn quyền** (`owner`) theo yêu cầu trực tiếp, role cũ bị chặn ở
admission/session/capability và không còn lựa chọn trong UI. Giữ nguyên một
tài khoản hiện có, Access, audit và bảo vệ admin cuối cùng. Banner storefront
đã chiếm chỗ trong layout, không che thanh chỉnh sửa ở desktop/tablet.

Gate cuối: **561/561 test**, **17/17 admin browser**, **18/18 inline browser**,
lint/typecheck/build **27/27**, OpenNext build/dry-run/upload đạt. Sau deploy,
Access owner đọc **10 route × 2 viewport** không overflow/alert/exception;
member UI một tài khoản active và role read-only; inline hero mở đúng tại chỗ.
Luna review không có blocker staging; ghi điều kiện xử lý row role cũ trước
rollout môi trường khác tại production checklist. Không mutation tài khoản,
production, commit hoặc push. Các kết quả 558 test dưới đây là mốc lịch sử.

## Vấn đề đã xử lý

| Vấn đề quan sát được | Thay đổi |
| --- | --- |
| Menu điện thoại che nút đóng, Escape không có tác dụng | Nút đóng trong menu, nền che có thể bấm, giữ focus, khóa cuộn nền và trả focus khi đóng |
| Tổng quan nằm dưới nhóm Cài đặt; dashboard lặp số liệu, công việc bị đẩy xuống dưới | Đưa Tổng quan lên đầu, giảm số liệu trùng, đưa yêu cầu mới và công việc thường dùng lên vùng nhìn chính |
| Sales được dẫn tới catalog không có quyền; viewer thiếu lối vào dịch vụ/yêu cầu dù có quyền đọc | Dùng capability `.read` cho lối tắt và số liệu tương ứng; giữ nguyên kiểm tra quyền phía server |
| CSV chiếm phần đầu trang sản phẩm; ảnh lớn và bảng rộng che nút sửa | Thu gọn CSV, giảm kích thước ảnh, cố định thao tác desktop; điện thoại hiển thị từng mục với tên, giá, trạng thái và nút thao tác |
| Icon tìm kiếm đè nhãn; chữ phụ khó đọc; một số trạng thái không được thông báo | Căn icon theo ô nhập, tăng tương phản chữ phụ, thêm trạng thái loading/error cho trình đọc màn hình, hỗ trợ giảm chuyển động |
| Tin tức, nội dung, thiết kế trang, menu, dịch vụ và tài khoản chưa đăng ký bảo vệ bản nháp | Dùng cơ chế unsaved hiện có để chặn chuyển mục và tải lại trình duyệt; xác nhận khi hủy tin/dịch vụ và khi bấm tải lại menu/tài khoản |
| Đổi lịch sử từ Next gây cảnh báo cập nhật state trong `useInsertionEffect` | Hoãn thông báo thay đổi URL tới microtask, kiểm tra lại Back/Forward với bản nháp |
| Form tạo trang trùng ID giữa tiêu đề và ô nhập | Tách ID tiêu đề khỏi ID trường Tên trang |

Các component được sửa trực tiếp: `AdminShell`, `AdminPrimitives`,
`AdminUnsavedGuard`, `AdminPageBuilder`, `AdminNavigationManager`,
`AdminMembersManager`; các trang dashboard/sản phẩm/dịch vụ/tin tức/nội dung
và `admin.css`. Không bổ sung dependency, API hay mô hình dữ liệu.

GitNexus impact trước sửa: các component/trang ở mức LOW;
`AdminLoadingTable` có 6 caller và `AdminErrorState` có 10 caller trực tiếp
(MEDIUM). Đồ thị không báo execution process liên quan; phạm vi layout thực tế
vẫn bao gồm toàn bộ admin, nên có kiểm tra 10 route.

## Kiểm chứng và cách chạy lại

Kết quả cuối: **558/558 test**, **17/17 ca browser**, lint/typecheck/build đều
đạt; static generation **27/27**. `git diff --check` không có lỗi whitespace.

- `npm run check`: admin, contact, catalog, purchase UI, service, commerce,
  listing, detail, ESLint, TypeScript và production build.
- `npm run dev -- --port 3100`, sau đó
  `node scripts/qa-admin-local-quality.mjs`: 17 ca trình duyệt; bao gồm 10 route
  ở 390px/1440px, quyền dashboard, giữ bản nháp, retry lỗi, menu và Back/Forward.
- Browser dùng API fixture cục bộ; không phải bằng chứng Access, D1/R2 hoặc
  quyền của danh tính thật. Kiểm tra bắt exception và cảnh báo lifecycle React,
  không thay thế audit accessibility tự động đầy đủ.
- Bằng chứng tái tạo được, được git-ignore:
  `.runtime/admin-quality/results.json`, ảnh trong `.runtime/admin-quality/`,
  `.runtime/admin-quality-check.log` và `.runtime/admin-quality-final.log`.
  Ảnh `before-*` là baseline của lượt này; ảnh còn lại tạo lại bởi runner.
- `git diff --check`; GitNexus `detect_changes` toàn workspace bao gồm cả diff
  có sẵn, nên không dùng số symbol đó để quy toàn bộ thay đổi cho lượt này.

Tham chiếu kỹ thuật: [React useInsertionEffect](https://react.dev/reference/react/useInsertionEffect)
không cho phép cập nhật state trong insertion effect; Next Link đối chiếu với
tài liệu đi kèm phiên bản Next được cài trong project.

## Điều kiện còn lại trước production

1. Rà soát/gom đủ các file modified và untracked có sẵn trong workspace.
   Chưa commit hay push tự động.
2. OpenNext/Cloudflare staging gate và owner setting save/publish/read-back đã
   đạt. Còn runtime write/audit cho các domain chưa đủ evidence; lỗi mạng/stale
   và media upload mới có test contract/fixture trong đợt này.
3. Theo quyết định 2026-09-07, chỉ giữ Admin toàn quyền (`owner`). Kiểm tra
   owner qua Access thật và từ chối role cũ thay thế gate năm role trước đây.
4. Hoàn tất các gate trong `PRODUCTION_ACCEPTANCE_CHECKLIST.md`, gồm dữ liệu
   thật, migration/backup/rollback và quan sát runtime. Google Sheet có evidence
   lịch sử riêng; không suy ra readiness production từ local build.

Kết luận: các sửa đổi đã có trên staging. Chưa đủ bằng chứng để tuyên bố toàn bộ
website sẵn sàng production.

## Bổ sung: chỉnh trực tiếp trên storefront — 2026-09-06

Admin owner/content manager có thể bật chế độ chỉnh trực tiếp trên storefront,
bấm vào vùng được hỗ trợ để sửa chữ, CTA/link hoặc ảnh; lưu bản nháp và xuất bản
được tách riêng. Vùng hero và about trang chủ, nhận diện logo/khẩu hiệu cùng
media picker/upload đã được kiểm tra responsive ở 390/768/1440px. Upload chỉ
nhận JPEG/PNG/WebP tối đa 8 MB; request có revision và idempotency key, lỗi hoặc
mất phản hồi giữ nguyên nội dung đang sửa.

Evidence mới: `node scripts/qa-admin-visual-edit.mjs` đạt **18/18** trên fixture
memory cục bộ; gồm save/publish từng phần, retry, stale write, upload multipart,
khôi phục ảnh đã đăng, CTA URL, điều hướng khi còn bản nháp và responsive.
OpenNext build, Wrangler dry-run và preview version `3ea32ef4-ee73-4bb4-9e4d-2a59de72e5e7`
đều đạt. Preview đã smoke test homepage/catalog/detail/cart/service; staging đã
được chuyển version này và storefront deep QA đạt. Một smoke test staging owner
đã xác nhận draft ảnh không đổi public page cho tới khi bấm Xuất bản, rồi khôi
phục lại ảnh mặc định bằng guard đúng row/version. Không có thay đổi production.

Owner read-only revalidation trên version mới: 10/10 route canonical ở desktop
và 390×844 với reduced motion đều có heading đúng, không page overflow hoặc
rendered alert; CDP không ghi Runtime.exceptionThrown/Log.entryAdded trong cửa
sổ kiểm tra. Menu mobile mở được, Escape đóng và trả focus về nút Mở điều hướng.
Đây không phải full accessibility audit hay write test của mọi màn hình.

Trang thành viên hiện chỉ có 1 tài khoản owner. Thiếu danh tính Access thật cho
content_manager/catalog_manager/sales_manager/viewer; không tự tạo hoặc đổi
quyền owner để giả lập evidence. Khôi phục cuối của hero_image_url thực hiện
qua guarded SQL (version 8 → 9, draft/published đều rỗng), không qua admin API;
do đó không tuyên bố có event admin audit cho bước SQL đó. Public read-back
đã xác nhận ảnh mặc định hero-1.png và không có admin controls.
