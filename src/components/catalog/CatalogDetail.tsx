import Link from "next/link";

import { CatalogProductImage } from "@/components/catalog/CatalogProductImage";
import { formatVnd } from "@/components/catalog/CatalogProductCard";
import { PurchaseQuantity } from "@/components/catalog/PurchaseQuantity";
import styles from "@/components/catalog/catalog.module.css";
import type { CatalogProduct } from "@/types/catalog";

interface CatalogDetailProps {
  product: CatalogProduct;
}

export function CatalogDetail({ product }: CatalogDetailProps) {
  return (
    <main id="catalog-main" className={styles.catalog}>
      <div className={styles.inner}>
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <Link href="/">Trang chủ</Link> <span aria-hidden="true">/</span> <Link href="/san-pham/">Sản phẩm</Link>
          {product.category ? <><span aria-hidden="true"> / </span><Link href={`/san-pham/?category=${encodeURIComponent(product.category.slug)}`}>{product.category.name}</Link></> : null}
          <span aria-hidden="true"> / </span>{product.name}
        </nav>
        <div className={styles.detail}>
          <CatalogProductImage alt={product.name} className={styles.detailImage} imageUrl={product.imageUrl} />
          <div className={styles.detailCopy}>
            {product.category ? <span className={styles.category}>{product.category.name}</span> : null}
            <h1 className={styles.title}>{product.name}</h1>
            <span className={styles.price}>{formatVnd(product.price)}</span>
            {product.shortDescription ? <p className={styles.description}>{product.shortDescription}</p> : null}
            <table className={styles.facts}>
              <caption className="screen-reader-text">Thông tin đặt hàng</caption>
              <tbody>
                <tr><th scope="row">Số lượng đặt tối thiểu</th><td>{product.minimumOrderQuantity} {product.unit}</td></tr>
                <tr><th scope="row">Bước số lượng</th><td>{product.quantityStep} {product.unit}</td></tr>
                <tr><th scope="row">Đơn vị</th><td>{product.unit}</td></tr>
              </tbody>
            </table>
            <PurchaseQuantity
              contactFromQuantity={product.contactFromQuantity}
              minimumOrderQuantity={product.minimumOrderQuantity}
              productName={product.name}
              quantityStep={product.quantityStep}
              slug={product.slug}
              tierPrices={product.tierPrices}
              unit={product.unit}
            />
          </div>
        </div>
        {product.description ? <section><h2 className={styles.title}>Mô tả sản phẩm</h2><p className={styles.description}>{product.description}</p></section> : null}
        {product.tierPrices.length ? (
          <section>
            <h2 className={styles.title}>Giá theo số lượng</h2>
            <table className={styles.tierTable}>
              <caption className="screen-reader-text">Bảng giá theo số lượng</caption>
              <thead><tr><th scope="col">Số lượng từ</th><th scope="col">Đơn giá</th></tr></thead>
              <tbody>
                {product.tierPrices.map((tier) => <tr key={tier.minQuantity}><td>{tier.minQuantity} {product.unit}</td><td>{formatVnd(tier.price)}</td></tr>)}
                <tr><td>Từ {product.contactFromQuantity} {product.unit}</td><td><strong>Liên hệ</strong></td></tr>
              </tbody>
            </table>
          </section>
        ) : null}
      </div>
    </main>
  );
}
