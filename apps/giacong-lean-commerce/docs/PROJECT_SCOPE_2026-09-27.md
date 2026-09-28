# Phạm vi dự án theo trao đổi với khách

Cập nhật: 2026-09-27. Tài liệu này tách yêu cầu khách đã xác nhận, quyết định của chủ dự án và các chi tiết còn mở; không tự bổ sung hành vi thương mại chưa được chốt.

## Vai trò trong đoạn chat

- Tin nhắn bên trái, xưng “anh”: khách hàng / chủ dự án.
- Tin nhắn bên phải, xưng “em”: người thực hiện dự án.

## Yêu cầu khách đã xác nhận

- Trang chủ/storefront cần có mục tài khoản dễ thấy ở góc trang, có đăng ký và đăng nhập. Giai đoạn đầu dùng Google và chỉ cấp lịch sử cho tài khoản Google có email đã xác minh. Email/mật khẩu chỉ mở sau khi cấu hình dịch vụ gửi email xác minh; đăng nhập bằng số điện thoại chờ đến khi có phương thức xác minh phù hợp.
- Trải nghiệm nên giống một website thương mại điện tử quen thuộc, rõ ràng và đơn giản; không làm phức tạp nếu không phục vụ nhu cầu thật.
- Khu vực quản lý sản phẩm đang có nhiều trường bị khách xem là thừa; cần rà lại và tinh gọn.
- Có giá/giảm giá theo số lượng.
- Mọi yêu cầu mua hàng, cả lẻ và sỉ, đều kết thúc ở Zalo để nhân viên tư vấn/chốt; không phân ngưỡng “số lượng lớn mới qua Zalo”. Website không tạo đơn đã xác nhận.

## Chủ dự án đã xác nhận / định hướng

- Không có thanh toán online.
- Đăng nhập phục vụ nhận diện, chăm sóc khách và xem lịch sử mua hàng; mục đăng nhập phải hiện ở góc trang.
- Khách phải đăng nhập bằng Google đã xác minh trước khi gửi yêu cầu mua hàng trên website. Website lưu hồ sơ khách và nội dung yêu cầu vào D1, gắn với ID từ session phía máy chủ; chỉ sau khi lưu thành công mới mở bước tiếp theo để trao đổi trên Zalo. Không mở Zalo trực tiếp trước khi ghi nhận yêu cầu. Không ghép tài khoản theo tên hoặc dữ liệu do browser gửi.
- Nhân viên chốt đơn qua Zalo rồi cập nhật giao dịch trong Admin. Website không xác nhận đơn hay thanh toán online.
- Khách đã đăng nhập xem lịch sử yêu cầu và giao dịch đã chốt trong tài khoản; hai loại bản ghi phải có trạng thái/nhãn phân biệt rõ. Không coi yêu cầu đang tư vấn là giao dịch mua.
- Admin là nguồn dữ liệu gốc cho hồ sơ khách, yêu cầu và giao dịch đã chốt; Google Sheet nhận bản đồng bộ để tra cứu/vận hành, không phải nơi nhập lại hay nguồn lịch sử mua độc lập. Nhân viên không phải nhập tay hai nơi.
- Website phục vụ cả khách mua lẻ và mua sỉ: cần giá bán lẻ và các bậc giá/giảm giá theo số lượng, quy cách/đơn vị và số lượng tối thiểu khi có. Mọi khách chuyển sang Zalo để tư vấn/chốt; không dựng thêm quy trình đặt hàng phức tạp trên web.

SEO cần tập trung vào trang sản phẩm, danh mục và nội dung công khai có thể được lập chỉ mục. Tài khoản đăng nhập tự nó không cải thiện thứ hạng tìm kiếm; dữ liệu tài khoản hữu ích hơn cho chăm sóc và giữ chân khách.

## Thứ tự làm tiếp

