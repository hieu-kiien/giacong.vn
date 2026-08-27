# Hướng dẫn AI sử dụng skill `giacong-admin`

## Mục đích

Skill này dành riêng cho việc xây dựng, đánh giá và kiểm duyệt admin của Giacong.vn. Nó giúp AI làm việc trên admin hiện có theo đúng Lean V1, thay vì tự tạo một hệ thống quản trị song song hoặc kéo Bagisto quay lại runtime.

Skill repo-scoped: `.agents/skills/giacong-admin/SKILL.md`
Phạm vi ứng dụng: `apps/giacong-lean-commerce/`

## Khi nào dùng

Kích hoạt khi yêu cầu liên quan đến:

- shell, điều hướng, dashboard và trải nghiệm sử dụng admin;
- nội dung/trang, menu, thiết kế/media, cài đặt, tin tức, dịch vụ, sản phẩm/danh mục;
- review UI/UX, accessibility, responsive, loading/error/empty state hoặc kiểm duyệt thay đổi admin;
- kiểm tra admin có còn lẫn Bagisto, route cũ hoặc hợp đồng ghi dữ liệu sai hay không.

Không tự mở rộng sang quản lý thành viên/khách hàng, checkout, đơn hàng, thanh toán, page builder hoặc marketplace nếu người dùng chưa yêu cầu và tài liệu quyết định chưa cho phép.

## Cách gọi

```text
$giacong-admin kiểm duyệt toàn bộ admin hiện tại và lập danh sách lỗi theo mức độ rủi ro.
$giacong-admin cải thiện màn hình quản lý sản phẩm, giữ nguyên hợp đồng D1/R2.
$giacong-admin đánh giá giao diện admin trên desktop/mobile bằng browser và screenshot.
```

## Quy trình bắt buộc

1. Đọc `docs/CLOUDFLARE_NATIVE_V1_PLAN.md`, tài liệu current-state và write contract liên quan. Master plan Bagisto chỉ là lịch sử.
2. Kiểm kê route, component, server action/API, type, test và dữ liệu liên quan trước khi kết luận thiếu tính năng.
3. Nếu sửa function/class/method, chạy GitNexus `impact` hướng upstream trước; nếu HIGH/CRITICAL phải báo người dùng trước khi sửa.
4. Chọn lát thay đổi nhỏ nhất, bao gồm trạng thái dữ liệu, quyền admin, validation, feedback và test. Không chỉ làm mockup tĩnh nếu yêu cầu là chức năng thật.
5. Với thay đổi giao diện, kiểm tra bằng browser thật ở desktop và mobile: hierarchy, mật độ bảng, focus keyboard, contrast, lỗi/đang tải/trống, responsive và `prefers-reduced-motion`.
6. Chạy kiểm tra phù hợp; trước commit luôn chạy `git diff --check` và GitNexus `detect_changes({scope: "staged"})`. Chỉ kết luận “xong” khi có kết quả kiểm chứng.

## Tiêu chí đánh giá admin

| Nhóm | Phải kiểm tra |
| --- | --- |
| Kiến trúc | Dùng admin Cloudflare-native hiện tại; không thêm Bagisto boundary hoặc stack admin thứ hai |
| Dữ liệu | D1 là nguồn chuẩn, R2 không bị orphan, server re-read/validate, có guard và post-condition |
| Quyền | Có auth boundary và kiểm tra role phù hợp; không expose mutation công khai |
| UX | Điều hướng rõ, breadcrumb, tìm/lọc/sắp xếp khi cần, edit flow hoàn chỉnh, trạng thái draft/publish và feedback dễ thấy |
| UI | Token thương hiệu nhất quán, không placeholder vô nghĩa, không emoji icon, không trang trí dashboard gây nhiễu |
| QA | Desktop/mobile, keyboard, contrast, reduced motion, loading/error/empty, screenshot và test hồi quy |

## Đầu ra mong đợi

AI phải tách rõ:

- **Đã xác minh:** file/route/test/lệnh cụ thể và kết quả;
- **Thiếu hoặc lỗi:** mức độ `Critical`, `Required`, `Optional` hoặc `Nit`, kèm bằng chứng;
- **Đề xuất:** thay đổi nhỏ nhất, ảnh hưởng dự kiến và bước kiểm thử;
- **Ngoài phạm vi:** việc không làm vì trái Lean V1 hoặc chưa có quyết định.

Không dùng nhận xét chung như “admin chưa chuyên nghiệp” mà không chỉ ra màn hình, trạng thái, hành vi hoặc tiêu chí bị vi phạm.
