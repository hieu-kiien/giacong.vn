# Đơn giản hóa admin & trải nghiệm khách hàng (2026-10-04)

Tài liệu ghi lại các quyết định và thay đổi theo yêu cầu của khách: giao diện dễ nhìn,
admin đơn giản nhưng đủ tính năng, đăng nhập hợp lý, mọi giao diện đồng nhất.

Nhánh làm việc: `codex/customer-ux-simplification`.

## Luồng bán hàng (không đổi)

Khách đăng nhập → gửi yêu cầu mua hàng (lưu vào D1) → mở Zalo → nhân viên chốt đơn qua Zalo →
nhân viên ghi nhận giao dịch đã chốt trong admin (`zalo_sales`, đồng bộ Google Sheets).

Không có giỏ hàng, không thanh toán online, không hiển thị tồn kho.

## Admin sau khi đơn giản hóa

| Nhóm menu | Trang |
| --- | --- |
| Bán hàng | Tổng quan · Yêu cầu mua hàng · Khách hàng |
| Nội dung | Sản phẩm (kèm danh mục) · Dịch vụ gia công · Tin tức · Thư viện ảnh |
| Website | Nội dung & thương hiệu (kèm banner; Thiết kế trang mở từ đây) · Menu |
| Hệ thống | Tài khoản quản trị & quyền · Lịch sử thay đổi (chỉ chủ) |

- **Sản phẩm**: tìm kiếm, lọc theo danh mục/trạng thái, sắp xếp (mới nhất, cập nhật, tên, giá), thao tác hàng loạt,
  xuất CSV theo bộ lọc, nhập CSV. Trạng thái gộp thành một lựa chọn: *Bản nháp / Đang hiển thị / Tạm ẩn*.
  Quy cách & bảng giá viết lại bằng ngôn ngữ thường (SKU tự sinh, hiển thị mức tiết kiệm theo bậc giá).
- **Yêu cầu mua hàng**: rút gọn trạng thái còn *Mới / Đã liên hệ / Đã chốt / Không mua / Rác*.
  Các trạng thái cũ (đã xác thực, báo giá, làm mẫu, đàm phán) vẫn nằm trong D1, hiển thị và lọc gộp vào "Đã liên hệ".
- **Khách hàng**: xây lại trên tài khoản khách của website (yêu cầu + giao dịch đã chốt trên Zalo, tìm kiếm, xuất CSV).
  Ngôn ngữ B2B/CRM (MST, công nợ, phân hạng, RFQ) đã bỏ khỏi giao diện.
- **Ẩn khỏi giao diện (không xóa dữ liệu/schema)**: thông số kỹ thuật cơ khí (vật liệu, dung sai, quy trình chế tạo),
  hồ sơ doanh nghiệp CRM trong trang Yêu cầu, "Thiết kế trang" khỏi menu.
- Nút "Xem trang web" trỏ đúng tên miền công khai (`admin.` → bỏ tiền tố, `admin-staging.` → `staging.`).

## Đăng nhập khách

Một màn hình đăng nhập dùng chung (`/tai-khoan/dang-nhap/`):

- Đăng nhập bằng email hoặc tên đăng nhập + mật khẩu.
- Tạo tài khoản (họ tên, email, mật khẩu; tên đăng nhập không bắt buộc) → email xác nhận.
- Quên mật khẩu → email đặt lại (`/tai-khoan/dat-lai-mat-khau/?token=…`, hiệu lực 1 giờ).
- Đăng nhập Google vẫn giữ nguyên.

### Cấu hình Resend (bắt buộc để bật đăng ký bằng email)

Khi chưa cấu hình, đăng ký bằng email **tự khóa** (chỉ còn Google) để không phát sinh tài khoản chưa xác thực.

1. Tạo tài khoản tại resend.com, xác minh tên miền gửi mail (thêm bản ghi SPF/DKIM do Resend cung cấp).
2. Đặt secret cho từng môi trường:

```powershell
cd apps/giacong-lean-commerce
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put CUSTOMER_EMAIL_FROM        # ví dụ: Kien Hieu <no-reply@kienhieu.id.vn>
# staging: thêm --env staging
```

3. Thử đăng ký bằng một email thật, kiểm tra thư xác nhận và thư đặt lại mật khẩu.

## Hạn chế đã biết

- Nhập CSV chưa có cột giá/quy cách: sau khi nhập, đặt giá trong từng sản phẩm.
- Các trang chính sách (`/chinh-sach-*`, `/dieu-khoan-su-dung`, `/quy-trinh-mua-hang`) vẫn là khung nháp
  (noindex) — cần nội dung pháp lý thật từ chủ website trước khi công bố.
- Link Zalo lấy từ cài đặt `contact_zalo_url`; cần điền số/link thật.
- Chưa kiểm thử được gửi email thật và Google OAuth trong môi trường local.