1. Đã chốt giai đoạn đầu: đăng ký/đăng nhập Google; yêu cầu email Google đã xác minh trước khi xem lịch sử. Email/mật khẩu chờ cấu hình dịch vụ gửi thư; đăng nhập chỉ bằng số điện thoại chưa được bật.
2. Làm một luồng khách hàng thống nhất: đăng ký/đăng nhập ở storefront, gắn lịch sử giao dịch với đúng khách; tách hoàn toàn khỏi đăng nhập Admin.
3. Làm luồng yêu cầu đăng nhập → lưu yêu cầu vào D1 → mở Zalo sau khi lưu thành công; nhân viên ghi giao dịch đã chốt trong Admin/D1 và đồng bộ một chiều sang Google Sheet theo mã giao dịch để retry không nhân đôi.
4. Tinh gọn form sản phẩm theo bán lẻ + sỉ: giá lẻ, giá theo bậc số lượng, quy cách/đơn vị và MOQ khi cần. Bỏ ngưỡng chuyển Zalo và không thêm tồn kho; nhân viên tự ẩn sản phẩm hết hàng.
5. Kiểm tra trọn hành trình trên điện thoại và desktop: đăng ký/đăng nhập, yêu cầu được lưu trước khi mở Zalo, lịch sử yêu cầu và giao dịch phân biệt trong tài khoản, nhân viên cập nhật giao dịch và Sheet nhận đồng bộ; không có checkout/thanh toán online.

## Chưa được chốt

- Khôi phục tài khoản/email-mật khẩu và liên kết Google với mật khẩu cần quyết định khi bật email login; hiện chưa triển khai email/password hay số điện thoại. Cần hoàn thiện cách thông báo/đồng ý lưu thông tin theo chính sách riêng tư hiện có.
- Code hiện có màn hình Customer 360/CRM với phân hạng, công nợ và hồ sơ doanh nghiệp B2B. Các trường mở rộng này chưa được khách xác nhận; cần rà mức sử dụng và tinh gọn theo nhu cầu trước khi coi là scope bắt buộc. Không xóa dữ liệu/schema chỉ từ quyết định đơn giản hóa giao diện.
- Kênh xác minh email/số điện thoại, khôi phục mật khẩu, xử lý trùng/liên kết Google với mật khẩu và nội dung đồng ý khi lưu thông tin khách. Không gắn yêu cầu vào tài khoản chỉ dựa trên tên do khách tự nhập.
- URL/tài khoản Zalo chính thức cần được xác nhận cho trang sản phẩm và trang tiếp nhận dùng chung. Runtime storefront phải đọc `contact_zalo_url`; không hardcode số demo hoặc fallback khác nhau.
- Bộ trạng thái yêu cầu và cách nhân viên cập nhật; lịch sử tài khoản phải phân biệt yêu cầu đang xử lý với giao dịch đã chốt.
- Yêu cầu báo giá dịch vụ gia công có dùng chung luồng đăng nhập → lưu D1 → Zalo này hay không.
- Hợp đồng đồng bộ Admin → Google Sheet cho giao dịch đã chốt: mã `sale_id`, upsert bền vững, xử lý lỗi/thử lại và đối soát. Mã Apps Script hiện nằm ở `docs/google-apps-script-contact-webhook.gs`; cần nâng cấp chung với Worker để Sheet là bản sao vận hành, Admin/D1 vẫn là nguồn gốc.
- Quy tắc ghép yêu cầu chốt qua Zalo/offline với đúng tài khoản khách để lịch sử không lộ nhầm cho người khác.
- Không có checkout hoặc thanh toán online. Thông tin vận chuyển chỉ được hỏi/thống nhất trong trao đổi với nhân viên; chưa xây luồng shipping trên web.
- Không làm tính năng quản lý tồn kho hoặc trạng thái còn/hết hàng cho khách. Khi sản phẩm hết hàng, nhân viên tự ẩn/ngừng đăng bán bằng trạng thái sản phẩm hiện có; khách cần liên hệ để hỏi.
- Danh sách chính xác các trường sản phẩm phải giữ, ẩn hoặc bỏ. Cần đối chiếu trường với dữ liệu đang dùng và hành vi storefront trước khi xóa dữ liệu hoặc schema.

## Ghi chú kỹ thuật từ task hiện tại

Khách đã trực tiếp yêu cầu ảnh sản phẩm hiển thị theo ảnh tải lên, không bị cắt, và slug tự cập nhật khi đổi tên sản phẩm. Cũng cần sửa các lỗi quản trị và thông báo phát hiện trong quá trình rà soát.

## Tình trạng tài liệu cũ

Kế hoạch cũ từng ghi không có tài khoản khách hàng và phạm vi thanh toán còn mở. Brief này thay baseline sản phẩm: đăng ký/đăng nhập đã được khách yêu cầu, thanh toán online bị loại khỏi phạm vi. Không dùng tài liệu archive để bác bỏ các quyết định mới.

Các tài liệu về triển khai, bảo mật, D1/R2 và hợp đồng API là tài liệu kỹ thuật/vận hành, không phải quyết định về trải nghiệm khách hàng. Giữ chúng tách khỏi brief sản phẩm trong lúc rà soát lại.
