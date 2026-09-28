# 10. Acceptance Tests & QA Checklist

## 1. Visual
- Header heights đúng ở top/scrolled.
- Max width 1280 và margins cân.
- Typography đúng scale.
- Section spacing nhất quán.
- Card radii/borders/shadows đúng token.
- Không text overflow, orphan heading hoặc button lệch.
- So screenshot Playwright 1440x1200 và full-page với ảnh tham chiếu.

## 2. Responsive viewports
- 360x800.
- 390x844.
- 768x1024.
- 1024x768.
- 1280x800.
- 1440x900.
- 1920x1080.

Kiểm tra menu, filters drawer, carousel, tables, form, sticky mobile buy bar.

## 3. Header/menu
- Tab qua toàn header theo thứ tự.
- Enter/Space mở menu.
- ESC đóng.
- Click ngoài đóng.
- Focus trở lại trigger.
- Mobile drawer khóa body scroll.

## 4. Product listing
- Query filter sync URL.
- Back/forward phục hồi state.
- Search/sort hoạt động.
- Pagination giữ filter.
- Empty state.
- Loading skeleton.
- Mobile apply/clear filters.

## 5. Product detail
- Gallery keyboard và zoom.
- Quantity min 1, giới hạn hợp lý.
- Tier price đổi đúng theo quantity.
- Subtotal format đúng.
- Add-to-cart feedback.
- Tabs keyboard accessible.
- Related carousel không trap keyboard.

## 6. Quote form
- Required fields.
- Email/phone validation.
- Service selection.
- File type/size errors.
- Consent.
- Loading disable double-submit.
- Server error có retry.
- Success có request ID/message.
- Honeypot/rate limit.

## 7. Accessibility
- Axe không có critical/serious issues.
- Một H1/trang.
- Heading order hợp lý.
- Images alt.
- Icon-only buttons aria-label.
- Focus visible.
- Color contrast.
- Reduced motion.
- Screen reader báo lỗi form.

## 8. Performance
- Không preload quá nhiều ảnh/font.
- Header/hero không gây CLS.
- Product grid lazy load.
- JS bundle theo route hợp lý.
- Motion library không kéo vào server-only routes vô ích.
- Lighthouse targets theo PRD.

## 9. SEO
- Title/description unique.
- Canonical.
- OG image.
- Sitemap/robots.
- Structured data valid.
- Noindex cho preview/staging.
- Redirect URL cũ.

## 10. Security
- Không secret trong source/client.
- Upload sanitize.
- API validation server.
- Rate limit.
- Security headers.
- Dependencies audit.

## 11. Playwright scenarios
1. Home -> Services -> Quote CTA.
2. Open/close mega menu desktop.
3. Mobile menu accordion.
4. Filter products and open detail.
5. Change quantity to tier threshold.
6. Submit quote success mocked/staging.
7. Invalid quote shows accessible errors.
8. News category and article navigation.
9. Reduced motion emulation.
10. 404 route.

## 12. Launch checklist
- Real content approved.
- Real logo/assets.
- Company/legal data approved.
- Forms delivered to correct recipient.
- Analytics consent verified.
- Domain/SSL/CDN.
- Backup/rollback.
- Monitoring/error tracking.
