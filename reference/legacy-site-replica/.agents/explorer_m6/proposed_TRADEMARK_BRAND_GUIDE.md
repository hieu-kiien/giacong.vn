# Trademark & Brand Usage Guide / Hướng dẫn Sử dụng Thương hiệu & Nhãn hiệu
**giacong.vn Replica Environments**

---

## 1. Overview & Purpose / Tổng quan & Mục đích

This document outlines the rules and restrictions governing the use of the official trademark **"giacong.vn"**, as well as associated logos, brand assets, and designs, in replica, development, staging, or testing environments. 

Tài liệu này quy định các nguyên tắc và hạn chế đối với việc sử dụng nhãn hiệu chính thức **"giacong.vn"**, cũng như các logo, tài sản thương hiệu và thiết kế đi kèm trong môi trường mô phỏng (replica), phát triển, thử nghiệm hoặc staging.

The primary objective is to prevent public confusion, protect intellectual property, and ensure that replica implementations (such as Next.js/Laravel development environments) do not infringe upon the official brand or impact search engine rankings.

Mục tiêu chính là ngăn ngừa sự nhầm lẫn trong công chúng, bảo vệ quyền sở hữu trí tuệ, và đảm bảo các phiên bản mô phỏng (như môi trường phát triển Next.js/Laravel) không vi phạm thương hiệu chính thức hoặc ảnh hưởng đến thứ hạng trên các công cụ tìm kiếm.

---

## 2. Rules for Replica/Development Environments / Quy định cho Môi trường Mô phỏng & Phát triển

To use the "giacong.vn" brand assets and layout in a replica or development project, you must strictly adhere to the following conditions:

Để sử dụng các tài sản thương hiệu và bố cục của "giacong.vn" trong một dự án mô phỏng hoặc phát triển, bạn phải tuân thủ nghiêm ngặt các điều kiện sau:

### 2.1. Visual Disclaimers / Cảnh báo Hiển thị Trực quan
* **Staging/Demo Banner**: Every page of the replica environment must display a highly visible banner at the top or bottom of the viewport stating:
  > *"This is a development/replica environment of giacong.vn. This site is for testing/demonstration purposes only. For official services, please visit [https://giacong.vn](https://giacong.vn)."*
* **Banner cảnh báo**: Tất cả các trang trong môi trường mô phỏng phải hiển thị một biểu ngữ nổi bật ở đầu hoặc cuối màn hình với nội dung:
  > *"Đây là môi trường thử nghiệm/mô phỏng của giacong.vn. Trang web này chỉ phục vụ mục đích kiểm thử/minh họa. Để sử dụng dịch vụ chính thức, vui lòng truy cập [https://giacong.vn](https://giacong.vn)."*
* **No Impersonation**: The title tag of the site should indicate it is a replica (e.g., `[REPLICA] Giacong.vn - Đối Tác Gia Công OEM/ODM`).

### 2.2. Search Engine Indexing (SEO) / Lập chỉ mục trên Công cụ Tìm kiếm
To prevent search engines from indexing the replica site and creating duplicate content issues for the official site:
* **Robots.txt**: The staging/replica site's `robots.txt` must explicitly block all crawlers:
  ```txt
  User-agent: *
  Disallow: /
  ```
  *(Note: Do not include or submit `sitemap.xml` pointing to the replica domain to public search engine consoles).*
* **Meta Tags**: All pages in the replica environment should include a robot exclusion header:
  ```html
  <meta name="robots" content="noindex, nofollow" />
  ```
* **Ngăn chặn Lập chỉ mục**: Để tránh các công cụ tìm kiếm lập chỉ mục trang web mô phỏng gây trùng lặp nội dung với trang chính thức, file `robots.txt` của trang mô phỏng phải chặn hoàn toàn robot thu thập thông tin và các trang cần có thẻ meta `noindex, nofollow`.

### 2.3. Domain and Hosting Restrictions / Hạn chế Tên miền & Lưu trữ
* **No Cybersquatting**: Replicas must not be hosted on public domains containing the word "giacong" in a confusing manner (e.g., `giacongvn.com`, `giacong-replica.vn`).
* **Approved Environments**: Hosting should be limited to local environments (`localhost`, `127.0.0.1`) or secure staging subdomains with basic authentication or IP restrictions.
* **Hạn chế Tên miền**: Không được lưu trữ bản mô phỏng trên các tên miền công cộng dễ gây nhầm lẫn. Khuyến khích chạy trên môi trường cục bộ hoặc phân miền phụ có yêu cầu mật khẩu truy cập.

---

## 3. Strict Prohibitions / Các Hành vi Bị cấm Nghiêm ngặt

The following actions are strictly prohibited and constitute a violation of intellectual property:

Các hành vi sau đây bị cấm nghiêm ngặt và bị coi là vi phạm quyền sở hữu trí tuệ:

1. **Commercial Use / Sử dụng Thương mại**: Using the replica or brand assets to sell products, solicit business, or generate commercial leads. (Sử dụng bản mô phỏng để bán hàng, chào hàng hoặc thu thập thông tin thương mại).
2. **Data Harvesting / Thu thập Dữ liệu Người dùng**: Routing contact forms, inquiry forms, or registration forms to collect real user data. All forms in replica environments must route to local test databases or test email addresses. (Sử dụng các biểu mẫu để thu thập dữ liệu thật của người dùng. Mọi biểu mẫu phải được hướng về cơ sở dữ liệu kiểm thử cục bộ hoặc email thử nghiệm).
3. **Modified Logos / Chỉnh sửa Logo trái phép**: Altering the proportions, color scheme, typography, or elements of the official logo. (Tự ý thay đổi tỷ lệ, màu sắc, phông chữ hoặc các yếu tố trong logo chính thức).

---

## 4. Visual Identity Guidelines / Hướng dẫn Nhận diện Thương hiệu

If authorized to display the brand assets for testing, they must match these specifications:

Nếu được phép hiển thị tài sản thương hiệu cho mục đích kiểm thử, chúng phải khớp với các đặc tả sau:

### 4.1. Official Palette / Bảng màu Chính thức
The brand identity uses the following Primary and Secondary colors:
* **Primary Green (Màu Xanh lá chính thức)**: `#5aa400` (used for headers, primary badges, and brand highlights).
* **Secondary Orange (Màu Cam phụ)**: `#eb892d` (used for call-to-actions, buttons, and accents).

### 4.2. Typography / Phông chữ
* **Font Family**: The layout should prioritize system-native sans-serif fonts mimicking clean Vietnamese typography (e.g., Arial, Helvetica, system-ui) or Flatsome standard layouts.

---

## 5. Contact & Support / Liên hệ & Hỗ trợ

If you suspect misuse of the giacong.vn brand, or if you require authorization to host a training or development replica, please contact:

Nếu bạn nghi ngờ có sự lạm dụng thương hiệu giacong.vn, hoặc cần được cấp phép vận hành bản mô phỏng để đào tạo/phát triển, vui lòng liên hệ:
* **Email**: contact@giacong.vn
* **Website**: [https://giacong.vn](https://giacong.vn)
