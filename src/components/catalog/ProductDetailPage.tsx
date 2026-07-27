import Link from "next/link";

import { ProductGallery } from "@/components/catalog/ProductGallery";
import { ProductPurchasePanel } from "@/components/catalog/ProductPurchasePanel";
import { RelatedProductCard } from "@/components/catalog/RelatedProductCard";
import styles from "@/components/catalog/product-detail.module.css";
import type { CatalogDetailSourceResult } from "@/lib/catalog-detail-source";
import { buildProductDetailView } from "@/lib/product-detail-view";

interface ProductDetailPageProps {
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
 * The social-proof block in the reference screenshot is absent, as the master plan
 * requires; the space it occupied carries verified product facts instead. None of the
 * customer-account or fulfilment surfaces the master plan excludes appear either —
 * `scripts/product-detail.test.mts` scans this file for all of them by name, which is
 * why they are not written out here.
 *
 * Owns `product-detail.module.css` rather than the shared catalog stylesheet, so
 * restyling detail cannot restyle the list page.
 */
export function ProductDetailPage({ initialVariantSku, source, variantQueryWarning }: ProductDetailPageProps) {
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

        {source.isDemo ? (
          <p className={styles.demoNotice}>
            Dữ liệu demo tạm thời: giá, quy cách và ảnh chưa phải dữ liệu chính thức.
          </p>
        ) : null}

        <div className={styles.hero}>
          <ProductGallery images={view.gallery} />

          <div className={styles.commercial}>
            {view.categoryLabel ? <p className={styles.category}>{view.categoryLabel}</p> : null}
            <h1 className={styles.title}>{view.name}</h1>
            <p className={styles.identity}>
              <span>SKU: {view.sku}</span>
              <span>{view.variantChoices.length} quy cách</span>
            </p>
            <p className={styles.price}>
              <span className={styles.priceValue}>{view.priceLabel}</span>
              <span className={styles.priceUnit}>/ {view.unitLabel}</span>
            </p>
            <p
              className={styles.availability}
              data-unavailable={view.isAvailable ? undefined : "true"}
            >
              {view.availabilityLabel}
            </p>
            {view.shortDescription ? <p className={styles.lede}>{view.shortDescription}</p> : null}

            <ProductPurchasePanel
              initialVariantSku={initialVariantSku}
              variantQueryWarning={variantQueryWarning}
              view={view}
            />
          </div>

          <aside aria-label="Thông tin sản phẩm" className={styles.factsPanel}>
            <h2 className={styles.factsTitle}>Thông số xác nhận</h2>
            <dl className={styles.facts}>
              {view.facts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          </aside>
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
