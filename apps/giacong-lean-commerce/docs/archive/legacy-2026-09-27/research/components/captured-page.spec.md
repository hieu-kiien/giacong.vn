# CapturedPage Specification

## Overview
- **Target files:** `src/components/CapturedPage.tsx`, `src/app/[...slug]/page.tsx`
- **Reference source:** `C:\Users\hieuk\Desktop\cào giacong.vn\mirror`
- **Interaction model:** responsive CSS, hover dropdowns, click-driven mobile navigation and forms

## Data contract
- Every mirrored `index.html` becomes one route entry.
- Preserve the original title, description, body classes, HTML classes, inline styles and body markup.
- Internal links resolve to their local Next.js path and never navigate to `giacong.vn`.
- Lazy-loaded images use their real `data-src` and `data-srcset` values without duplicate attributes.

## Page classes
- Apply the captured body classes to both the page wrapper and `document.body`.
- Restore the previous body classes when navigating away.
- Home keeps `home page-template...`.
- Archives keep `archive`, `woocommerce`, and taxonomy classes.
- Articles keep `single`, `single-post`, and `has-ftoc` where present.

## Shared styles
- Flatsome, Flatsome Shop and the child-theme stylesheet are global.
- Menu Icons, WooCommerce Blocks, star ratings, quick buy, Fixed TOC and Contact Form 7 styles are available globally.
- Per-page inline styles render before page markup.

## Responsive behavior
- **Desktop (1440px):** centered logo, left/right navigation groups and hover dropdowns.
- Product and service mega menus open on hover or keyboard focus, are centered inside the
  1270px header container, are capped at 1240px wide, and use four equal columns.
- At 1920px the mega-menu target bounds are `left: 340px`, `top: 70px`, `width: 1240px`.
- **Tablet (768px):** mobile navigation trigger, responsive Flatsome column widths.
- **Mobile (390px and 320px):** no horizontal overflow, off-canvas menu and expandable nested menus.
- The mobile off-canvas panel is 260px wide, uses an opaque `#5aa400` background,
  covers the viewport height, locks page scrolling and displays a dismissible dark backdrop.
- Preserve the source breakpoints at 849px and 549px.

## Verification
- Manifest contains at least 230 mirrored routes.
- Representative home, archive, service, product and contact routes return HTTP 200.
- No console errors, broken images or unintended external header links.
- Browser widths: 320, 390, 768, 1024 and 1440.
- Fixed TOC icon fonts are served locally so physical devices do not hit cross-origin font errors.
- Physical-device development uses an allowed LAN origin and verifies hydration/touch interactions.
