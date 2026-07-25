# Kế hoạch nền tảng thương mại — Lean V1

**Trạng thái:** nguồn quyết định hiện hành, thay thế kế hoạch kiến trúc trước đây.
**Phạm vi phiên này:** chỉ Next.js worktree; không triển khai hay thay đổi hai checkout Bagisto.

## Mục tiêu Lean V1

Ra mắt storefront tiếng Việt/VND có một luồng mua hàng đại diện và một luồng liên hệ đáng tin cậy, trong khi Bagisto là back office duy nhất về lâu dài. Ưu tiên dữ liệu thật, vận hành đơn giản và khả năng mở rộng có kiểm soát; không xây một nền tảng vận hành thứ hai trong Next.js.

## Quyết định đã chốt

- Bagisto là back office dài hạn. Chỉ điều chỉnh nhẹ màn hình admin sẵn có của Bagisto khi cần.
- Chỉ có hai loại tài khoản cố định: **administrator** và **employee**. Không có role chi tiết, team, company hay luồng phê duyệt trong V1.
- Dashboard chỉ có hai số: yêu cầu mới và đơn hàng mới.
- Hoàn thành một nhóm dịch vụ gia công đại diện; khách hàng sẽ bổ sung các nhóm còn lại.
- Sản phẩm dùng giá theo số lượng của Bagisto. Từ ngưỡng cấu hình trở lên, storefront mở liên hệ với ngữ cảnh sản phẩm, biến thể và số lượng; không có quote engine hoặc vòng đời báo giá.
- Yêu cầu liên hệ đi vào Google Sheets để nhân viên xử lý, không vào inbox Bagisto.
- Giữ logging vận hành tối thiểu. Router chất lượng Terra → Luna → Gemini vẫn áp dụng cho mọi thay đổi đáng kể.
- Giữ nội dung storefront/contact hiện có, tiếng Việt và VND; thiết kế captured storefront được thay dần, không redesign đồng loạt.

## Đã có trong nền hiện tại

- Storefront Next.js và nội dung liên hệ hiện tại.
- Catalog có sản phẩm/biến thể, MOQ, bước số lượng, giá bậc và ngưỡng liên hệ trên contract Bagisto.
- Một bề mặt Next `/quan-tri` và BFF tương ứng. Đây là **bề mặt chuyển tiếp, đã đóng băng**: chỉ duy trì tương thích/bảo mật, không mở rộng tính năng mới.
- Cổng backend Bagisto nội bộ là `127.0.0.1:18001`. Cổng `3000`, `8000` và `8001` thuộc ứng dụng khác, tuyệt đối không điều khiển hoặc đổi cấu hình trong dự án này.
- `POST /api/contact` giữ contract trình duyệt cũ nhưng chuyển tiếp dữ liệu chuẩn hóa tới Google Apps Script/Google Sheets. Không fallback sang Bagisto.

## Phạm vi triển khai V1

1. Hoàn chỉnh một service family đại diện: nội dung, lựa chọn cần thiết và CTA liên hệ.
2. Hoàn chỉnh một luồng mua trực tiếp đại diện bằng Bagisto: sản phẩm, biến thể, quantity pricing và ngưỡng liên hệ server-enforced.
3. Dùng Bagisto admin cho quản trị sản phẩm, giá, tồn kho, đơn và hai loại tài khoản cố định.
4. Dashboard tối giản: đếm yêu cầu mới và đơn hàng mới.
5. Google Sheets là hàng đợi yêu cầu liên hệ; nhân viên xử lý trạng thái trong sheet.
6. Logging tối thiểu phục vụ vận hành và xử lý lỗi; kiểm tra TDD, lint, typecheck, build và review độc lập cho thay đổi quan trọng.

## Hoãn sau V1

- Quote engine, lifecycle báo giá, chuyển quote thành order và request inbox trong Bagisto.
- Company accounts, granular RBAC, team, approval workflow, audit subsystem đầy đủ.
- Nhiều service family, wizard gia công phức tạp, attachment, BOM/nguyên liệu/QC/tiến độ nhà máy.
- Multi-channel, multi-locale, multi-currency, payment gateway, carrier, promotion và redesign storefront toàn diện.
- Thay thế hoàn toàn captured markup trước khi luồng đại diện đạt ổn định.

## Ranh giới kỹ thuật

```text
Browser → Next.js storefront → same-origin BFF → Bagisto APIs → MySQL
                         └── POST /api/contact → Google Apps Script → Google Sheets
```

- Không ghi trực tiếp bảng core Bagisto từ code mới.
- Không mở rộng `/quan-tri` Next.js; Bagisto admin thay thế dần bề mặt này.
- Nhánh/worktree backend sạch giữ lại để tái sử dụng chọn lọc, nhưng **không merge** vào Bagisto main checkout đang dirty trong task này.
- Không triển khai, sửa hoặc chạm vào checkout Bagisto trong task này.

## Staging và triển khai

Staging dùng một host private, qua reverse proxy, chạy Next.js + Laravel + MySQL. MySQL chỉ ở private network và không public ra Internet. URL Google Apps Script/secret là biến môi trường server-only. Triển khai, DNS, TLS và cấu hình hạ tầng chi tiết nằm ngoài phạm vi task này.

## Lộ trình nhỏ, có thể nghiệm thu

1. **Containment:** giữ các cổng đã phân bổ, đóng băng `/quan-tri`, chuẩn hóa contact webhook và tài liệu vận hành.
2. **Representative catalog:** xác nhận một product family/variant chạy end-to-end qua Bagisto với quantity pricing và CTA liên hệ đúng ngưỡng.
3. **Representative service:** hoàn chỉnh một service family và thông tin liên hệ có ngữ cảnh.
4. **Operations:** dùng Bagisto admin cho admin/employee, dashboard hai số và quy trình xử lý Google Sheet.
5. **Mở rộng có chọn lọc:** chỉ thêm service family hoặc tích hợp mới sau khi các luồng đại diện ổn định trên staging.

## Cổng chất lượng và bàn giao

- Mọi thay đổi hành vi bắt đầu bằng test RED, rồi code GREEN tối thiểu.
- Thay đổi nhiều file đi theo lát cắt nhỏ; không sửa ngoài phạm vi.
- Trước bàn giao: focused tests, lint, typecheck và build; với thay đổi vật liệu thì Terra triển khai, Luna review, Gemini tổng hợp/routing.
- Không push hoặc thao tác destructive Git trong khi không có chỉ đạo rõ ràng.
