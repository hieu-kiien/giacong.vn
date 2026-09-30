# StorefrontShell specification

## Target

- Files: `src/components/commerce/CommerceHeader.tsx`, `CommerceShell.tsx`, `MobileCommerceNav.tsx`
- Reference: `SCR-01-product-mega-menu.png`, `SCR-02-product-list.png`
- Interaction: sticky + click/keyboard

## Structure

- Header contains logo, six navigation actions, hotline, quote button and request-cart icon/badge.
- Desktop rail is centered and approximately 1390/1672 of the canvas.
- Header height is 65 px. Logo visual width is 170–190 px.
- No legacy captured footer or global captured CSS in commerce route groups.

## Visual

- Flat brand-green background and white foreground.
- Active Product item uses darker translucent green or white surface depending on menu-open state.
- Quote button is outlined white, 116–132 px wide and 42–44 px high.
- Cart badge is a white circle with green text at the upper-right of the icon.
- Focus states remain visible on green.

## Responsive

- Below 900–1024 px: logo, menu trigger, hotline icon and cart remain; full nav collapses.
- Drawer is full height from the right, max 340 px, with a backdrop.
- At 390/320 px, header remains 56–60 px and never overflows horizontally.
