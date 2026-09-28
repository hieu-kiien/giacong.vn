"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";

import styles from "@/components/catalog/product-detail.module.css";
import type { ProductGalleryImage } from "@/lib/product-detail-view";

interface ProductGalleryProps {
  images: readonly ProductGalleryImage[];
}

/**
 * Main image plus a thumbnail rail. The main image follows the
 * uploaded asset's natural aspect ratio and uses a fallback ratio while loading.
 *
 * A native `<img>` is used rather than `next/image` for the same reason
 * `CatalogProductImage` does: a catalog image URL is content data, and routing it
 * through the optimizer would need a remote-host allowlist this step does not own.
 */
export function ProductGallery({ images }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(() => new Set());
  const active = images[activeIndex] ?? images[0];

  function markImageFailed(url: string) {
    setFailedImageUrls((current) => {
      if (current.has(url)) return current;
      return new Set(current).add(url);
    });
  }

  if (!active) {
    return (
      <div className={styles.gallery} role="status">
        <div className={styles.mainImage}>
          <span>Ảnh sản phẩm chưa được cập nhật</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.gallery}>
      <div className={styles.mainImage}>
        {failedImageUrls.has(active.url) ? (
          <div aria-label="Không thể tải ảnh sản phẩm" className={styles.mainImageFallback} role="img">
            <ImageOff aria-hidden="true" size={28} />
            <span>Không thể tải ảnh sản phẩm</span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={active.alt} onError={() => markImageFailed(active.url)} src={active.url} />
        )}
      </div>
      {images.length > 1 ? (
        <ul aria-label="Ảnh sản phẩm" className={styles.thumbRail}>
          {images.map((image, index) => (
            <li key={image.url}>
              <button
                aria-current={index === activeIndex}
                aria-label={`Xem ${image.alt}`}
                className={styles.thumb}
                onClick={() => setActiveIndex(index)}
                type="button"
              >
                {failedImageUrls.has(image.url) ? (
                  <span aria-hidden="true" className={styles.thumbFallback} title="Ảnh không khả dụng">
                    <ImageOff size={18} />
                  </span>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" loading="lazy" onError={() => markImageFailed(image.url)} src={image.url} />
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
