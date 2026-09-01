/**
 * Demo packshots for the product gallery.
 *
 * The catalog contract allows `imageUrl: null`, and the design tokens forbid a
 * generic gray placeholder box: product imagery must sit on a warm surface. Until
 * the real photography is approved (**Chờ xác nhận** in the current plan) the detail
 * gallery fills its thumbnail rail from the demo packshots already tracked in
 * `public/images/products/`.
 *
 * Deliberately separate from `src/data/demo-catalog.ts`: this file maps a category
 * to imagery only, so the catalog fixture stays a pure data fixture and neither
 * file has to change when the other does.
 *
 * Every asset here is demo content and must be replaced before a public launch.
 */

/** Guard rail for callers and tests: none of this imagery is production imagery. */
export const IS_DEMO_GALLERY_DATA = true;

const DEMO_PACKSHOTS = [
  "/images/products/demo-powder-pouches.webp",
  "/images/products/demo-dried-fruit-pouches.webp",
  "/images/products/demo-sauce-bottles.webp",
  "/images/products/demo-fruit-drinks.webp",
] as const;

/**
 * Lead packshot per demo category, so a powder product does not open on a bottle.
 * An unknown category falls back to the first packshot.
 */
const LEAD_PACKSHOT_BY_CATEGORY: Record<string, string> = {
  "bao-bi-dong-goi": "/images/products/demo-dried-fruit-pouches.webp",
  "bot-nguyen-lieu-kho": "/images/products/demo-powder-pouches.webp",
  "sot-gia-vi-long": "/images/products/demo-sauce-bottles.webp",
  "tra-thao-moc-say": "/images/products/demo-fruit-drinks.webp",
};

/** How many images the rail shows, including any real catalog image. */
const GALLERY_SIZE = 3;

export interface DemoGalleryImage {
  alt: string;
  url: string;
}

/**
 * Builds the gallery for one product: the catalog image first when it exists, then
 * demo packshots led by the category's own, until the rail is full. Alt text names
 * the product and marks the demo images as illustrative rather than as the product.
 */
export function buildDemoGallery(input: {
  categorySlug: string | null;
  imageUrl: string | null;
  productName: string;
}): DemoGalleryImage[] {
  const lead = (input.categorySlug && LEAD_PACKSHOT_BY_CATEGORY[input.categorySlug]) || DEMO_PACKSHOTS[0];
  const ordered = [lead, ...DEMO_PACKSHOTS.filter((packshot) => packshot !== lead)];

  const gallery: DemoGalleryImage[] = [];
  if (input.imageUrl) {
    gallery.push({ alt: input.productName, url: input.imageUrl });
  }
  for (const url of ordered) {
    if (gallery.length >= GALLERY_SIZE) break;
    gallery.push({
      alt: `${input.productName} — ảnh minh hoạ demo ${gallery.length + 1}`,
      url,
    });
  }
  return gallery;
}
