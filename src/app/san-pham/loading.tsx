import styles from "@/components/catalog/catalog.module.css";

export default function CatalogLoading() {
  return (
    <main id="catalog-main" className={styles.catalog} aria-busy="true" aria-label="Đang tải sản phẩm">
      <div className={`${styles.inner} ${styles.loading}`}>
        <div className={styles.loadingLine} />
        <div className={styles.loadingLine} />
        <div className={styles.loadingGrid}>{Array.from({ length: 4 }, (_, index) => <div className={styles.loadingCard} key={index} />)}</div>
      </div>
    </main>
  );
}
