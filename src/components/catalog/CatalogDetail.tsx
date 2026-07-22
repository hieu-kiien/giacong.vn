import Link from "next/link";

import { ProductConfigurator } from "@/components/catalog/ProductConfigurator";
import styles from "@/components/catalog/catalog.module.css";
import type { CatalogProductDetail } from "@/types/catalog";

interface CatalogDetailProps {
  initialVariantSku: string | null;
  product: CatalogProductDetail;
  variantQueryWarning: boolean;
}

export function CatalogDetail({ initialVariantSku, product, variantQueryWarning }: CatalogDetailProps) {
  return (
    <main id="catalog-main" className={styles.catalog}>
      <div className={styles.inner}>
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <Link href="/">Trang chủ</Link> <span aria-hidden="true">/</span> <Link href="/san-pham/">Sản phẩm</Link>
          {product.category ? <><span aria-hidden="true"> / </span><Link href={`/san-pham/?category=${encodeURIComponent(product.category.slug)}`}>{product.category.name}</Link></> : null}
          <span aria-hidden="true"> / </span>{product.name}
        </nav>
        <ProductConfigurator
          initialVariantSku={initialVariantSku}
          product={product}
          variantQueryWarning={variantQueryWarning}
        />
        {product.description ? (
          <section className={styles.descriptionSection}>
            <h2 className={styles.sectionTitle}>Mô tả sản phẩm</h2>
            <p className={styles.description}>{product.description}</p>
          </section>
        ) : null}
      </div>
    </main>
  );
}
