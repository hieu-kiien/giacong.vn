"use client";

import { useEffect } from "react";

import styles from "@/components/catalog/product-detail.module.css";

/**
 * Detail-scoped error boundary. A failed upstream read is reported here rather than
 * being turned into a 404, so a temporary outage never reads as a removed product.
 */
export default function ProductDetailError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);

  return (
    <div className={styles.page}>
      <div className={styles.rail}>
        <section className={styles.notice}>
          <h1 className={styles.noticeTitle}>Chưa thể tải sản phẩm</h1>
          <p className={styles.noticeText}>Vui lòng thử lại sau ít phút.</p>
          <button className={styles.primaryAction} onClick={reset} type="button">Thử lại</button>
        </section>
      </div>
    </div>
  );
}
