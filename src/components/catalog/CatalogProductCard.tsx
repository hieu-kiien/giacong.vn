import Link from "next/link";

import { CatalogProductImage } from "@/components/catalog/CatalogProductImage";
import styles from "@/components/catalog/catalog.module.css";
import type { CatalogProduct } from "@/types/catalog";

interface CatalogProductCardProps {
  product: CatalogProduct;
}

export function CatalogProductCard({ product }: CatalogProductCardProps) {
  return (
    <article className={styles.card}>
      <Link href={`/san-pham/${encodeURIComponent(product.slug)}/`} aria-label={`Xem ${product.name}`}>
        <CatalogProductImage alt={product.name} imageUrl={product.imageUrl} />
      </Link>
      <div className={styles.cardContent}>
        {product.category ? <span className={styles.category}>{product.category.name}</span> : null}
        <h2 className={styles.productName}>
          <Link href={`/san-pham/${encodeURIComponent(product.slug)}/`}>{product.name}</Link>
        </h2>
        <span className={styles.price}>{formatVnd(product.price)}</span>
        <span className={styles.meta}>MOQ: {product.minimumOrderQuantity} {product.unit}</span>
      </div>
    </article>
  );
}

export function formatVnd(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    currency: "VND",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}
