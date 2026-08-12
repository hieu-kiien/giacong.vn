export const DEMO_PRODUCT_IMAGES = [
  "/images/products/demo-powder-pouches.png",
  "/images/products/demo-dried-fruit-pouches.png",
  "/images/products/demo-sauce-bottles.png",
  "/images/products/demo-fruit-drinks.png",
] as const;

/**
 * Local packshots used when a demo product has no image of its own. Rotating by
 * grid position keeps every four-column row visually distinct.
 */
export function demoProductImage(index: number): string {
  const position = Number.isFinite(index) ? Math.trunc(index) : 0;
  return DEMO_PRODUCT_IMAGES[
    ((position % DEMO_PRODUCT_IMAGES.length) + DEMO_PRODUCT_IMAGES.length)
      % DEMO_PRODUCT_IMAGES.length
  ];
}
