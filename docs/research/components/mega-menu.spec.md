# ProductMegaMenu specification

## Target

- File: `src/components/commerce/ProductMegaMenu.tsx`
- Reference: `SCR-01-product-mega-menu.png`
- Interaction: click/hover desktop, click drawer mobile

## Desktop geometry

- Panel starts directly below the header.
- Reference panel bounds are approximately x=36–1635, y=81–812 on a 1672 × 941 canvas.
- Three main columns: 24% category, 25% subcategory, 51% featured products.
- Search is 380 px wide at the top-left.
- Featured area contains three compact product cards.
- Two B2B callout rows span the panel bottom.

## Visual and content

- White panel, 14–16 px radius, thin border and strong but soft overlay shadow.
- Active category: pale green background, green text and left rule.
- Subcategory rows include a small product/ingredient thumbnail.
- Featured cards have landscape images, pill label, name, spec, red price, detail and cart/request buttons.
- Remove every favorite heart from the approved screenshot.

## Accessibility

- Trigger exposes `aria-expanded` and `aria-controls`.
- Menu has a visible heading for each column.
- Escape closes; focus returns to trigger.
- Search has a real label available to assistive technology.
