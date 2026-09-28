# Commerce behavior specification

## Header and mega-menu

- Desktop Product navigation opens a panel immediately below the 64–66 px header.
- Panel width follows the content rail and has three zones: primary categories, subcategories, featured products.
- Active category uses pale green background and a 3–4 px green leading edge.
- Search filters category/product labels without navigating.
- Keyboard: Enter/Space toggles, arrows may move within a list, Escape closes, focus returns to the trigger.
- Mobile uses one drawer with expandable category groups; body scrolling is locked only while open.

## Catalog

- Search, category, sort and page-size values remain canonical URL state.
- Desktop filter panel is always visible; mobile filter is a modal drawer.
- Grid/list toggle is visible only when both modes are implemented; otherwise ship grid only rather than a dead control.
- Loading preserves the grid geometry. Empty/error states occupy the grid region without removing the header or filters.

## Product cards

- Image and title both lead to detail.
- Product with a usable unique variant may be added directly using a default quantity respecting MOQ/step.
- Product requiring a variant displays `Chọn quy cách`, opening detail/preview without inventing a variant key.
- Cart action gives an immediate non-color-only confirmation and updates the shared badge.
- No favorite heart, stars, rating count or review link.

## Detail

- Thumbnail selection changes the main image without layout shift.
- Single-axis variants only.
- Quantity clamps to MOQ/max and moves by step.
- Displayed prices are server-derived when connected; demo fallback data is clearly isolated from production data.
- Primary action adds to the request cart. Secondary action moves to `/gui-yeu-cau`.

## Responsive

- 1440: full navigation, sidebar and four cards.
- 1024: compact navigation, sidebar and three cards where width permits.
- 768: mobile/compact navigation, filter drawer and two cards.
- 390: two compact cards matching the visual density of the reference; controls wrap inside cards.
- 320: one card if two columns would make touch targets or text unreadable.
