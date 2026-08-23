# Bản đồ giao diện hiện trạng

Tài liệu này mô tả giao diện của bản gốc tại thời điểm rà soát; không phải đề xuất thay đổi.

```mermaid
flowchart TB
  Visitor["Khách truy cập"] --> Header["Header + menu desktop/mobile"]
  Header --> Home["/ — Trang chủ clone"]
  Header --> Catalog["/san-pham — Danh mục sản phẩm"]
  Header --> Services["/thue-gia-cong — Danh mục dịch vụ"]
  Header --> Contact["/lien-he — Form liên hệ"]

  Home --> CapturedHome["HTML capture: hero, giới thiệu, dịch vụ, tin tức, logo/đối tác"]
  Catalog --> ProductList["Tìm kiếm · lọc · lưới · phân trang"]
  ProductList --> ProductDetail["/san-pham/[slug] — biến thể, MOQ, giá bậc, CTA"]
  Services --> ServiceSearch["Tìm kiếm + lọc theo 13 nhóm"]
  ServiceSearch --> Families["/thue-gia-cong/[family]"]
  Families --> Offerings["69 dịch vụ/link chuyên biệt"]
  Contact --> ContactForm["Form capture → /api/contact"]

  CapturedRoutes["237 trang HTML capture"] --> CatchAll["/[...slug]"]
  CatchAll --> LegacyPages["Trang dịch vụ/sản phẩm/tin tức cũ"]

  Header --> Footer["Footer clone + nút liên hệ nổi"]
```

| Khu vực | Số lượng / phạm vi | Thành phần chính |
|---|---:|---|
| Trang clone tĩnh | 237 URL | `src/data/pages/*.json` và route `/(storefront)/[...slug]` |
| Danh mục sản phẩm | `/san-pham` và trang chi tiết | Tìm kiếm, lọc, lưới, phân trang, biến thể, MOQ, giá bậc |
| Nhóm dịch vụ | 13 nhóm | Đọc từ `service-families.ts`; có một nhóm trống đúng theo website gốc |
| Link dịch vụ | 69 link | Danh sách/lọc ở `/thue-gia-cong` và trang nhóm |
| Trang liên hệ | `/lien-he` | Form capture; JavaScript gửi tới `/api/contact` |
| Khung dùng chung | Toàn storefront | Header, mobile menu, sticky header, footer, nút liên hệ nổi |

## Cấu trúc thư mục giao diện

```text
src/app/(storefront)/
├── page.tsx                       Trang chủ
├── [...slug]/page.tsx             237 trang clone cũ
├── san-pham/
│   ├── page.tsx                   Danh mục sản phẩm
│   ├── loading.tsx                Skeleton danh mục khi tải
│   └── [slug]/
│       ├── page.tsx               Chi tiết sản phẩm
│       └── loading.tsx            Skeleton chi tiết khi tải
├── gui-yeu-cau/
│   └── loading.tsx                Skeleton giỏ yêu cầu khi tải
└── thue-gia-cong/
    ├── page.tsx                   Danh mục dịch vụ
    └── [family]/page.tsx          Trang theo nhóm dịch vụ

src/components/
├── CapturedPage.tsx               Render HTML clone
├── GiacongInteractions.tsx        Menu, slider, sticky header, form
├── catalog/                       UI danh mục/sản phẩm
└── services/                      UI danh mục/nhóm dịch vụ
```

## Bản đồ route theo mã gốc

Đây là thứ tự logic của App Router trong mã gốc. Các route cụ thể được ưu tiên trước; route `/(storefront)/[...slug]` chỉ nhận những URL công khai còn lại.

```mermaid
flowchart TD
  Request["Khách mở URL"] --> Storefront["(storefront) layout: CSS clone chung"]
  Storefront --> Exact{"URL có route cụ thể?"}
  Exact -->|/| Home["page.tsx → home.json → CapturedPage"]
  Exact -->|/san-pham| ProductList["CatalogList → Cloudflare D1"]
  Exact -->|/san-pham/[slug]| ProductDetail["CatalogDetail → Cloudflare D1"]
  Exact -->|/san-pham/a/b| Product404["[...path] → 404"]
  Exact -->|/thue-gia-cong| ServiceDirectory["ServiceLanding + ServiceDirectory"]
  Exact -->|/thue-gia-cong/[family]| ServiceFamily["ServiceFamilyDetail"]
  Exact -->|Không| CatchAll["/[...slug]"]
  CatchAll --> Manifest["manifest.json tìm file tương ứng"]
  Manifest --> Captured["CapturedPage render HTML capture"]
  Captured --> Legacy["237 URL dịch vụ / sản phẩm / tin tức cũ"]
```

| Route gốc | Khi khách truy cập | Thành phần UI | Nguồn dữ liệu |
|---|---|---|---|
| `/` | Hiển thị trang chủ clone | `CapturedPage` | `pages/home.json` |
| `/san-pham` | Hiển thị catalog B2B | `CatalogList` | Cloudflare D1 |
| `/san-pham/[slug]` | Hiển thị chi tiết một sản phẩm | `CatalogDetail` | Cloudflare D1; slug legacy có thể redirect vĩnh viễn |
| `/san-pham/[...path]` | URL catalog nhiều cấp | 404 | Không có UI fallback |
| `/thue-gia-cong` | Hiển thị directory dịch vụ | `ServiceLanding`, `ServiceDirectory` | `service-families.ts` |
| `/thue-gia-cong/[family]` | Hiển thị một trong 13 nhóm | `ServiceFamilyDetail` | `service-families.ts` |
| `/lien-he` | Không có route riêng | Rơi vào `[...slug]` | `pages/lien-he.json` |
| `/gia-cong-sua-hat`, `/dich-vu-say`, `/tin-tuc`, … | Không có route riêng | Rơi vào `[...slug]` | 237 file trong `pages/` |

Quản trị nội bộ dùng admin Cloudflare-native tại `/admin` (bảo vệ bởi Cloudflare Access ở production; staging chạy public demo mode trên `admin-staging.kienhieu.id.vn`). Route `/quan-tri/*`, BFF quản trị và proxy Bagisto đã được xóa khỏi runtime. Ghi chú 2026-08-23: route group `(commerce)` và các chrome component mồ côi đã bị xóa — toàn bộ storefront phục vụ từ `(storefront)`; catalog đọc D1 qua adapter batched; POST `/api/contact` có rate limit 5 yêu cầu/phút/IP (trả 429 + Retry-After).
