import Link from "next/link";

import { ProductGallery } from "@/components/catalog/ProductGallery";
import { ProductDetailCommerce } from "@/components/catalog/ProductDetailCommerce";
import { RelatedProductCard } from "@/components/catalog/RelatedProductCard";
import styles from "@/components/catalog/product-detail.module.css";
import type { CatalogDetailSourceResult } from "@/lib/catalog-detail-source";
import { buildProductDetailView } from "@/lib/product-detail-view";

interface ProductDetailPageProps {
  editingCartVariantSku: string | null;
  initialVariantSku: string | null;
  source: CatalogDetailSourceResult;
  variantQueryWarning: boolean;
}

/**
 * `/san-pham/[slug]`, following the approved detail screenshot.
 *
 * Layout, per `docs/research/PAGE_TOPOLOGY.md`: breadcrumb, then a two-column hero
 * with the gallery left and the commercial column right, then description and the
 * related rail as a second row. A compact facts panel sits as a third hero column at
 * 1280 px and folds under the commercial column below that. Mobile is a single
 * column, so the gallery stacks above the commercial information.
 *
 * The social-proof block in the reference screenshot is absent, as the current plan
 * requires; the space it occupied carries verified product facts instead. None of the
 * customer-account or fulfilment surfaces the current plan excludes appear either —
 * `scripts/product-detail.test.mts` scans this file for all of them by name, which is
 * why they are not written out here.
 *
 * Owns `product-detail.module.css` rather than the shared catalog stylesheet, so
 * restyling detail cannot restyle the list page.
 */
export function ProductDetailPage({ editingCartVariantSku, initialVariantSku, source, variantQueryWarning }: ProductDetailPageProps) {
  const view = buildProductDetailView({ product: source.product, related: source.related });

  return (
    <div className={styles.page}>
      <div className={styles.rail}>
        <nav aria-label="Đường dẫn" className={styles.crumbs}>
          <ol>
            {view.breadcrumb.map((crumb) => (
              <li key={crumb.label}>
                {crumb.href
                  ? <Link href={crumb.href} prefetch={false}>{crumb.label}</Link>
                  : <span aria-current="page">{crumb.label}</span>}
              </li>
            ))}
          </ol>
        </nav>

        <div className={styles.hero}>
          <ProductGallery images={view.gallery} />
          <ProductDetailCommerce
            editingCartVariantSku={editingCartVariantSku}
            initialVariantSku={initialVariantSku}
            productId={source.product.id}
            variantQueryWarning={variantQueryWarning}
            view={view}
          />
        </div>

        {view.description ? (
          <section aria-labelledby="detail-description" className={styles.descriptionPanel}>
            <h2 className={styles.sectionTitle} id="detail-description">Mô tả sản phẩm</h2>
            <p className={styles.description}>{view.description}</p>
          </section>
        ) : null}

        {view.relatedProducts.length > 0 ? (
          <section aria-labelledby="detail-related" className={styles.relatedSection}>
            <h2 className={styles.sectionTitle} id="detail-related">Sản phẩm liên quan</h2>
            <ul className={styles.relatedRail}>
              {view.relatedProducts.map((card) => (
                <li key={card.slug}>
                  <RelatedProductCard card={card} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
