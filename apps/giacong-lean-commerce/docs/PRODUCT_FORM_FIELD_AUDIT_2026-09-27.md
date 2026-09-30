# Kiểm kê biểu mẫu sản phẩm

Cập nhật: 2026-09-27. Đây là đề xuất tinh gọn dựa trên biểu mẫu quản trị, validator và dữ liệu storefront hiện có. Chưa xóa dữ liệu, migration hay API.

## Đề xuất

| Trường / nhóm | Đề xuất | Căn cứ |
| --- | --- | --- |
| Tên sản phẩm | **Giữ, bắt buộc** | Là tên hiển thị và khóa nội dung công khai. |
| Danh mục | **Giữ** | Giúp điều hướng catalog và phân loại trang công khai. Có thể để trống cho bản nháp, nhưng cần phân loại trước khi đăng bán. |
| Ảnh chính | **Giữ, một ảnh là luồng cơ bản** | Được dùng ở trang sản phẩm và danh sách. Tải từ máy / thư viện vẫn cần; URL có thể là lựa chọn nâng cao. |
| Mô tả ngắn | **Giữ, khuyến nghị** | Nội dung tóm tắt cho khách và nguồn mô tả SEO mặc định. |
| Mô tả chi tiết / Markdown / nút chèn bảng | **Giữ nhưng không bắt buộc; thu gọn** | Có ích cho sản phẩm cần giải thích, nhưng không phải sản phẩm nào cũng cần bảng, tiêu chuẩn hay Markdown. |
| SKU sản phẩm | **Giữ trong dữ liệu; đề xuất tự sinh hoặc nhập trong “Nâng cao”** | Hệ thống hiện bắt buộc và đang hiển thị mã sản phẩm ở trang chi tiết. Cần chốt quy tắc sinh mã trước khi bỏ nhập tay; có thể bỏ hiển thị với khách nếu chủ dự án muốn. |
| Slug | **Giữ một chỗ, tự tạo theo tên** | Cần cho URL công khai. Hiện có trường ở thông tin chung và lặp lại trong SEO Preview. Giữ chỉnh tay trong mục nâng cao; không hiển thị hai nơi. |
| Trạng thái nháp / chờ duyệt / xuất bản / lưu trữ và công tắc hiển thị | **Giữ, gom thành trạng thái dễ hiểu** | Cần để tránh sản phẩm chưa hoàn thiện xuất hiện công khai. Cách tách hai điều khiển hiện tại dễ gây nhầm; không xóa kiểm soát xuất bản. |
| Thời gian làm hàng | **Ẩn khỏi luồng cơ bản, để tùy chọn** | Hiện có trong form/danh sách admin; tìm trong các thành phần storefront hiện tại chưa thấy nơi dùng trường này. Chỉ mở khi đội bán hàng xác nhận có công bố thời gian cho khách. |
| Biến thể / quy cách và đơn vị | **Giữ khi sản phẩm có lựa chọn; dùng một nhãn lựa chọn** | Storefront dùng nhãn lựa chọn để khách chọn quy cách. Hiện nhập cả “Tên biến thể” và “Nhãn lựa chọn”, có thể trùng ý; đề xuất một trường dễ hiểu, tên nội bộ được tạo theo lựa chọn. |
| SKU biến thể | **Giữ dữ liệu, tự sinh hoặc để nâng cao** | Dùng để phân biệt quy cách và xử lý yêu cầu; không cần bắt người nhập trong luồng nhanh nếu có thể tạo mã duy nhất an toàn. Validator hiện yêu cầu duy nhất. |
| Mã nhóm / mã lựa chọn số và chữ, tên nhóm, ID thuộc tính | **Bỏ khỏi biểu mẫu thường; tự quản lý nội bộ** | Đây là ID kỹ thuật để nối nhóm thuộc tính, không phải nội dung người bán nên phải tự nghĩ. Hiện nằm trong “Cấu hình nâng cao” nhưng vẫn bắt buộc khi lưu. Giữ tương thích dữ liệu/API cho tới khi có migration riêng. |
| Thứ tự biến thể | **Ẩn; tự dùng thứ tự tạo hoặc kéo-thả khi thật sự cần** | Không ảnh hưởng giá hay đặt yêu cầu; hiện bắt buộc nhập số. |
| MOQ / số lượng tối thiểu | **Giữ; mặc định 1 cho hàng bán lẻ** | Bán lẻ cần mua được từ 1 đơn vị; hàng chỉ bán theo bó/thùng hoặc sản xuất theo lô có thể đặt MOQ lớn hơn. Nhãn và đơn vị phải làm rõ khách đang đặt bao nhiêu. |
| Bước số lượng | **Mặc định 1, đưa vào nâng cao** | Hữu ích khi bán theo bó/thùng hoặc sản xuất theo lô; không cần phơi ra cho trường hợp phổ biến. |
| Giá lẻ và giá theo số lượng | **Giữ, cốt lõi cho bán lẻ + bán sỉ** | Một bảng đơn giản `số lượng từ → đơn giá`: hàng bán lẻ có bậc đầu từ 1 (hoặc MOQ), các bậc sau thể hiện đơn giá tốt hơn khi mua nhiều. Tính mức tiết kiệm tự động từ giá canonical; không nhập riêng cả giá và phần trăm giảm. Bậc cao nhất áp dụng cho mọi số lượng lớn hơn ngưỡng của bậc đó; giá công khai vẫn chỉ là tham khảo, nhân viên chốt qua Zalo. |
| Ngưỡng chuyển sang Zalo | **Bỏ khỏi form sản phẩm** | Chủ dự án chốt mọi đơn đều tư vấn/chốt qua Zalo nên không cần ngưỡng theo số lượng. Giá bán lẻ và các bậc theo lượng vẫn có thể hiển thị làm giá tham khảo; Zalo là CTA chung ở mọi mức. Không xóa cột/API trước khi kiểm tra các reader và dữ liệu hiện có. |
| Số lượng tồn / nhãn còn-hết | **Không thêm; bỏ quản lý tồn khỏi scope** | Chủ dự án chốt khách tự liên hệ để hỏi; khi hết hàng, nhân viên ẩn/ngừng đăng bán sản phẩm bằng trạng thái hiện có. Không cần bộ đếm tồn, chế độ đặt làm, tự trừ/giữ hàng hay nhãn còn/hết cho khách. Giữ lại trạng thái đăng bán hiện có vì nhân viên cần thao tác ẩn sản phẩm. |
| Cho phép chọn / ẩn biến thể | **Giữ tạm để ẩn quy cách không còn bán được; không coi là tồn kho** | Người dùng đã chốt bỏ tính năng tồn và yêu cầu nhân viên ẩn sản phẩm hết hàng bằng trạng thái đăng bán cấp sản phẩm. Không hiển thị `is_available` dưới dạng “Còn hàng/Tạm hết hàng”. Rà biến thể đang tắt và reader trước khi quyết định bỏ công tắc riêng; nếu cả sản phẩm ngừng bán, dùng trạng thái hiển thị cấp sản phẩm. |
| Ảnh riêng cho biến thể | **Để tùy chọn / nâng cao** | Hữu ích khi mỗi quy cách có ảnh riêng, không cần bắt buộc cho sản phẩm phổ thông. |
| Gallery nhiều ảnh | **Tùy chọn, thu gọn sau ảnh chính** | Trang hiện có thể hiển thị gallery; phần ảnh bổ sung không nên cản trở thao tác đăng sản phẩm cơ bản. |
| Thông số vật liệu, dung sai, quy trình, bề mặt, khối lượng, chứng nhận | **Ẩn khỏi luồng cơ bản; tạm giữ dữ liệu** | Đã là vùng tùy chọn riêng. Trong code storefront/catalog được rà, chưa thấy nơi đọc bảng thông số này; cần xác nhận có sản phẩm thật đang dùng trước khi bỏ UI hoặc schema. |
| SEO title / meta description xem trước | **Bỏ khỏi form chính; tự tạo từ tên và mô tả ngắn** | Hai ô hiện chỉ đọc, không có giá trị nhập riêng. Không cần trình bày như trường quản trị. Vẫn giữ metadata tự sinh cho trang công khai. |
| Mô phỏng Google/Social card hai tab | **Bỏ hoặc chỉ giữ xem trước gọn nếu có nhu cầu** | Không thay đổi dữ liệu; hiện chiếm chỗ trong form. URL slug không được lặp tại đây. |

