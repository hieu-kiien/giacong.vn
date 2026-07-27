# ProductCard specification

## Target

- File: `src/components/commerce/ProductCard.tsx`
- Reference: `SCR-03-product-card.png`
- Interaction: links, quantity and cart actions

## Geometry

- Desktop card is approximately 360 × 500 reference pixels; four cards across.
- Border 1 px, radius 10–12 px, minimal shadow.
- Image area uses roughly 1.25:1 width:height and fills the card width.
- Category pill sits 12–16 px from the image top-left.
- Content padding is 14–16 px.

## Content order

1. Product image and category pill.
2. Product name.
3. Red VND price with gray unit.
4. Specification and green availability label.
5. Quantity stepper.
6. Add-to-request-cart action.
7. `Xem chi tiết` or `Chọn quy cách` action.

## Rules

- No heart, star, rating or review.
- Image and name both link to detail.
- Do not render a fake SKU/variant for quick add.
- Direct add is allowed only with a canonical usable variant.
- Maintain equal card heights and a stable image ratio.

## Responsive

- Four columns at 1440, three around 1024, two at 768/390, one at 320 if required.
- At 390, actions may stack but each target remains at least 44 px.
