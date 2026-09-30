export const MAX_PRODUCT_GALLERY_IMAGES = 40;

export function serializeAdminProductGalleryState(
  images: readonly { imageUrl: string; isPrimary: boolean; sortOrder: number }[],
): string {
  return JSON.stringify(images.map(({ imageUrl, isPrimary, sortOrder }) => ({ imageUrl, isPrimary, sortOrder })));
}
