import Link from "next/link";

import { CatalogProductImage } from "@/components/catalog/CatalogProductImage";
import styles from "@/components/catalog/catalog.module.css";
import type { CatalogProductParent } from "@/types/catalog";

interface CatalogProductCardProps {
  product: CatalogProductParent;
}

export function CatalogProductCard({ product }: CatalogProductCardProps) {
  return (
    <article className={styles.card} data-catalog-card>
      <CatalogProductImage alt={product.name} imageUrl={product.imageUrl} />
      <div className={styles.cardContent}>
        {product.category ? <span className={styles.category}>{product.category.name}</span> : null}
        <h2 className={styles.productName}>{product.name}</h2>
        <span className={styles.price}>Từ {formatVnd(product.startingPrice.price)}</span>
        <span className={styles.meta}>{product.variantCount} phiên bản</span>
        <span className={styles.availability}>{product.availableVariantCount}/{product.variantCount} phiên bản có sẵn</span>
        <Link className={styles.cardAction} href={`/san-pham/${encodeURIComponent(product.slug)}/`} prefetch={false}>Xem chi tiết</Link>
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
