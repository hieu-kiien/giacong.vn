import Link from "next/link";

import styles from "@/components/catalog/product-detail.module.css";
import type { ProductDetailRelatedCard } from "@/lib/product-detail-view";

interface RelatedProductCardProps {
  card: ProductDetailRelatedCard;
}

/**
 * Compact card for the detail page's related rail.
 *
 * Deliberately its own presentation component rather than a reuse of
 * `CatalogProductCard`: the rail needs a smaller card without the quick-preview
 * action, and the catalog card is owned by the list page. Keeping them separate is
 * what lets the detail rail change without touching the grid.
 *
 * Image and name both link to detail, per the card specification. No quick-add
 * action, so nothing here can add a line under a variant key the catalog never
 * issued.
 */
export function RelatedProductCard({ card }: RelatedProductCardProps) {
  return (
    <article className={styles.relatedCard}>
      <Link className={styles.relatedImage} href={card.detailHref} prefetch={false} tabIndex={-1}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={card.name} loading="lazy" src={card.imageUrl} />
      </Link>
      <div className={styles.relatedBody}>
        {card.categoryLabel ? <span className={styles.relatedCategory}>{card.categoryLabel}</span> : null}
        <h3 className={styles.relatedName}>
          <Link href={card.detailHref} prefetch={false}>{card.name}</Link>
        </h3>
        <span className={styles.relatedPrice}>{card.priceLabel}</span>
        <span className={styles.relatedMeta}>{card.specificationLabel}</span>
        <span className={styles.relatedAvailability}>{card.availabilityLabel}</span>
      </div>
    </article>
  );
}
