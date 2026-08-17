export interface ProductGalleryAsset {
  altText: string | null;
  storageKey: string;
}

export interface ProductGalleryImage {
  alt: string;
  url: string;
}

interface BuildLiveProductGalleryInput {
  assets: readonly ProductGalleryAsset[];
  productImageUrl: string | null;
  productName: string;
}

const MAX_GALLERY_IMAGES = 12;

/**
 * Builds the production product gallery from canonical product imagery plus active
 * R2 media assets. Demo packshots intentionally never enter this path.
 */
export function buildLiveProductGallery({
  assets,
  productImageUrl,
  productName,
}: BuildLiveProductGalleryInput): ProductGalleryImage[] {
  const gallery: ProductGalleryImage[] = [];
  const seen = new Set<string>();

  const add = (url: string | null, alt: string | null) => {
    const normalizedUrl = url?.trim();
    if (!normalizedUrl || seen.has(normalizedUrl) || gallery.length >= MAX_GALLERY_IMAGES) return;
    seen.add(normalizedUrl);
    gallery.push({
      alt: alt?.trim() || productName,
      url: normalizedUrl,
    });
  };

  add(productImageUrl, productName);
  for (const asset of assets) {
    add(publicMediaUrl(asset.storageKey), asset.altText);
  }

  return gallery;
}

export function publicMediaUrl(storageKey: string): string | null {
  const parts = storageKey
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length || parts.some((part) => part === "." || part === "..")) return null;
  return `/media/${parts.map(encodeURIComponent).join("/")}`;
}
