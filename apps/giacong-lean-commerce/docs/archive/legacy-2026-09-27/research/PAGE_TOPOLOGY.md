# Commerce UI topology

## Source of truth

- Desktop canvas: 1672 × 941 in `docs/handoff-references/references/approved/`.
- Target implementation viewports: 1440, 1024, 768, 390 and 320 CSS pixels.
- The four approved screenshots define appearance. The master plan overrides forbidden behavior: no rating, review, favorite, checkout, payment, shipping or customer account.

## Shared commerce shell

1. Green header, fixed visual height 64–66 px on desktop.
2. Centered content rail, approximately 1390 px on the 1672 px reference canvas.
3. Product navigation, hotline, request-quote action and request-cart badge.
4. Optional mega-menu overlay anchored below the Product navigation item.
5. Floating phone, Zalo and Messenger actions on desktop.
6. No captured Flatsome footer or global captured stylesheet on commerce routes.

## `/san-pham`

1. Breadcrumb and two-line page heading.
2. Trust-benefit row aligned to the right of the page heading on desktop.
3. Search and horizontal category chips.
4. Result/filter toolbar.
5. Two-column body: 230 px sidebar and a four-column product grid.
6. Fixed/near-bottom B2B support strip above the viewport edge.
7. Mobile: compact header, filter drawer, two-column card grid at 390 px and one column only when content would fall below 156 px/card.

## Product card

1. Image-led card with a 1.25:1 landscape image area.
2. Category pill inside the image, no favorite control.
3. Name, red price, unit, specification and availability.
4. Quantity stepper plus add-to-request-cart and detail/select-variant action.
5. Cards keep equal heights within a row.

## `/san-pham/[slug]`

1. Breadcrumb.
2. Two-column hero: gallery left, commercial information right.
3. Product category, title, price/unit, description, availability and SKU facts.
4. Tier-price table, variant selector when needed, quantity and subtotal.
5. Add-to-request-cart and submit-request actions.
6. Description/features panel and related-product rail.
7. No rating, review or favorite; no payment/shipping claims.

## Interaction model

- Header: static/sticky, click and keyboard driven menus.
- Mega-menu: click or hover on desktop, click drawer on mobile; Escape closes and focus returns to trigger.
- Filters: URL-driven; drawer on mobile.
- Cards: quantity buttons and add-to-cart are click driven.
- Detail gallery: thumbnail/arrow click driven.
- Cart badge: reacts to local request-cart storage events.
- B2B support strip and floating contacts: static links; never cover primary content.
