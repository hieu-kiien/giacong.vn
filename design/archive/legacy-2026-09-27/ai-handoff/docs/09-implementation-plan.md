# 09. Implementation Plan

## Phase 0 - Chuẩn bị
- Xác nhận logo SVG, brand assets, địa chỉ, hotline, email, tên pháp nhân.
- Xác nhận chứng nhận, số liệu, đối tác và quyền dùng logo.
- Chọn CMS/back-end/checkout model.
- Thiết lập repo, CI, environments.

## Phase 1 - Foundation
- Next.js project.
- Fonts, design tokens, Tailwind theme.
- Global styles, container, section, button, form primitives.
- ESLint/Prettier/typecheck/test scripts.

**Gate:** UI primitives đúng token, build sạch.

## Phase 2 - Layout shell
- Header desktop/mobile.
- Mega menus.
- Footer.
- Breadcrumb.
- Floating contact dock.

**Gate:** keyboard navigation và responsive.

## Phase 3 - Marketing components
- Hero collage.
- Service cards.
- Stats/counter.
- Process timeline.
- CTA bands.
- Partner carousel.
- Article cards.

## Phase 4 - Trang chủ
- Dựng toàn page theo ảnh.
- Thêm animation sau khi layout chính xác.
- Screenshot comparison 1440px.

## Phase 5 - About + Services
- About page.
- Services overview.
- Service detail template.
- CMS mapping.

## Phase 6 - Commerce UI
- Product card variants.
- Listing filters/query.
- Product detail gallery/tabs/tier pricing.
- Cart basic nếu trong scope.

## Phase 7 - News
- Listing + search/category.
- Article detail + rich text renderer + TOC.
- SEO schemas.

## Phase 8 - Contact & leads
- Advanced quote form.
- Server validation/API/storage/email.
- Upload.
- Rate limit/spam prevention.
- Success/error tracking.

## Phase 9 - Motion polish
- Page transition.
- Scroll reveal.
- Hero motion.
- Counters/timeline.
- Reduced motion.
- Performance test trên mobile.

## Phase 10 - QA & launch
- Responsive visual QA.
- Cross-browser.
- Accessibility.
- Content/legal verification.
- SEO/canonical/schema.
- Analytics.
- Lighthouse and bundle audit.
- Redirects từ URL cũ.

## Priority order nếu thời gian hạn chế
1. Home, contact form, services, header/footer.
2. About, product listing/detail.
3. News.
4. Cart/checkout nâng cao.

## AI agent work packets
Mỗi packet không quá lớn:
1. Tokens + primitives.
2. Header/menu/footer.
3. Home sections.
4. Home assembly.
5. About.
6. Services.
7. Catalog components.
8. Product listing.
9. Product detail.
10. News.
11. Contact form backend.
12. Motion + tests + SEO.

Sau mỗi packet, chạy lint/typecheck/build và chụp screenshot.
