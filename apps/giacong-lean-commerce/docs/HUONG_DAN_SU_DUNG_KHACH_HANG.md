# TÀI LIỆU HƯỚNG DẪN QUẢN TRỊ & VẬN HÀNH WEBSITE
**Hệ thống:** Website Doanh nghiệp & Thương mại B2B — [kienhieu.id.vn](https://kienhieu.id.vn)  
**Ngày cập nhật:** 2026-09-20  
**Đối tượng sử dụng:** Khách hàng, Chủ doanh nghiệp, Nhân sự vận hành (Admin/Sales)

---

## I. THÔNG TIN TRUY CẬP HỆ THỐNG

| Thành phần | Địa chỉ truy cập | Ghi chú |
| :--- | :--- | :--- |
| **Website chính (Storefront)** | [https://kienhieu.id.vn](https://kienhieu.id.vn) | Giao diện công khai dành cho khách hàng |
| **Trang quản trị (Admin Portal)** | [https://admin.kienhieu.id.vn/admin](https://admin.kienhieu.id.vn/admin) | Bảo mật qua Cloudflare Access bằng Email Google được cấp quyền |
| **Google Sheet nhận Lead / Báo giá** | File: *“Yêu cầu báo giá Giacong”* | Tự động cập nhật thời gian thực khi khách gửi form hoặc giỏ hàng |

---

## II. HƯỚNG DẪN ĐĂNG NHẬP TRANG QUẢN TRỊ

Hệ thống được bảo vệ bởi lớp bảo mật **Cloudflare Access (Zero-Trust)**:
1. Truy cập đường dẫn: **`https://admin.kienhieu.id.vn/admin`**.
2. Màn hình xuất hiện bảng yêu cầu xác thực bảo mật tài khoản Google.
3. Nhấp chọn **Đăng nhập bằng Google** và chọn đúng Email đã được chủ hệ thống cấp quyền quản trị (Admin/Owner).
4. Sau khi đăng nhập thành công, hệ thống sẽ tự động chuyển hướng vào bảng điều khiển quản trị.

> ⚠️ **Lưu ý:** Chỉ những email đã được thêm vào danh sách quản trị viên mới có thể truy cập được. Những tài khoản ngoài danh sách sẽ tự động bị từ chối truy cập.

---

## III. HƯỚNG DẪN QUẢN LÝ SẢN PHẨM & BÁO GIÁ B2B

Truy cập: **Menu Quản trị → Sản phẩm**

### 1. Thêm mới hoặc cập nhật sản phẩm
- Nhập **Tên sản phẩm**, **Mô tả ngắn**, **Nội dung chi tiết**.
- **Quy cách & Đơn vị tính:** ví dụ `Kg`, `Gói`, `Thùng`, `Chai`...
- **Thiết lập cơ chế B2B:**
  - **Số lượng đặt tối thiểu (MOQ):** Ví dụ tối thiểu phải đặt `25` hoặc `50`.
  - **Bước nhảy số lượng:** Ví dụ bước nhảy là `5` thì khách chỉ có thể chọn 25, 30, 35...
  - **Thang giá theo bậc số lượng (Tier Pricing):**
    - *Bậc 1:* Từ 25 - 49 đơn vị: giá `85.000 đ/đơn vị`
    - *Bậc 2:* Từ 50 - 99 đơn vị: giá `78.000 đ/đơn vị`
    - *Bậc 3:* Từ 100 trở lên: giá `72.000 đ/đơn vị`
  - Hệ thống tự động tính toán tổng tiền và chiết khấu khi khách tăng/giảm số lượng trực tiếp trên website.

### 2. Quản lý hình ảnh sản phẩm
- Tải ảnh lên từ máy tính (định dạng JPG, PNG hoặc WebP, dung lượng khuyến nghị ≤ 8MB).
- Bấm **"Dùng làm ảnh chính"** để ảnh này hiển thị đại diện trên trang chủ và danh mục sản phẩm.
- Nếu muốn xóa ảnh đại diện cũ, hãy chọn một ảnh khác làm ảnh chính trước khi thực hiện xóa.

### 3. Xuất bản / Tạm ẩn sản phẩm
- **Lưu nháp (Draft):** Sản phẩm chưa xuất hiện ngoài website để bạn hoàn thiện thông tin.
- **Xuất bản (Publish):** Đưa sản phẩm hiển thị công khai ngay lập tức.
- **Tạm ẩn (Archived):** Ẩn sản phẩm khi hết hàng hoặc ngừng kinh doanh mà không làm hỏng cấu trúc link cũ.

---

## IV. HƯỚNG DẪN QUẢN LÝ NỘI DUNG WEBSITE (CMS)

### 1. Chỉnh sửa thông tin chung (Hotline, Logo, Email, Địa chỉ)
- Truy cập: **Menu Quản trị → Nội dung (CMS)**.
- Thay đổi số điện thoại hotline, email liên hệ, địa chỉ xưởng/văn phòng.
- Sau khi chỉnh sửa, bấm **Lưu nháp** → Bấm **Xuất bản (Publish)** để nội dung mới cập nhật ra website.

### 2. Quản lý Menu & Điều hướng
- Truy cập: **Menu Quản trị → Điều hướng (`/admin/dieu-huong`)**.
- Cho phép kéo thả, sắp xếp vị trí các mục trên menu chính (Header) và liên kết chân trang (Footer).
- Bấm **Xuất bản** để menu mới áp dụng trực tiếp.

### 3. Quản lý Tin tức & Dịch vụ gia công
- Truy cập: **Menu Quản trị → Tin tức** hoặc **Dịch vụ**.
- Viết bài mới với giao diện soạn thảo trực quan, chèn hình ảnh, định dạng tiêu đề, danh sách.
- Hỗ trợ cơ chế chống ghi đè: nếu hai người cùng mở chỉnh sửa một bài, hệ thống sẽ cảnh báo để tránh ghi đè dữ liệu của nhau.

---

## V. HƯỚNG DẪN XỬ LÝ ĐƠN HÀNG & YÊU CẦU BÁO GIÁ (LEAD INTAKE)

Toàn bộ yêu cầu khách hàng gửi từ website (form liên hệ hoặc giỏ hàng báo giá) sẽ đổ trực tiếp về file **Google Sheets "Yêu cầu báo giá Giacong"**.

### 1. Tab `Yêu cầu` (Quản lý thông tin khách)
Mỗi khách gửi yêu cầu sẽ tạo thành 1 dòng dữ liệu:
- **Mã yêu cầu:** Ví dụ `YCBG-202609-001`.
- **Thời gian gửi:** Ngày giờ khách gửi yêu cầu.
- **Họ tên, Số điện thoại, Email, Nội dung ghi chú của khách.**
- **Cột L - Trạng thái:** Nhấp chọn tiến độ xử lý:
  - `Mới` → Đang chờ xử lý.
  - `Đang tư vấn` → Nhân sự đang liên hệ trao đổi với khách.
  - `Chờ khách phản hồi` → Đã gửi báo giá, đang chờ duyệt.
  - `Thành công` → Đã chốt đơn hàng / hợp đồng.
  - `Không tiếp tục` → Khách hủy hoặc thông tin không hợp lệ.
- **Cột M - Người phụ trách:** Điền tên nhân viên sales phụ trách khách hàng này.

### 2. Tab `Chi tiết giỏ hàng`
Nếu khách gửi yêu cầu báo giá từ giỏ hàng gồm nhiều sản phẩm:
- Tab này tự động liệt kê chi tiết từng sản phẩm khách chọn theo đúng `Mã yêu cầu`.
- Hiển thị rõ: Tên sản phẩm, Biến thể, Số lượng, Đơn giá theo bậc, và Thành tiền tạm tính.

---

## VI. QUẢN LÝ THÀNH VIÊN & PHÂN QUYỀN

Truy cập: **Menu Quản trị → Thành viên (`/admin/thanh-vien`)**
- Chỉ tài khoản có quyền **Owner** mới được cấp thêm thành viên mới.
- Các bước thêm nhân sự vào quản trị:
  1. Thêm email Google của nhân sự vào hệ thống.
  2. Cấp quyền tương ứng (toàn quyền quản trị hoặc nhân viên nội dung/bán hàng).
  3. Nhân sự sử dụng đúng email đó để đăng nhập vào trang admin.

---

## VII. QUY ĐỊNH VẬN HÀNH & BẢO MẬT

1. **Bảo mật:**
   - Không chia sẻ tài khoản email quản trị cho bên thứ ba không có thẩm quyền.
   - Không tự ý sửa đổi code Apps Script hoặc cấu trúc các cột trong Google Sheet.
2. **Sao lưu dữ liệu:**
   - Cơ sở dữ liệu và hình ảnh được lưu trữ an toàn trên hạ tầng đám mây Cloudflare D1 & R2.
3. **Hỗ trợ kỹ thuật:**
   - Khi cần nâng cấp tính năng mới, chỉnh sửa trường dữ liệu hoặc cần hỗ trợ kỹ thuật chuyên sâu, vui lòng liên hệ đội ngũ kỹ thuật phát triển.
