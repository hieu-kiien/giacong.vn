import Link from "next/link";

import styles from "@/components/catalog/product-detail.module.css";

/**
 * Detail-scoped 404. The parent `/san-pham` boundary still styles itself from the
 * catalog module; this one uses the detail stylesheet so the route keeps one visual
 * language whether the product resolves or not.
 */
export default function ProductDetailNotFound() {
  return (
    <div className={styles.page}>
      <div className={styles.rail}>
        <section className={styles.notice}>
          <h1 className={styles.noticeTitle}>Không tìm thấy sản phẩm</h1>
          <p className={styles.noticeText}>
            Sản phẩm có thể đã được đổi tên, đổi quy cách hoặc không còn được cung cấp.
          </p>
          <Link className={styles.secondaryAction} href="/san-pham/">Về danh mục sản phẩm</Link>
        </section>
      </div>
    </div>
  );
}
