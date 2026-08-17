"use client";

import { useState } from "react";

import styles from "@/components/catalog/product-detail.module.css";
import type { DemoGalleryImage } from "@/data/demo-product-gallery";

interface ProductGalleryProps {
  images: readonly DemoGalleryImage[];
}

/**
 * Main image plus a single-row thumbnail rail, as the detail specification
 * describes it.
 *
 * The main image box is sized by CSS (`aspect-ratio` on `.mainImage`) rather than by
 * the loaded image, so switching thumbnails cannot shift the layout — the behaviour
 * specification requires exactly that.
 *
 * A native `<img>` is used rather than `next/image` because product media is content
 * data served either by the local R2 proxy route or a validated HTTPS catalog URL.
 */
export function ProductGallery({ images }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex] ?? images[0];

  if (!active) {
    return (
      <div className={styles.gallery}>
        <div className={styles.mainImage}>
          <span className="px-6 text-center text-sm text-commerce-secondary">Chưa có hình ảnh</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.gallery}>
      <div className={styles.mainImage}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={active.alt} src={active.url} />
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="" loading="lazy" src={image.url} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
