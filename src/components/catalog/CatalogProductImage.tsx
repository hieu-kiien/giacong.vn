import styles from "@/components/catalog/catalog.module.css";

interface CatalogProductImageProps {
  alt: string;
  className?: string;
  imageUrl: string | null;
}

export function CatalogProductImage({ alt, className, imageUrl }: CatalogProductImageProps) {
  return (
    <div className={`${styles.image} ${className ?? ""}`}>
      {imageUrl ? (
        // The Bagisto image URL is content data; the native img avoids remote image host config.
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={alt} src={imageUrl} />
      ) : (
        <span className={styles.imageFallback} aria-label="Sản phẩm chưa có hình ảnh">Chưa có hình ảnh</span>
      )}
    </div>
  );
}
