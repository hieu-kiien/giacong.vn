# 06. Motion & Animation Specification

## 1. Nguyên tắc
- Motion hỗ trợ phân cấp, phản hồi và kể chuyện; không dùng để trang trí quá mức.
- Ưu tiên transform/opacity; tránh animation thuộc tính gây layout/repaint nặng.
- Mỗi viewport chỉ có ít animation loop.
- Tôn trọng `prefers-reduced-motion`.

## 2. Motion tokens

| Token | Giá trị | Dùng cho |
|---|---:|---|
| `instant` | 100ms | pressed/checkbox |
| `fast` | 180ms | hover, dropdown nhỏ |
| `base` | 260ms | menu, modal, tab |
| `slow` | 480ms | scroll reveal |
| `hero` | 700ms | hero intro |

### Easing
- Standard: `[0.22, 1, 0.36, 1]`.
- Enter: `[0.16, 1, 0.3, 1]`.
- Exit: `[0.4, 0, 1, 1]`.
- Spring UI: stiffness 420, damping 34, mass .75.

## 3. Page transition
- App Router transition wrapper.
- Enter: opacity 0 -> 1, y 8 -> 0, 260ms.
- Exit nếu triển khai: opacity 1 -> 0, 140ms.
- Không delay navigation hoặc chặn interaction.
- Tránh full-page white flash; giữ layout shell/header/footer ổn định.

## 4. Header
- Shrink sau scroll 64px.
- Height 80 -> 68, logo scale 1 -> .92, 220ms.
- Background alpha/blur tăng nhẹ.
- Mega menu opacity + y 8, 200ms; content columns stagger tối đa 40ms.

## 5. Hero intro
- Text block fade-up 18px, 600ms.
- CTA 80ms stagger.
- Image collage scale .97 -> 1 + opacity, 700ms.
- Badge spring nhẹ 100ms sau collage.
- Leaves float bằng CSS, duration 10-16s, alternate.

## 6. Scroll reveal
Dùng `whileInView` hoặc IntersectionObserver:
- `amount: 0.2`.
- `once: true`.
- y 20, opacity 0.
- 480ms.
- Grid stagger 60ms, cap 6 items; các item sau cùng nhóm không tăng delay vô hạn.

## 7. Cards và buttons
- Card hover: y -4, shadow tăng, 180ms.
- Product image: scale 1 -> 1.025, 260ms.
- Arrow icon: x 0 -> 3.
- Button tap: scale .985 trong 80ms.
- Wishlist: scale keyframe 1/.85/1.08/1 nếu chọn.

## 8. Counters
- Animate từ 0 đến value trong 900-1200ms khi vào viewport.
- Format locale `vi-VN`.
- Nếu value chứa `+`/`%`, animate phần số và render suffix riêng.
- Reduced motion: hiển thị final ngay.

## 9. Timeline
- Connector line scaleX 0 -> 1 desktop; scaleY mobile.
- Step reveal theo thứ tự.
- Không chạy lại khi cuộn lên xuống.

## 10. Carousel
- Swiper hoặc Motion drag.
- Transition 320-450ms.
- Autoplay chỉ partner/logo carousel, pause hover/focus, interval >= 4.5s.
- Product carousel không autoplay.
- Có button keyboard accessible và pagination indicator nếu cần.

## 11. Accordion
- Dùng Radix + CSS data state hoặc Motion layout.
- Icon chevron rotate 180.
- Content opacity + height, 220-280ms.
- Không để focus nhảy.

## 12. Filter drawer / dialog
- Overlay fade 180ms.
- Panel slide 280ms.
- Mobile bottom sheet: y 100% -> 0, radius top 24px.
- Lock body scroll, restore focus khi đóng.

## 13. Form feedback
- Error message fade/slide 4px.
- Submit loading spinner.
- Success icon path/check animate ngắn.
- Không rung toàn form; nếu cần shake chỉ input cụ thể, amplitude 3px.

## 14. Decorative background
- `LeafFloat`: translateY +/- 8px, rotate +/- 3deg, 12-18s.
- `BlobDrift`: translate 12-20px, scale .98-1.02, 16-24s.
- Dùng absolute pointer-events-none, aria-hidden.
- Không render trên màn hình nhỏ nếu làm rối.

## 15. Reduced motion
Trong CSS:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```
Trong Motion dùng `useReducedMotion()` để bỏ parallax, stagger và loop.

## 16. Performance budget
- Không dùng GSAP cho component đơn giản.
- GSAP chỉ cân nhắc cho sequence hero phức tạp hoặc scroll storytelling, và phải lazy-load.
- Không animate blur lớn liên tục.
- Không quá 20 motion nodes chạy đồng thời.
- Kiểm tra trên thiết bị Android tầm trung và Safari iOS.

## 17. Preset code
Xem `src-snippets/animation-presets.ts`.
