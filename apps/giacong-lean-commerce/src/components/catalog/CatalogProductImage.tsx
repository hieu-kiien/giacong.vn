"use client";

import { useState } from "react";

import styles from "@/components/catalog/catalog.module.css";

interface CatalogProductImageProps {
  alt: string;
  className?: string;
  /**
   * Optional fallback used only by explicitly demo-backed listing cards.
   */
  fallbackSrc?: string | null;
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
  // Only explicitly demo-backed cards pass a fallback. Real records keep the
  // honest empty state when their managed media is absent or fails to load.
  const [failed, setFailed] = useState(false);
  const source = !imageUrl || failed ? fallbackSrc : imageUrl;

  // The list card overrides the shared square utility with the reference's
  // landscape ratio; only the bottom radius is dropped so it meets the card body
  // on a straight edge.
  if (variant === "card") {
    return (
      <div className={`commerce-image-frame !aspect-[10/7] rounded-b-none bg-commerce-active-surface ${className ?? ""}`}>
        {source ? (
          // Content-owned URLs from D1/R2; the native img avoids remote-host
          // configuration for content-managed images.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={alt}
            className="size-full object-contain"
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
        // The catalog image URL is content data; the native img avoids remote image host config.
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={alt} onError={() => setFailed(true)} src={source} />
      ) : (
        <span className={styles.imageFallback} aria-label="Sản phẩm chưa có hình ảnh">Chưa có hình ảnh</span>
      )}
    </div>
  );
}
