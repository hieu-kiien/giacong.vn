# CatalogListPage specification

## Target

- Files: `src/components/commerce/CatalogPage.tsx`, `CatalogFilters.tsx`, `CatalogToolbar.tsx`
- Reference: `SCR-02-product-list.png`
- Interaction: URL-driven filters and mobile drawer

## Desktop geometry

- Header ends at y≈65 on the reference.
- Page content rail starts at x≈142 and ends at x≈1528.
- Heading/trust zone is approximately 120 px high.
- Search/chips row is 40–44 px high.
- Toolbar follows with 44 px controls.
- Body begins near y≈305.
- Sidebar is 230 px; grid fills the rest with four equal columns and 16–20 px gaps.

## Content

- Breadcrumb, `Danh sách sản phẩm`, one-line supporting text.
- Four trust benefits with simple line icons.
- Search plus category chips.
- Filter button, result count, sort and cart shortcut.
- Sidebar category counts and price bands.
- Product grid driven by `ProductCard`.
- B2B support strip above the viewport bottom.

## Responsive

- Trust benefits condense or move below heading.
- Category chips scroll horizontally instead of wrapping into tall rows.
- Sidebar becomes a drawer below 900 px.
- No footer is visible in the first desktop viewport.
