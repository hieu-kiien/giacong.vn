# 03. Design System

## 1. Ngôn ngữ thị giác
- Tin cậy, sạch, hiện đại, tự nhiên, bền vững.
- Tương phản rõ giữa nội dung doanh nghiệp và commerce nhưng cùng một hệ thống.
- Nền trắng là chủ đạo; xanh nhạt tạo vùng; xanh đậm dành cho CTA/footer.
- Ảnh sản phẩm sáng, nền sạch. Ảnh nhà máy ưu tiên góc rộng, ánh sáng tự nhiên, nhân sự mặc bảo hộ đúng chuẩn.

## 2. Màu sắc

### Brand green
| Token | Hex | Dùng cho |
|---|---|---|
| `--green-950` | `#052E16` | Footer/overlay đậm |
| `--green-900` | `#075E2E` | CTA đậm, heading đặc biệt |
| `--green-800` | `#0B6B34` | Hover CTA |
| `--green-700` | `#15803D` | Active/links |
| `--green-600` | `#16A34A` | Primary |
| `--green-500` | `#22C55E` | Success/accent |
| `--green-400` | `#4ADE80` | Decorative |
| `--green-200` | `#BBF7D0` | Border nhẹ |
| `--green-100` | `#DCFCE7` | Badge background |
| `--green-50` | `#F0FDF4` | Section background |

### Neutral
- `--slate-950: #020617`
- `--slate-900: #0F172A`
- `--slate-800: #1E293B`
- `--slate-700: #334155`
- `--slate-600: #475569`
- `--slate-500: #64748B`
- `--slate-300: #CBD5E1`
- `--slate-200: #E2E8F0`
- `--slate-100: #F1F5F9`
- `--slate-50: #F8FAFC`
- `--white: #FFFFFF`

### Semantic
- Success: `#16A34A`.
- Info: `#0284C7`.
- Warning: `#F59E0B`.
- Error/price emphasis: `#DC2626`.
- Rating: `#F59E0B`.

Không dùng màu đỏ cho CTA thông thường.

## 3. Typography

### Font
- Primary: `Be Vietnam Pro` từ `next/font/google`.
- Fallback: `Inter`, `Arial`, sans-serif.
- Numeral/price có thể dùng cùng font, weight 700-800.

### Desktop scale
| Style | Size/line | Weight |
|---|---|---|
| Display | 64/72 | 700 |
| H1 | 48/58 | 700 |
| H2 | 36/44 | 700 |
| H3 | 28/36 | 650-700 |
| H4 | 22/30 | 600 |
| H5 | 18/26 | 600 |
| Body L | 18/30 | 400 |
| Body | 16/26 | 400 |
| Body S | 14/22 | 400 |
| Caption | 12/18 | 500 |
| Button | 14-16/20 | 600 |

### Mobile
- H1 36/44.
- H2 28/36.
- H3 22/30.
- Body 15-16/24.

Heading dùng `letter-spacing: -0.02em` tới `-0.035em`. Body không giảm tracking quá mức.

## 4. Grid và container
- Max width: 1280px.
- 12 cột desktop; gutter 24px.
- Tablet 8 cột; gutter 20px.
- Mobile 4 cột; gutter 16px.
- Container padding: 24px desktop, 20px tablet, 16px mobile.
- Section vertical spacing: 96px desktop, 72px tablet, 56-64px mobile.

## 5. Spacing scale
Base 4px: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128`.

## 6. Border radius
- `radius-sm`: 8px.
- `radius-md`: 12px.
- `radius-lg`: 16px.
- `radius-xl`: 24px.
- `radius-2xl`: 32px.
- `radius-pill`: 999px.

## 7. Shadows
- `shadow-xs`: border-like subtle.
- `shadow-sm`: card default.
- `shadow-md`: hover/menus.
- `shadow-lg`: hero collage/dialog.
- Không dùng shadow đen mạnh; ưu tiên rgba xanh/slate opacity thấp.

## 8. Buttons

### Primary
- Nền green-700, text trắng, radius 10-12px.
- Height 44px mặc định, 52px hero.
- Hover green-800 + lift 1px.

### Secondary
- Nền trắng, border green-300, text green-800.
- Hover green-50.

### Tertiary/text
- Không nền; text green-700; arrow dịch 3px khi hover.

### Icon button
- 40x40 hoặc 44x44, hit target tối thiểu 44px.

## 9. Inputs
- Height 46-48px.
- Border slate-200.
- Focus ring 3px rgba(34,197,94,.18), border green-500.
- Error border đỏ và helper text; không chỉ dùng màu để báo lỗi.
- Textarea min-height 120px.

## 10. Cards
- Border 1px slate-200/70.
- Background trắng.
- Radius 16px.
- Hover: translateY(-4px), shadow-md, border green-200.
- Không cho tất cả card cùng mức shadow; card thông tin tĩnh có thể chỉ border.

## 11. Iconography
- Lucide icons stroke 1.75-2px.
- 20px cho inline; 24px button; 32-40px card feature.
- Icon service đặt trong circle xanh nhạt 48-56px.

## 12. Image treatment
- Product: aspect 4:3 hoặc 1:1, nền `#FAFAF8`, object-contain.
- Article: 16:9, object-cover.
- Factory/hero: rounded 24px, object-cover, highlight tự nhiên.
- Có gradient overlay nhẹ khi đặt text trên ảnh.

## 13. Responsive rules
- Hero 2 cột >= 1024, xếp dọc dưới 1024.
- Service cards 6/3/2/1 cột tùy breakpoint.
- Product grid 4 cột desktop, 3 ở 1024, 2 tablet, 1-2 mobile tùy 360/390.
- Filter sidebar thành bottom sheet/drawer dưới 1024.
- Table giá bậc chuyển sang horizontal scroll hoặc stacked cards mobile.

## 14. CSS token source
Dùng `config/design-tokens.json` và `src-snippets/design-tokens.css` làm nguồn triển khai.
