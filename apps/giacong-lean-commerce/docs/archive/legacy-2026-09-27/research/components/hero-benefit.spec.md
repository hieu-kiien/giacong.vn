# Hero and Benefit Panel Specification

## Overview
- Target: `src/components/HeroSection.tsx`
- Screenshot: `docs/design-references/giacong-home-desktop-loaded.png`
- Interaction: static, with responsive collapsed nav.

## Structure
- Green 712px desktop visual hero, overflow hidden, with header at top.
- Centered `max-width: 1230px` content row: copy at left, 2x2 rounded image grid at right.
- White benefit card overlaps at the bottom; `border-radius: 20px`, shadow, image left and text/right bullet list.

## Typography and color
- Font: SF Pro Display, sans-serif.
- Green: #5dbb00 to #4d9d00; text white in hero.
- Heading: 40px desktop / 25px mobile, 700 weight.
- Desktop section 2 total height 618px; mobile 952px.

## Responsive
- At 768px and under, hide nav links; hero becomes tall stacked layout; image grid may be visually secondary.
- Benefit card stacks into one column, with inner image hidden on narrow mobile as shown in reference.

## Content
- Heading: Giải pháp gia công toàn diện chuyên nghiệp
- CTAs: Về chúng tôi; Liên hệ ngay
- Benefit heading: Đồng hành cùng doanh nghiệp trong thời đại mới