## Form gọn đề xuất

1. **Thông tin bán hàng:** tên, danh mục, ảnh chính, mô tả ngắn; mô tả chi tiết là tùy chọn.
2. **Quy cách và giá:** một nhãn quy cách, đơn vị, MOQ mặc định 1 cho hàng bán lẻ, bảng `số lượng từ → đơn giá` với bậc lẻ và bậc sỉ, phần tiết kiệm tính tự động; bước số lượng mặc định 1 và nằm trong nâng cao. Không cấu hình ngưỡng chuyển Zalo theo sản phẩm.
3. **Đăng bán:** nháp / đang hiển thị / ẩn; slug tự tạo, SKU tự sinh nếu quy tắc mã được duyệt.
4. **Nâng cao (đóng mặc định):** gallery, ảnh riêng biến thể, lead time nếu đội bán hàng thực sự công bố, slug chỉnh tay, kỹ thuật đặc thù. Không thêm trường số lượng tồn hoặc nhãn còn/hết hàng; nhân viên dùng trạng thái đăng bán hiện có để ẩn sản phẩm hết hàng.

## Cần giữ an toàn khi tinh gọn

- Không xóa cột hay migration chỉ vì trường bị ẩn khỏi form; trước đó cần kiểm tra dữ liệu hiện dùng, import/export, API, storefront, báo cáo và redirect slug.
- Bậc bán lẻ và bán sỉ phải tăng theo số lượng, khớp MOQ và bước số lượng; mức tiết kiệm suy ra từ đơn giá canonical. Mọi yêu cầu cần đăng nhập, được lưu trước khi mở Zalo; không tạo nhánh checkout web hay điều kiện số lượng cho CTA.
- Không chuyển yêu cầu đã gửi thành lịch sử mua cho tới khi nhân viên xác nhận giao dịch đã chốt. Khách chỉ được xem bản ghi thuộc tài khoản đã xác minh.
- Kiểm kê này là đề xuất UX/kỹ thuật, chưa được khách duyệt trường nào sẽ xóa vĩnh viễn.

## Nguồn đã đối chiếu

- `src/app/admin/san-pham/page.tsx` — form sản phẩm, trạng thái, danh mục, SKU, lead time, ảnh, slug và SEO Preview.
- `src/components/admin/AdminVariantPanel.tsx` — các trường variant, giá bậc và mã phân loại nội bộ.
- `src/components/admin/AdminProductTechSpecs.tsx` và migration `0030_product_tech_specs_and_media.sql` — thông số kỹ thuật và gallery.
- `src/lib/admin-product-input.ts`, `src/lib/admin-variant-input.ts` — trường bắt buộc/ràng buộc hiện tại.
- `src/lib/product-detail-view.ts`, `src/components/catalog/ProductPurchasePanel.tsx` — nhãn quy cách, MOQ, bước, giá bậc, ngưỡng liên hệ và ảnh phía khách.
