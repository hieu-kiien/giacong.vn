import Link from "next/link";

import styles from "@/components/catalog/catalog.module.css";

export default function CatalogNotFound() {
  return <div className={styles.catalog}><div className={styles.inner}><div className={styles.notice}><h1 className={styles.title}>Không tìm thấy sản phẩm</h1><p>Sản phẩm có thể đã được đổi tên hoặc không còn được cung cấp.</p><Link className={styles.button} href="/san-pham/">Về danh mục sản phẩm</Link></div></div></div>;
}
