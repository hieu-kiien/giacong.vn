"use client";

import { useState } from "react";

import styles from "@/components/catalog/catalog.module.css";

interface CatalogProductImageProps {
  alt: string;
  className?: string;
  /**
   * Local packshot shown when `imageUrl` is absent or fails to load. Supplied by
   * the listing card; the detail surfaces pass nothing and keep the original
   * "Chưa có hình ảnh" placeholder.
   */
  fallbackSrc?: string;
  imageUrl: string | null;
  /**
   * `card` renders the landscape ratio of the approved product-list reference.
   * `detail` (the default) retains the detail surface's independent square frame.
   * They stay separate so the list can change without affecting product detail.
   */
  variant?: "card" | "detail";
}

export function CatalogProductImage({
  alt,
  className,
  fallbackSrc,
  imageUrl,
  variant = "detail",
}: CatalogProductImageProps) {
  // An upstream URL that 404s must not leave a hole in the grid, so a failed load
  // degrades to the local packshot instead of an empty frame.
  const [failed, setFailed] = useState(false);
  const source = !imageUrl || failed ? fallbackSrc : imageUrl;

  // The list card overrides the shared square utility with the reference's
  // landscape ratio; only the bottom radius is dropped so it meets the card body
  // on a straight edge.
  if (variant === "card") {
    return (
      <div className={`commerce-image-frame !aspect-[10/7] rounded-b-none bg-commerce-active-surface ${className ?? ""}`}>
        {source ? (
          // Content-owned URLs from Bagisto plus local packshots; the native img
          // avoids remote-host configuration for the upstream case.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={alt}
            className="size-full object-cover"
            height={400}
            loading="lazy"
            onError={() => setFailed(true)}
            src={source}
            width={500}
          />
        ) : (
          <span className="flex size-full items-center justify-center p-3 text-center text-xs text-commerce-secondary">
            Chưa có hình ảnh
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`${styles.image} ${className ?? ""}`}>
      {source ? (
        // The Bagisto image URL is content data; the native img avoids remote image host config.
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={alt} onError={() => setFailed(true)} src={source} />
      ) : (
        <span className={styles.imageFallback} aria-label="Sản phẩm chưa có hình ảnh">Chưa có hình ảnh</span>
      )}
    </div>
  );
}
