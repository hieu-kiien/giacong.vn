# ProductDetailPage specification

## Target

- Files: `src/components/commerce/ProductDetailPage.tsx`, `ProductGallery.tsx`, `TierPriceTable.tsx`
- Reference: `SCR-04-product-detail.png`
- Interaction: gallery, variant, quantity and request-cart actions

## Desktop geometry

- Content rail begins around x=134 and ends around x=1540.
- Gallery occupies about 47%; product information about 43%; compact trust panel about 10%.
- Main gallery image is approximately 670 × 460 reference pixels.
- Thumbnail rail is a single horizontal row.
- Tier table sits above quantity/total and actions.
- Description and related products form the second row.

## Content

- Breadcrumb, category, title, red price/unit, description, availability and product facts.
- Replace rating/review space with concise verified product facts or natural spacing.
- No favorite.
- Tier prices show quantity bands, price and percentage saving when canonical.
- Single-axis variant selector where applicable.
- Quantity, subtotal, add-to-request-cart and `Gửi yêu cầu` action.
- Related product rail uses compact product cards without favorite/rating.

## Responsive

- At 1024 the trust panel moves below commercial information.
- At 768 and below gallery stacks above commercial information.
- Tier bands may scroll horizontally with an accessible label.
- Sticky mobile action bar must not cover content.
